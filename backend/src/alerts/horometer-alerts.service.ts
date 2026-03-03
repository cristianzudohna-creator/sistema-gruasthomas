import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";

function parseEmails(v?: string): string[] {
  return String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

@Injectable()
export class HorometerAlertsService {
  private readonly logger = new Logger(HorometerAlertsService.name);

  constructor(private prisma: PrismaService, private mail: MailService) {}

  private getMarginHours(): number {
    const n = Number(process.env.ALERT_HOROMETER_MARGIN_HOURS ?? 0);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  /**
   * ✅ Destinatarios por empresa:
   * - ALERT_HOROMETER_TO_GRUAS_THOMAS="a@x.com,b@y.com"
   * - ALERT_HOROMETER_TO_INSPROTEL="..."
   * fallback: ALERT_HOROMETER_TO="..."
   */
  private getRecipients(empresa: string): string[] {
    const byCompany =
      (process.env as any)[`ALERT_HOROMETER_TO_${empresa}`] ||
      process.env.ALERT_HOROMETER_TO;

    return parseEmails(byCompany);
  }

  private companyLabel(empresa: string) {
    if (empresa === "GRUAS_THOMAS") return "Grúas Thomas";
    if (empresa === "INSPROTEL") return "Insprotel";
    return empresa;
  }

  /**
   * ✅ Hook al crear horómetro.
   * - Si no hay plan: crea nextDueHours = horas + 500
   * - Si está cerca (margen) o vencido: manda correo 1 sola vez por meta
   * - Si vencido: avanza nextDueHours en saltos de 500 hasta quedar > horas
   */
  async onHorometerCreated(params: { vehicleId: string; horas: number }) {
    const { vehicleId, horas } = params;

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        patente: true,
        empresa: true,
        estadoOperativo: true,
        activo: true,
      },
    });

    if (!vehicle) return;
    if (!vehicle.activo) return;
    if (vehicle.estadoOperativo !== "OPERATIVO") return;

    let plan = await this.prisma.horometerMaintenancePlan.findUnique({
      where: { vehicleId },
    });

    if (!plan) {
      plan = await this.prisma.horometerMaintenancePlan.create({
        data: {
          vehicleId,
          intervalHours: 500,
          nextDueHours: horas + 500,
          enabled: true,
        },
      });
    }

    if (!plan.enabled) return;

    const margin = this.getMarginHours();
    const due = plan.nextDueHours;

    const isNear = horas >= due - margin && horas < due;
    const isDueOrOver = horas >= due;

    if (!isNear && !isDueOrOver) return;

    // ✅ evitar repetir
    if (plan.lastNotifiedDueHours === due) return;

    const recipients = this.getRecipients(vehicle.empresa);
    if (recipients.length === 0) {
      this.logger.warn(
        `No hay destinatarios configurados para ALERT_HOROMETER_TO_${vehicle.empresa} / ALERT_HOROMETER_TO`
      );
      return;
    }

    const empresaLabel = this.companyLabel(vehicle.empresa);
    const status = isDueOrOver ? "VENCIDO" : "PRONTO";
    const remaining = due - horas;

    const subject = `[${empresaLabel}] Mantención por horómetro (${status}) - ${vehicle.patente} (meta ${due}h)`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.5">
        <h2>Mantención por horómetro - ${status}</h2>
        <p><b>Empresa:</b> ${empresaLabel}</p>
        <p><b>Vehículo:</b> ${vehicle.patente}</p>

        <hr />

        <p><b>Horómetro actual:</b> ${horas} h</p>
        <p><b>Meta mantención:</b> ${due} h (cada ${plan.intervalHours} h)</p>
        ${
          isDueOrOver
            ? `<p style="color:#b00020"><b>Estado:</b> VENCIDO (se pasó por ${Math.abs(remaining)} h)</p>`
            : `<p><b>Estado:</b> PRONTO (faltan ${Math.max(remaining, 0)} h)</p>`
        }

        <hr />

        <p style="font-size:12px;color:#666">
          Este correo fue generado automáticamente por el sistema.
        </p>
      </div>
    `;

    try {
      const send = await this.mail.sendHtml({
        to: recipients,
        subject,
        html,
        textFallback: `${empresaLabel} - Mantención por horómetro ${status}. Vehículo ${vehicle.patente}. Horas: ${horas}. Meta: ${due}.`,
      });

      // ✅ Log (reusamos thresholdDays como "metaHoras")
      await this.prisma.alertDispatchLog.upsert({
        where: {
          kind_entityId_thresholdDays: {
            kind: "HOROMETER",
            entityId: vehicleId,
            thresholdDays: due,
          },
        },
        create: {
          kind: "HOROMETER",
          entityId: vehicleId,
          thresholdDays: due,
          recipient: recipients.join(", "),
          subject,
          messageId: (send as any)?.messageId ?? null,
        },
        update: {
          recipient: recipients.join(", "),
          subject,
          messageId: (send as any)?.messageId ?? null,
        },
      });

      let nextDue = due;
      if (isDueOrOver) {
        while (nextDue <= horas) nextDue += plan.intervalHours;
      }

      await this.prisma.horometerMaintenancePlan.update({
        where: { id: plan.id },
        data: {
          lastNotifiedDueHours: due,
          nextDueHours: nextDue,
        },
      });

      this.logger.log(
        `Alerta horómetro enviada. veh=${vehicle.patente} horas=${horas} due=${due} nextDue=${nextDue}`
      );
    } catch (err: any) {
      this.logger.error(`Error enviando alerta horómetro: ${err?.message || err}`);
    }
  }
}