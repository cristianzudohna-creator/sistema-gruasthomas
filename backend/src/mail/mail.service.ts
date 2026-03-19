import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

function normalizeRecipients(to: string | string[]) {
  if (Array.isArray(to)) {
    return to.map((x) => String(x).trim()).filter(Boolean);
  }

  const s = String(to || "").trim();
  if (!s) return [];

  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function fmtDateTimeEsCL(v: Date | string | number) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  private from() {
    return process.env.SMTP_FROM || process.env.SMTP_USER;
  }

  /**
   * ✅ Enviar correo HTML genérico
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
    if (!params?.subject) {
      throw new Error("Falta subject en sendHtml({subject,...}).");
    }
    if (!params?.html) {
      throw new Error("Falta html en sendHtml({html,...}).");
    }

    await this.transporter.verify();

    const info = await this.transporter.sendMail({
      from,
      to: toList,
      subject: params.subject,
      html: params.html,
      text: params.textFallback,
    });

    this.logger.log(
      `Correo enviado a ${toList.join(", ")}. subject="${params.subject}" messageId=${info.messageId}`
    );

    return {
      ok: true,
      to: toList,
      subject: params.subject,
      messageId: info.messageId,
    };
  }

  // ✅ EXISTENTE
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

  // ✅ NUEVO: enviar código de recuperación a soporte
  async sendPasswordResetCodeToSupport(params: {
    supportTo?: string | string[];
    rut: string;
    code: string;
    requestedAt: Date | string;
    expiresAt: Date | string;
    nombre?: string | null;
    apellido?: string | null;
    email?: string | null;
  }) {
    const supportTo =
      params.supportTo ||
      process.env.PASSWORD_RESET_SUPPORT_TO ||
      process.env.SMTP_TEST_TO ||
      process.env.SMTP_USER;

    const toList = normalizeRecipients(supportTo || "");

    if (!toList.length) {
      throw new Error(
        "Falta destinatario para código de recuperación. Define PASSWORD_RESET_SUPPORT_TO o SMTP_USER."
      );
    }

    const nombre = String(params.nombre || "").trim();
    const apellido = String(params.apellido || "").trim();
    const fullName =
      `${nombre}${apellido ? " " + apellido : ""}`.trim() || "Usuario";
    const email = String(params.email || "").trim() || "—";

    const requestedAtFmt = fmtDateTimeEsCL(params.requestedAt);
    const expiresAtFmt = fmtDateTimeEsCL(params.expiresAt);

    const subject = `🔐 Código recuperación clave - ${params.rut}`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111">
        <h2 style="margin:0 0 12px 0;">Recuperación de contraseña</h2>
        <p>Se generó un nuevo código de recuperación para un trabajador.</p>

        <table style="border-collapse: collapse; width: 100%; max-width: 700px; margin-top: 12px;">
          <tr>
            <td style="padding:8px; border:1px solid #ddd; font-weight:bold; width: 220px;">Trabajador</td>
            <td style="padding:8px; border:1px solid #ddd;">${fullName}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd; font-weight:bold;">RUT</td>
            <td style="padding:8px; border:1px solid #ddd;">${params.rut}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Correo</td>
            <td style="padding:8px; border:1px solid #ddd;">${email}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Código</td>
            <td style="padding:8px; border:1px solid #ddd; font-size:20px; font-weight:bold; letter-spacing:2px;">
              ${params.code}
            </td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Fecha solicitud</td>
            <td style="padding:8px; border:1px solid #ddd;">${requestedAtFmt}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Expira</td>
            <td style="padding:8px; border:1px solid #ddd;">${expiresAtFmt}</td>
          </tr>
        </table>

        <p style="margin-top:16px;">
          Entrega este código al trabajador por el canal interno que corresponda.
        </p>
      </div>
    `;

    const textFallback = [
      "Recuperación de contraseña",
      `Trabajador: ${fullName}`,
      `RUT: ${params.rut}`,
      `Correo: ${email}`,
      `Código: ${params.code}`,
      `Fecha solicitud: ${requestedAtFmt}`,
      `Expira: ${expiresAtFmt}`,
    ].join("\n");

    return this.sendHtml({
      to: toList,
      subject,
      html,
      textFallback,
    });
  }

  // ✅ EXISTENTE
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

    this.logger.log(
      `Correo de prueba enviado a ${targetList.join(", ")}. messageId=${info.messageId}`
    );
    return { ok: true, to: targetList, messageId: info.messageId };
  }
}

