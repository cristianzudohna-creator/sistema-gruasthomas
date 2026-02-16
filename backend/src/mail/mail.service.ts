import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

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
    return process.env.SMTP_FROM || process.env.SMTP_USER;
  }

  /**
   * ✅ NUEVO: Enviar correo HTML genérico (para alertas)
   */
  async sendHtml(params: {
    to: string | string[];
    subject: string;
    html: string;
    textFallback?: string;
  }) {
    const from = this.from();

    if (!params?.to || (Array.isArray(params.to) && params.to.length === 0)) {
      throw new Error("Falta destinatario en sendHtml({to,...}).");
    }
    if (!params?.subject) throw new Error("Falta subject en sendHtml({subject,...}).");
    if (!params?.html) throw new Error("Falta html en sendHtml({html,...}).");

    // ✅ verifica conexión/config antes de enviar (ayuda a detectar credenciales/puerto)
    await this.transporter.verify();

    const info = await this.transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      // fallback útil por si algún cliente bloquea HTML
      text: params.textFallback,
    });

    const toStr = Array.isArray(params.to) ? params.to.join(", ") : params.to;
    this.logger.log(`Correo enviado a ${toStr}. subject="${params.subject}" messageId=${info.messageId}`);

    return { ok: true, to: params.to, subject: params.subject, messageId: info.messageId };
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
    const target = to || process.env.SMTP_TEST_TO || process.env.SMTP_USER;

    if (!target) {
      throw new Error(
        "Falta destinatario. Usa sendTestEmail(to) o define SMTP_TEST_TO/SMTP_USER."
      );
    }

    // ✅ verifica conexión/config antes de enviar
    await this.transporter.verify();

    const info = await this.transporter.sendMail({
      from,
      to: target,
      subject: "✅ Prueba SMTP - Sistema (Insprotel)",
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.5">
          <h2>Correo de prueba</h2>
          <p>Si lees esto, el backend ya puede enviar correos por SMTP.</p>
          <p><b>Fecha:</b> ${new Date().toLocaleString("es-CL")}</p>
        </div>
      `,
    });

    this.logger.log(`Correo de prueba enviado a ${target}. messageId=${info.messageId}`);
    return { ok: true, to: target, messageId: info.messageId };
  }
}


