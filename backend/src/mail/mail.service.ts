// ✅ Archivo: src/mail/mail.service.ts (COMPLETO)
// ✅ SMTP con nodemailer
// ✅ sendHtml genérico
// ✅ sendTestEmail
// ✅ sendResetPasswordEmail legacy
// ✅ NUEVO:
// - sendPasswordResetCodeToUser(): envía el código al correo del usuario
// - sendPasswordResetCode(): alias compatible
// - sendPasswordResetCodeToSupport(): mantiene copia/aviso a soporte
// ✅ FIX:
// - logs más claros
// - valida destinatarios
// - evita romper si SMTP_FROM no está definido

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

function escapeHtml(value: any) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fullName(params: { nombre?: string | null; apellido?: string | null }) {
  const nombre = String(params.nombre || "").trim();
  const apellido = String(params.apellido || "").trim();
  return `${nombre}${apellido ? " " + apellido : ""}`.trim() || "Usuario";
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
    return (
      process.env.SMTP_FROM ||
      process.env.SMTP_USER ||
      "Sistema Grúas Thomas <no-reply@sistemagruasthomas.cl>"
    );
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

    this.logger.log(
      `Preparando correo SMTP hacia ${toList.join(", ")} subject="${params.subject}"`
    );

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

  // ✅ EXISTENTE / LEGACY
  async sendResetPasswordEmail(to: string, resetUrl: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.5">
        <h2>Recuperación de contraseña</h2>
        <p>Se solicitó restablecer tu contraseña.</p>
        <p>Haz clic en el enlace válido por 15 minutos:</p>
        <p><a href="${escapeHtml(resetUrl)}">${escapeHtml(resetUrl)}</a></p>
        <p>Si no fuiste tú, ignora este correo.</p>
      </div>
    `;

    return this.sendHtml({
      to,
      subject: "Recuperación de contraseña - Grúas Thomas",
      html,
      textFallback: `Recuperación de contraseña\nEnlace: ${resetUrl}`,
    });
  }

  // ✅ NUEVO: enviar código directo al correo del usuario
  async sendPasswordResetCodeToUser(params: {
    to?: string | string[];
    rut: string;
    code: string;
    requestedAt: Date | string;
    expiresAt: Date | string;
    nombre?: string | null;
    apellido?: string | null;
    email?: string | null;
  }) {
    const target = params.to || params.email || "";
    const toList = normalizeRecipients(target);

    if (!toList.length) {
      throw new Error(
        "Falta destinatario del usuario para enviar código de recuperación."
      );
    }

    const name = fullName(params);
    const requestedAtFmt = fmtDateTimeEsCL(params.requestedAt);
    const expiresAtFmt = fmtDateTimeEsCL(params.expiresAt);

    const subject = "Código de recuperación de contraseña - Grúas Thomas";

    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111; background:#f6f7fb; padding:24px;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e5e7eb;">
          <div style="background:#111827; color:#ffffff; padding:18px 22px;">
            <h2 style="margin:0; font-size:20px;">Recuperación de contraseña</h2>
          </div>

          <div style="padding:22px;">
            <p style="margin-top:0;">Hola <b>${escapeHtml(name)}</b>,</p>

            <p>
              Se solicitó un código para restablecer tu contraseña en el sistema de Grúas Thomas.
            </p>

            <div style="margin:22px 0; padding:18px; background:#f3f4f6; border-radius:12px; text-align:center;">
              <div style="font-size:13px; color:#6b7280; margin-bottom:8px;">Tu código de recuperación es:</div>
              <div style="font-size:34px; font-weight:800; letter-spacing:6px; color:#111827;">
                ${escapeHtml(params.code)}
              </div>
            </div>

            <table style="border-collapse: collapse; width: 100%; margin-top: 12px;">
              <tr>
                <td style="padding:8px; border:1px solid #e5e7eb; font-weight:bold; width:180px;">RUT</td>
                <td style="padding:8px; border:1px solid #e5e7eb;">${escapeHtml(params.rut)}</td>
              </tr>
              <tr>
                <td style="padding:8px; border:1px solid #e5e7eb; font-weight:bold;">Fecha solicitud</td>
                <td style="padding:8px; border:1px solid #e5e7eb;">${escapeHtml(requestedAtFmt)}</td>
              </tr>
              <tr>
                <td style="padding:8px; border:1px solid #e5e7eb; font-weight:bold;">Expira</td>
                <td style="padding:8px; border:1px solid #e5e7eb;">${escapeHtml(expiresAtFmt)}</td>
              </tr>
            </table>

            <p style="margin-top:18px;">
              Este código vence en 15 minutos. Si tú no solicitaste este código, puedes ignorar este correo.
            </p>

            <p style="margin-bottom:0; color:#6b7280; font-size:13px;">
              No compartas este código con personas no autorizadas.
            </p>
          </div>
        </div>
      </div>
    `;

    const textFallback = [
      "Recuperación de contraseña - Grúas Thomas",
      `Hola ${name}`,
      `Tu código de recuperación es: ${params.code}`,
      `RUT: ${params.rut}`,
      `Fecha solicitud: ${requestedAtFmt}`,
      `Expira: ${expiresAtFmt}`,
      "Si no solicitaste este código, ignora este correo.",
    ].join("\n");

    return this.sendHtml({
      to: toList,
      subject,
      html,
      textFallback,
    });
  }

  // ✅ Alias compatible con auth.service.ts
  async sendPasswordResetCode(params: {
    to?: string | string[];
    rut: string;
    code: string;
    requestedAt: Date | string;
    expiresAt: Date | string;
    nombre?: string | null;
    apellido?: string | null;
    email?: string | null;
  }) {
    return this.sendPasswordResetCodeToUser(params);
  }

  // ✅ Enviar código de recuperación a soporte
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

    const name = fullName(params);
    const email = String(params.email || "").trim() || "—";

    const requestedAtFmt = fmtDateTimeEsCL(params.requestedAt);
    const expiresAtFmt = fmtDateTimeEsCL(params.expiresAt);

    const subject = `Código recuperación clave - ${params.rut}`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111">
        <h2 style="margin:0 0 12px 0;">Recuperación de contraseña</h2>
        <p>Se generó un nuevo código de recuperación para un trabajador.</p>

        <table style="border-collapse: collapse; width: 100%; max-width: 700px; margin-top: 12px;">
          <tr>
            <td style="padding:8px; border:1px solid #ddd; font-weight:bold; width: 220px;">Trabajador</td>
            <td style="padding:8px; border:1px solid #ddd;">${escapeHtml(name)}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd; font-weight:bold;">RUT</td>
            <td style="padding:8px; border:1px solid #ddd;">${escapeHtml(params.rut)}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Correo</td>
            <td style="padding:8px; border:1px solid #ddd;">${escapeHtml(email)}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Código</td>
            <td style="padding:8px; border:1px solid #ddd; font-size:20px; font-weight:bold; letter-spacing:2px;">
              ${escapeHtml(params.code)}
            </td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Fecha solicitud</td>
            <td style="padding:8px; border:1px solid #ddd;">${escapeHtml(requestedAtFmt)}</td>
          </tr>
          <tr>
            <td style="padding:8px; border:1px solid #ddd; font-weight:bold;">Expira</td>
            <td style="padding:8px; border:1px solid #ddd;">${escapeHtml(expiresAtFmt)}</td>
          </tr>
        </table>

        <p style="margin-top:16px;">
          Este correo es una copia de seguridad para administración/soporte.
        </p>
      </div>
    `;

    const textFallback = [
      "Recuperación de contraseña",
      `Trabajador: ${name}`,
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
    const targetRaw = to || process.env.SMTP_TEST_TO || process.env.SMTP_USER;
    const targetList = normalizeRecipients(targetRaw || "");

    if (!targetList.length) {
      throw new Error(
        "Falta destinatario. Usa sendTestEmail(to) o define SMTP_TEST_TO/SMTP_USER."
      );
    }

    return this.sendHtml({
      to: targetList,
      subject: "Prueba SMTP - Sistema Grúas Thomas",
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.5">
          <h2>Correo de prueba</h2>
          <p>Si lees esto, el backend ya puede enviar correos por SMTP.</p>
          <p><b>Fecha:</b> ${new Date().toLocaleString("es-CL")}</p>
        </div>
      `,
      textFallback: `Correo de prueba SMTP - ${new Date().toLocaleString("es-CL")}`,
    });
  }
}
