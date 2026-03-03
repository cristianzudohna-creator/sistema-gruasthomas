import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

function normalizeRecipients(to: string | string[]) {
  if (Array.isArray(to)) {
    return to.map((x) => String(x).trim()).filter(Boolean);
  }

  // ✅ si viene "a@a.com,b@b.com" => ["a@a.com","b@b.com"]
  const s = String(to || "").trim();
  if (!s) return [];

  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true", // true para 465 (SSL)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  private from() {
    // ✅ El "FROM" real será SMTP_FROM si existe, si no SMTP_USER
    return process.env.SMTP_FROM || process.env.SMTP_USER;
  }

  /**
   * ✅ Enviar correo HTML genérico (para alertas)
   */
  async sendHtml(params: {
    to: string | string[];
    subject: string;
    html: string;
    textFallback?: string;
  }) {
    const from = this.from();

    const toList = normalizeRecipients(params?.to);

    if (!toList.length) {
      throw new Error("Falta destinatario en sendHtml({to,...}).");
    }
    if (!params?.subject) throw new Error("Falta subject en sendHtml({subject,...}).");
    if (!params?.html) throw new Error("Falta html en sendHtml({html,...}).");

    // ✅ verifica conexión/config antes de enviar (ayuda a detectar credenciales/puerto)
    await this.transporter.verify();

    const info = await this.transporter.sendMail({
      from,
      to: toList, // ✅ SIEMPRE array ya normalizado
      subject: params.subject,
      html: params.html,
      text: params.textFallback,
    });

    this.logger.log(
      `Correo enviado a ${toList.join(", ")}. subject="${params.subject}" messageId=${info.messageId}`
    );

    return { ok: true, to: toList, subject: params.subject, messageId: info.messageId };
  }

  // ✅ EXISTENTE: no se toca (Auth lo usa)
  async sendResetPasswordEmail(to: string, resetUrl: string) {
    const from = this.from();

    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.5">
        <h2>Recuperación de contraseña</h2>
        <p>Se solicitó restablecer tu contraseña.</p>
        <p>Haz clic en el enlace (válido por 15 minutos):</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Si no fuiste tú, ignora este correo.</p>
      </div>
    `;

    await this.transporter.sendMail({
      from,
      to,
      subject: "Recuperación de contraseña - Grúas Thomas",
      html,
    });
  }

  // ✅ EXISTENTE: correo de prueba (para validar SMTP)
  async sendTestEmail(to?: string) {
    const from = this.from();

    const targetRaw = to || process.env.SMTP_TEST_TO || process.env.SMTP_USER;
    const targetList = normalizeRecipients(targetRaw || "");

    if (!targetList.length) {
      throw new Error(
        "Falta destinatario. Usa sendTestEmail(to) o define SMTP_TEST_TO/SMTP_USER."
      );
    }

    await this.transporter.verify();

    const info = await this.transporter.sendMail({
      from,
      to: targetList,
      subject: "✅ Prueba SMTP - Sistema (Insprotel)",
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.5">
          <h2>Correo de prueba</h2>
          <p>Si lees esto, el backend ya puede enviar correos por SMTP.</p>
          <p><b>Fecha:</b> ${new Date().toLocaleString("es-CL")}</p>
        </div>
      `,
    });

    this.logger.log(`Correo de prueba enviado a ${targetList.join(", ")}. messageId=${info.messageId}`);
    return { ok: true, to: targetList, messageId: info.messageId };
  }
}


