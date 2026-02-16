import { Controller, Post } from "@nestjs/common";
import { MailService } from "./mail.service";

@Controller("mail")
export class MailController {
  constructor(private readonly mail: MailService) {}

  // ✅ EXISTENTE: prueba SMTP simple
  @Post("test")
  async test() {
    return this.mail.sendTestEmail();
  }

  // ✅ NUEVO: prueba de correo de ALERTA (formato real)
  @Post("alert-test")
  async alertTest() {
    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.5">
        <h2>⚠️ Alerta de vencimiento (PRUEBA)</h2>

        <p>Los siguientes elementos están próximos a vencer:</p>

        <table cellpadding="8" cellspacing="0" border="1"
               style="border-collapse: collapse; width:100%; max-width:600px">
          <thead style="background:#f2f2f2">
            <tr>
              <th>Patente</th>
              <th>Tipo</th>
              <th>Documento / Mantención</th>
              <th>Vence</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>AB-CD-12</b></td>
              <td>Documento</td>
              <td>Revisión Técnica</td>
              <td>13/02/2026</td>
            </tr>
            <tr>
              <td><b>XY-ZW-89</b></td>
              <td>Mantención</td>
              <td>Cambio de aceite</td>
              <td>14/02/2026</td>
            </tr>
          </tbody>
        </table>

        <p style="margin-top:16px; font-size:12px; color:#666">
          Este es un correo de prueba. Los datos son ficticios.
        </p>
      </div>
    `;

    return this.mail.sendHtml({
      to: "controlflota@gruasthomas.cl",
      subject: "⚠️ Prueba alerta de vencimientos",
      html,
      textFallback:
        "Alerta de vencimientos: AB-CD-12 (Revisión Técnica), XY-ZW-89 (Cambio de aceite)",
    });
  }
}

