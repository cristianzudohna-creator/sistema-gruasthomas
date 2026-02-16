// ✅ Archivo: src/alerts/alerts.controller.ts (COMPLETO)
import { Controller, Post, Query } from "@nestjs/common";
import { AlertsService } from "./alerts.service";
import { MailService } from "../mail/mail.service";

@Controller("alerts")
export class AlertsController {
  constructor(
    private readonly alerts: AlertsService,
    private readonly mail: MailService
  ) {}

  // ✅ Solo para ver qué saldría (ventana exacta de un día)
  @Post("preview-exact")
  async previewExact(@Query("days") days?: string) {
    const thresholdDays = Number(days || 7);
    return this.alerts.getExpirationsExact(thresholdDays);
  }

  // ✅ Preview: exacto + sin repetidos (según logs)
  @Post("preview-exact-unsent")
  async previewExactUnsent(@Query("days") days?: string) {
    const thresholdDays = Number(days || 7);
    return this.alerts.getExactAndUnsent(thresholdDays);
  }

  // =========================================================
  // ✅ DEMO (SOLO TEST): si no hay items reales, enviamos 1 correo igual
  // =========================================================
  private buildDemoItems(thresholdDays: number) {
    // OJO: NO son IDs reales, así evitamos contaminar el log.
    // Solo es para ver el correo “bonito” mientras no tienes vencimientos reales.
    const base = {
      kind: "DOCUMENT" as const,
      empresa: "GRUAS_THOMAS",
      patente: "DEMO-00",
      type: "Documento (demo)",
      nombre: `Ejemplo de vencimiento a ${thresholdDays} días`,
      dueDate: new Date(Date.now() + thresholdDays * 24 * 60 * 60 * 1000),
      daysLeft: thresholdDays,
    };

    if (thresholdDays === 7) {
      return [
        { ...base, patente: "DEMO-07", nombre: "SOAP (demo)", daysLeft: 7 },
        {
          ...base,
          kind: "MAINTENANCE" as const,
          patente: "DEMO-07",
          type: "Mantención (demo)",
          nombre: "Cambio de aceite (demo)",
          daysLeft: 7,
        },
      ];
    }

    if (thresholdDays === 15) {
      return [
        { ...base, patente: "DEMO-15", nombre: "Revisión técnica (demo)", daysLeft: 15 },
      ];
    }

    return [
      { ...base, patente: "DEMO-30", nombre: "Permiso circulación (demo)", daysLeft: 30 },
    ];
  }

  private wrapHtmlForClarity(html: string, thresholdDays: number) {
    // ⚠️ No tocamos el HTML corporativo de AlertsService, solo añadimos una línea clara
    // arriba para que “Días” no se vea confuso.
    return `
      <div style="font-family: Arial, sans-serif;">
        <div style="margin:0 0 10px; padding:10px 12px; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:12px; color:#111827;">
          <b>Referencia:</b> Este aviso corresponde a vencimientos a <b>${thresholdDays}</b> días desde hoy.
          <span style="color:#6B7280;">(La columna indica “Faltan X días”)</span>
        </div>
        ${html.replace(/>\s*(\d+)\s*<span[^>]*>\s*días\s*<\/span>/g, `>Faltan $1 <span style="color:#6B7280;font-weight:700;">días</span>`)}
      </div>
    `;
  }

  // =========================================================
  // ✅ Envío único por umbral (EXACTO) + LOG (no repetir)
  // =========================================================
  private async sendExact(mode: "prod" | "test", thresholdDays: number) {
    const mailTo = this.alerts.resolveRecipient(mode);

    // ✅ trae SOLO los que vencen EXACTO a N días y que NO se hayan enviado antes
    const data = await this.alerts.getExactAndUnsent(thresholdDays);

    // ✅ TEST DEMO: si no hay items reales, igual mandamos un correo demo
    const useDemo = mode === "test" && !data.items.length;

    const itemsToSend = useDemo ? this.buildDemoItems(thresholdDays) : data.items;

    if (!itemsToSend.length) {
      return {
        ok: true,
        sent: false,
        reason: "no-items",
        thresholdDays,
        mailTo,
        count: 0,
        from: data.from,
        to: data.to,
      };
    }

    const baseSubject = this.alerts.buildSubject(thresholdDays);
    const subject = mode === "test" ? `(PRUEBA) ${baseSubject}` : baseSubject;

    let html = this.alerts.buildEmailHtml({
      from: data.from,
      to: data.to,
      daysBefore: thresholdDays,
      items: itemsToSend as any,
    });

    // ✅ hace más claro “Faltan X días”
    html = this.wrapHtmlForClarity(html, thresholdDays);

    // ✅ si es DEMO, avisamos discretamente dentro del correo
    if (useDemo) {
      html = html.replace(
        "Aviso de vencimientos próximos",
        "Aviso de vencimientos próximos <span style=\"font-size:12px;color:#6B7280;\">(correo de prueba)</span>"
      );
    }

    const sendResult = await this.mail.sendHtml({
      to: mailTo,
      subject,
      html,
      textFallback: `${
        mode === "test" ? "(PRUEBA) " : ""
      }Aviso de vencimientos próximos (a ${thresholdDays} días). Total: ${
        itemsToSend.length
      }`,
    });

    // ✅ SOLO registramos en BD si NO es demo
    if (!useDemo) {
      const messageId =
        (sendResult as any)?.messageId ?? (sendResult as any)?.info?.messageId ?? null;

      await this.alerts.markDispatched({
        items: itemsToSend as any,
        thresholdDays,
        recipient: mailTo,
        subject,
        messageId,
      });
    }

    return {
      sent: true,
      thresholdDays,
      count: itemsToSend.length,
      mailTo,
      demo: useDemo,
      resultOk: true,
      ...sendResult,
    };
  }

  // =========================================================
  // ✅ 3 correos (30 / 15 / 7)
  // =========================================================

  /**
   * ✅ PRUEBA: envía 30, 15 y 7 (a czudohna)
   * POST /alerts/test-send-all
   */
  @Post("test-send-all")
  async testSendAll() {
    const results = await Promise.all([
      this.sendExact("test", 30),
      this.sendExact("test", 15),
      this.sendExact("test", 7),
    ]);

    return { ok: true, mode: "test", results };
  }

  /**
   * ✅ PROD: envía 30, 15 y 7 (a controlflota)
   * POST /alerts/send-all
   */
  @Post("send-all")
  async sendAll() {
    const results = await Promise.all([
      this.sendExact("prod", 30),
      this.sendExact("prod", 15),
      this.sendExact("prod", 7),
    ]);

    return { ok: true, mode: "prod", results };
  }

  // =========================================================
  // ✅ Envío por 1 umbral (por si quieres probar 7)
  // =========================================================

  /**
   * ✅ PRUEBA: envía SOLO un umbral exacto (ej: ?days=7)
   * POST /alerts/test-send-exact?days=7
   */
  @Post("test-send-exact")
  async testSendExact(@Query("days") days?: string) {
    const thresholdDays = Number(days || 7);
    return this.sendExact("test", thresholdDays);
  }

  /**
   * ✅ PROD: envía SOLO un umbral exacto (ej: ?days=7)
   * POST /alerts/send-exact?days=7
   */
  @Post("send-exact")
  async sendExactProd(@Query("days") days?: string) {
    const thresholdDays = Number(days || 7);
    return this.sendExact("prod", thresholdDays);
  }
}











