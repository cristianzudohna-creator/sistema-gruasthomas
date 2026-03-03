import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { AlertsService } from "./alerts.service";
import { MailService } from "../mail/mail.service";

function parseList(v?: string): number[] {
  // "25,10" => [25,10]
  return String(v || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

@Injectable()
export class AlertsCron {
  private readonly logger = new Logger(AlertsCron.name);

  constructor(
    private readonly alerts: AlertsService,
    private readonly mail: MailService
  ) {}

  /**
   * ✅ Lun–Vie a las 09:00 (Chile)
   * - Vencimientos: 30/15/7 (exactos)
   * - Horómetro: thresholds por ENV (ej 25/10 horas antes de 500)
   *
   * mode:
   * - ALERT_MODE=test|prod (default test)
   */
  @Cron("0 9 * * 1-5", { timeZone: "America/Santiago" })
  async sendBusinessDayAlertsChile() {
    const mode: "test" | "prod" =
      (String(process.env.ALERT_MODE || "test").toLowerCase() === "prod"
        ? "prod"
        : "test") as any;

    const dayThresholds = [30, 15, 7];

    // ✅ Horómetro (por defecto 25 y 10 horas antes)
    const horThresholds =
      parseList(process.env.ALERT_HOROMETER_THRESHOLDS) || [];
    const horometerThresholds = horThresholds.length ? horThresholds : [25, 10];

    this.logger.log(
      `CRON alertas ejecutado. tz=America/Santiago mode=${mode} days=${dayThresholds.join(
        ","
      )} horometer=${horometerThresholds.join(",")}`
    );

    // ✅ Vencimientos documentos/mantenciones
    for (const d of dayThresholds) {
      await this.sendExactExpiration(mode, d);
    }

    // ✅ Horómetro
    for (const h of horometerThresholds) {
      await this.sendExactHorometer(mode, h);
    }

    this.logger.log("CRON alertas finalizado.");
  }

  // =========================
  // VENCIMIENTOS (Docs/Mants)
  // =========================
  private async sendExactExpiration(mode: "prod" | "test", thresholdDays: number) {
    const mailTo = this.alerts.resolveRecipient(mode);

    const data = await this.alerts.getExactAndUnsent(thresholdDays);

    if (!data.items.length) {
      this.logger.log(`Sin items expirations threshold=${thresholdDays}. to=${mailTo}`);
      return { ok: true, sent: false, thresholdDays, to: mailTo, count: 0 };
    }

    const baseSubject = this.alerts.buildSubject(thresholdDays);
    const subject = mode === "test" ? `(PRUEBA) ${baseSubject}` : baseSubject;

    const html = this.alerts.buildEmailHtml({
      from: data.from,
      to: data.to,
      daysBefore: thresholdDays,
      items: data.items,
    });

    const sendResult = await this.mail.sendHtml({
      to: mailTo, // puede venir "a,b" o array; MailService ya normaliza
      subject,
      html,
      textFallback: `${
        mode === "test" ? "(PRUEBA) " : ""
      }Aviso de vencimientos próximos (a ${thresholdDays} días). Total: ${data.items.length}`,
    });

    const messageId = (sendResult as any)?.messageId ?? null;

    await this.alerts.markDispatched({
      items: data.items,
      thresholdDays,
      recipient: mailTo,
      subject,
      messageId,
    });

    this.logger.log(
      `Enviado expirations threshold=${thresholdDays}. count=${data.items.length}. to=${mailTo}`
    );

    return { sent: true, thresholdDays, count: data.items.length, to: mailTo };
  }

  // =========================
  // HORÓMETRO
  // =========================
  private async sendExactHorometer(mode: "prod" | "test", thresholdHours: number) {
    const mailTo = this.alerts.resolveRecipient(mode);

    const data = await this.alerts.getHorometerExactAndUnsent(thresholdHours);

    if (!data.items.length) {
      this.logger.log(`Sin items horometer thresholdHours=${thresholdHours}. to=${mailTo}`);
      return { ok: true, sent: false, thresholdHours, to: mailTo, count: 0 };
    }

    const baseSubject = this.alerts.buildHorometerSubject(thresholdHours);
    const subject = mode === "test" ? `(PRUEBA) ${baseSubject}` : baseSubject;

    const html = this.alerts.buildEmailHtml({
      hoursBefore: thresholdHours,
      items: data.items,
    });

    const sendResult = await this.mail.sendHtml({
      to: mailTo,
      subject,
      html,
      textFallback: `${
        mode === "test" ? "(PRUEBA) " : ""
      }Aviso horómetro: faltan ${thresholdHours}h para la mantención. Total: ${data.items.length}`,
    });

    const messageId = (sendResult as any)?.messageId ?? null;

    // ✅ reutilizamos thresholdDays para horas también (como ya haces)
    await this.alerts.markDispatched({
      items: data.items,
      thresholdDays: thresholdHours,
      recipient: mailTo,
      subject,
      messageId,
    });

    this.logger.log(
      `Enviado horometer thresholdHours=${thresholdHours}. count=${data.items.length}. to=${mailTo}`
    );

    return { sent: true, thresholdHours, count: data.items.length, to: mailTo };
  }
}


