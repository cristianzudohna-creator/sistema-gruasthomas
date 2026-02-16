import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { AlertsService } from "./alerts.service";
import { MailService } from "../mail/mail.service";

@Injectable()
export class AlertsCron {
  private readonly logger = new Logger(AlertsCron.name);

  constructor(
    private readonly alerts: AlertsService,
    private readonly mail: MailService
  ) {}

  /**
   * ✅ Lun–Vie a las 09:00 (Chile)
   * - Envía 30 / 15 / 7 (exactos)
   * - En MODO PRUEBA por defecto (usa ALERT_TEST_TO)
   *
   * CRON: minuto hora díaMes mes díaSemana
   * "0 9 * * 1-5" => 09:00 Lun–Vie
   */
  @Cron("0 9 * * 1-5", { timeZone: "America/Santiago" })
  async sendBusinessDayAlertsChile() {
    const mode: "test" | "prod" = "test"; // 👈 cambia a "prod" cuando estés listo

    this.logger.log(
      `CRON alertas vencimientos ejecutado. tz=America/Santiago mode=${mode} thresholds=30,15,7`
    );

    await this.sendExact(mode, 30);
    await this.sendExact(mode, 15);
    await this.sendExact(mode, 7);

    this.logger.log("CRON alertas vencimientos finalizado.");
  }

  private async sendExact(mode: "prod" | "test", thresholdDays: number) {
    const mailTo = this.alerts.resolveRecipient(mode);

    // ✅ SOLO vence EXACTO a N días y NO se ha enviado antes (dedupe por logs)
    const data = await this.alerts.getExactAndUnsent(thresholdDays);

    if (!data.items.length) {
      this.logger.log(
        `Sin items para threshold=${thresholdDays}. mailTo=${mailTo}`
      );
      return { ok: true, sent: false, thresholdDays, mailTo, count: 0 };
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
      to: mailTo,
      subject,
      html,
      textFallback: `${
        mode === "test" ? "(PRUEBA) " : ""
      }Aviso de vencimientos próximos (a ${thresholdDays} días). Total: ${
        data.items.length
      }`,
    });

    const messageId =
      (sendResult as any)?.messageId ??
      (sendResult as any)?.info?.messageId ??
      null;

    // ✅ registra para NO repetir este mismo correo (30 o 15 o 7) para el mismo item
    await this.alerts.markDispatched({
      items: data.items,
      thresholdDays,
      recipient: mailTo,
      subject,
      messageId,
    });

    this.logger.log(
      `Enviado threshold=${thresholdDays}. count=${data.items.length}. mailTo=${mailTo}`
    );

    return { sent: true, thresholdDays, count: data.items.length, mailTo };
  }
}


