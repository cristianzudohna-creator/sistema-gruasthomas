// ✅ Archivo: backend/src/quotations/quotations.service.ts

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Response } from "express";
import PDFDocument = require("pdfkit");
import * as fs from "fs";
import * as path from "path";

import { PrismaService } from "../prisma/prisma.service";

import {
  AuditAction,
  AuditEntity,
  Empresa,
  QuotationStatus,
  Role,
} from "@prisma/client";

@Injectable()
export class QuotationsService {
  constructor(private readonly prisma: PrismaService) {}

  private canManage(user: any) {
    return user?.role === Role.SUPERADMIN || user?.role === Role.ADMINISTRADORA;
  }

  private money(value: any) {
    const n = Number(value || 0);
    return Math.round(n).toLocaleString("es-CL");
  }

  private text(value: any, fallback = "") {
    const v = String(value ?? "").trim();
    return v || fallback;
  }

  private fmtDate(value: any) {
    const d = value ? new Date(value) : new Date();

    return d.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  private resolveLogoPath() {
    const possiblePaths = [
      path.join(process.cwd(), "uploads", "branding", "logo-thomas.png"),
      path.join(process.cwd(), "uploads", "logo-thomas.png"),
      path.join(process.cwd(), "public", "logo-thomas.png"),
      path.join(process.cwd(), "src", "assets", "logo-thomas.png"),
    ];

    return possiblePaths.find((p) => fs.existsSync(p));
  }

  private resolveTruckPath() {
    const possiblePaths = [
      path.join(
        process.cwd(),
        "uploads",
        "quotations-template",
        "camion-cotizacion.png",
      ),
      path.join(process.cwd(), "uploads", "branding", "camion-cotizacion.png"),
      path.join(process.cwd(), "uploads", "camion-cotizacion.png"),
    ];

    return possiblePaths.find((p) => fs.existsSync(p));
  }

  private resolveSignaturePath() {
    const possiblePaths = [
      path.join(process.cwd(), "uploads", "quotations-template", "firma.png"),
      path.join(process.cwd(), "uploads", "quotations-template", "firma.jpeg"),
      path.join(process.cwd(), "uploads", "quotations-template", "firma.jpg"),
    ];

    return possiblePaths.find((p) => fs.existsSync(p));
  }

  private resolveIconPath(name: string) {
    const possiblePaths = [
      path.join(process.cwd(), "uploads", "quotations-template", "icons", name),
      path.join(process.cwd(), "uploads", "quotations-template", "icon", name),
    ];

    return possiblePaths.find((p) => fs.existsSync(p));
  }

  private drawIcon(
    doc: PDFKit.PDFDocument,
    name: string,
    x: number,
    y: number,
    size = 11,
  ) {
    const iconPath = this.resolveIconPath(name);

    if (iconPath) {
      doc.image(iconPath, x, y, {
        width: size,
        height: size,
        fit: [size, size],
      });
    }
  }

  private labelValueRow(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    iconName: string,
    label: string,
    value: string,
    width = 250,
  ) {
    const blue = "#002b6c";
    const gray = "#d9e1ef";

    this.drawIcon(doc, iconName, x, y - 1, 12);

    doc
      .font("Helvetica-Bold")
      .fontSize(6.1)
      .fillColor(blue)
      .text(label.toUpperCase(), x + 20, y + 1, { width: 76 });

    doc
      .font("Helvetica")
      .fontSize(6.2)
      .fillColor("#111111")
      .text(this.text(value).toUpperCase(), x + 98, y + 1, {
        width,
        lineBreak: false,
        ellipsis: true,
      });

    doc
      .moveTo(x + 20, y + 13)
      .lineTo(x + 98 + width, y + 13)
      .lineWidth(0.4)
      .strokeColor(gray)
      .stroke();
  }

  async findAll(user: any) {
    if (!this.canManage(user)) {
      throw new ForbiddenException("No tienes permisos para ver cotizaciones");
    }

    return this.prisma.quotation.findMany({
      where: {
        activo: true,
        ...(user.role === Role.SUPERADMIN
          ? {}
          : user.empresa
            ? { empresa: user.empresa }
            : {}),
      },
      include: {
        client: true,
        items: { orderBy: { orden: "asc" } },
        createdBy: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: any) {
    if (!this.canManage(user)) {
      throw new ForbiddenException("No tienes permisos para ver cotizaciones");
    }

    const quotation = await this.prisma.quotation.findFirst({
      where: { id, activo: true },
      include: {
        client: true,
        items: { orderBy: { orden: "asc" } },
        createdBy: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
      },
    });

    if (!quotation) {
      throw new NotFoundException("Cotización no encontrada");
    }

    if (user.role !== Role.SUPERADMIN && quotation.empresa !== user.empresa) {
      throw new ForbiddenException("No puedes acceder a esta cotización");
    }

    return quotation;
  }

  async create(body: any, user: any) {
    if (!this.canManage(user)) {
      throw new ForbiddenException("No tienes permisos para crear cotizaciones");
    }

    const empresa =
      user.role === Role.SUPERADMIN
        ? body.empresa || Empresa.GRUAS_THOMAS
        : user.empresa || Empresa.GRUAS_THOMAS;

    const year = new Date().getFullYear();

    const lastQuotation = await this.prisma.quotation.findFirst({
      where: { anio: year },
      orderBy: { numero: "desc" },
    });

    const numero = lastQuotation ? lastQuotation.numero + 1 : 1;
    const items = Array.isArray(body.items) ? body.items : [];

    const normalizedItems = items.map((item: any) => {
      const cantidad = Number(item.cantidad || 1);
      const valorUnitario = Number(item.valorUnitario || 0);
      const total = Number(item.total || cantidad * valorUnitario);

      return { ...item, cantidad, valorUnitario, total };
    });

    const neto = normalizedItems.reduce((acc: number, item: any) => {
      return acc + Number(item.total || 0);
    }, 0);

    const iva = Math.round(neto * 0.19);
    const total = neto + iva;

    const quotation = await this.prisma.quotation.create({
      data: {
        empresa,
        numero,
        anio: year,
        status: body.status || QuotationStatus.BORRADOR,
        fecha: body.fecha ? new Date(body.fecha) : new Date(),
        clientId: body.clientId || null,

        senores: body.senores || "",
        rut: body.rut || null,
        giro: body.giro || null,
        direccion: body.direccion || null,
        comuna: body.comuna || null,
        ciudad: body.ciudad || null,
        atencion: body.atencion || null,
        contacto: body.contacto || null,
        condicionesPago: body.condicionesPago || null,

        equipoTitulo: body.equipoTitulo || null,
        equipoDescripcion: body.equipoDescripcion || "",

        atencionA: body.atencionA || null,
        obra: body.obra || null,
        equipo: body.equipo || null,
        cotizadoPor: body.cotizadoPor || null,

        horarioOperacionTitulo: body.horarioOperacionTitulo || null,
        horarioOperacionDetalle: body.horarioOperacionDetalle || null,

        observaciones: Array.isArray(body.observaciones)
          ? body.observaciones
          : [],

        neto,
        iva,
        total,

        createdById: user.id,

        items: {
          create: normalizedItems.map((item: any, index: number) => ({
            cantidad: Number(item.cantidad || 1),
            detalleTitulo: item.detalleTitulo || "",
            detalleDescripcion: item.detalleDescripcion || null,
            valorUnitario: Number(item.valorUnitario || 0),
            total: Number(item.total || 0),
            orden: index,
          })),
        },
      },
      include: {
        client: true,
        items: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        entity: AuditEntity.QUOTATION,
        entityId: quotation.id,
        action: AuditAction.CREATE,
        actorId: user.id,
        actorEmail: user.email,
        data: {
          quotationId: quotation.id,
          numero: quotation.numero,
          anio: quotation.anio,
        },
      },
    });

    return quotation;
  }

  async update(id: string, body: any, user: any) {
  if (!this.canManage(user)) {
    throw new ForbiddenException(
      "No tienes permisos para editar cotizaciones",
    );
  }

  const quotation = await this.prisma.quotation.findUnique({
    where: { id },
    include: {
      items: true,
    },
  });

  if (!quotation) {
    throw new NotFoundException("Cotización no encontrada");
  }

  if (
    user.role !== Role.SUPERADMIN &&
    quotation.empresa !== user.empresa
  ) {
    throw new ForbiddenException(
      "No puedes editar esta cotización",
    );
  }

  const items = Array.isArray(body.items)
    ? body.items
    : [];

  const normalizedItems = items.map((item: any) => {
    const cantidad = Number(item.cantidad || 1);
    const valorUnitario = Number(item.valorUnitario || 0);
    const total = Number(
      item.total || cantidad * valorUnitario,
    );

    return {
      ...item,
      cantidad,
      valorUnitario,
      total,
    };
  });

  const neto = normalizedItems.reduce(
    (acc: number, item: any) => {
      return acc + Number(item.total || 0);
    },
    0,
  );

  const iva = Math.round(neto * 0.19);
  const total = neto + iva;

  await this.prisma.quotationItem.deleteMany({
    where: {
      quotationId: id,
    },
  });

  const updated = await this.prisma.quotation.update({
    where: { id },

    data: {
      status:
        body.status ||
        quotation.status ||
        QuotationStatus.BORRADOR,

      fecha: body.fecha
        ? new Date(body.fecha)
        : quotation.fecha,

      senores: body.senores || "",
      rut: body.rut || null,
      giro: body.giro || null,
      direccion: body.direccion || null,
      comuna: body.comuna || null,
      ciudad: body.ciudad || null,
      atencion: body.atencion || null,
      contacto: body.contacto || null,
      condicionesPago:
        body.condicionesPago || null,

      equipoTitulo:
        body.equipoTitulo || null,

      equipoDescripcion:
        body.equipoDescripcion || "",

      atencionA: body.atencionA || null,

      obra: body.obra || null,

      equipo: body.equipo || null,

      cotizadoPor:
        body.cotizadoPor || null,

      horarioOperacionTitulo:
        body.horarioOperacionTitulo || null,

      horarioOperacionDetalle:
        body.horarioOperacionDetalle || null,

      observaciones: Array.isArray(
        body.observaciones,
      )
        ? body.observaciones
        : [],

      neto,
      iva,
      total,

      items: {
        create: normalizedItems.map(
          (item: any, index: number) => ({
            cantidad: Number(
              item.cantidad || 1,
            ),

            detalleTitulo:
              item.detalleTitulo || "",

            detalleDescripcion:
              item.detalleDescripcion ||
              null,

            valorUnitario: Number(
              item.valorUnitario || 0,
            ),

            total: Number(
              item.total || 0,
            ),

            orden: index,
          }),
        ),
      },
    },

    include: {
      client: true,
      items: true,
    },
  });

  await this.prisma.auditLog.create({
    data: {
      entity: AuditEntity.QUOTATION,
      entityId: updated.id,
      action: AuditAction.UPDATE,
      actorId: user.id,
      actorEmail: user.email,

      data: {
        quotationId: updated.id,
        numero: updated.numero,
        anio: updated.anio,
      },
    },
  });

  return updated;
}

  async generatePdf(id: string, user: any, res: Response) {
    const quotation = await this.findOne(id, user);

    const doc = new PDFDocument({
      size: "LETTER",
      margin: 0,
      bufferPages: false,
      autoFirstPage: true,
    });

    const blue = "#002b6c";
    const lightBlue = "#eaf1fb";
    const border = "#8fa6c8";
    const text = "#111111";

    const filename = `cotizacion-${quotation.numero}-${quotation.anio}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    doc.pipe(res);

    const logoPath = this.resolveLogoPath();
    const truckPath = this.resolveTruckPath();

    const drawPageBorder = () => {
      doc
        .roundedRect(12, 12, 588, 760, 3)
        .lineWidth(0.7)
        .strokeColor(border)
        .stroke();
    };

    const addNewPage = () => {
      doc.addPage();
      drawPageBorder();
    };

    const drawFooter = (footerY: number) => {
      doc.roundedRect(18, footerY, 576, 34, 3).fill(blue);

      this.drawIcon(doc, "ubicacionblanco.png", 32, footerY + 8, 9);
      this.drawIcon(doc, "telefonoblanco.png", 244, footerY + 8, 9);
      this.drawIcon(doc, "whatsapp.png", 386, footerY + 8, 9);
      this.drawIcon(doc, "webblanco.png", 166, footerY + 22, 9);
      this.drawIcon(doc, "correoblanco.png", 316, footerY + 22, 9);

      doc
        .font("Helvetica")
        .fontSize(6.6)
        .fillColor("#ffffff")
        .text("Av. Lo Errazuriz 7080 - Cerrillos, Santiago", 45, footerY + 8, {
          width: 190,
        })
        .text("Fono: (562) 2261 10 00", 257, footerY + 8, {
          width: 125,
        })
        .text("+569 44483086 ", 400, footerY + 8, {
          width: 175,
        });

      doc
        .font("Helvetica-Bold")
        .fontSize(6.8)
        .fillColor("#ffffff")
        .text("www.gruasthomas.cl", 180, footerY + 22, {
          width: 130,
        })
        .text("info@gruasthomas.cl", 330, footerY + 22, {
          width: 130,
        });
    };

    drawPageBorder();

    if (logoPath) {
      doc.image(logoPath, 50, 20, {
        width: 100,
      });
    } else {
      doc
        .font("Helvetica-Bold")
        .fontSize(38)
        .fillColor(text)
        .text("Thomas", 24, 32);
    }

    if (truckPath) {
      doc.image(truckPath, 230, 20, {
        width: 220,
      });
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(8.8)
      .fillColor(blue)
      .text("SOCIEDAD TRANSPORTES THOMAS LIMITADA", 22, 116, {
        width: 270,
      });

    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor(text)
      .text("RUT:", 22, 132)
      .font("Helvetica")
      .text("76.030.114-0", 50, 132);

    doc
      .font("Helvetica-Bold")
      .text("GIRO:", 22, 146)
      .font("Helvetica")
      .text("TRANSPORTE DE CARGA POR CARRETERA", 52, 146, {
        width: 260,
      });

    doc.roundedRect(455, 42, 122, 98, 5).fillAndStroke("#ffffff", border);
    doc.rect(455, 42, 122, 27).fill(blue);

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#ffffff")
      .text("COTIZACIÓN N°", 455, 51, {
        width: 122,
        align: "center",
      });

    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(text)
      .text(`${quotation.numero}/${quotation.anio}`, 455, 82, {
        width: 122,
        align: "center",
      });

    doc
      .moveTo(455, 105)
      .lineTo(577, 105)
      .lineWidth(0.6)
      .strokeColor(border)
      .stroke();

    this.drawIcon(doc, "calendario.png", 464, 116, 12);

    doc
      .font("Helvetica-Bold")
      .fontSize(6.8)
      .fillColor(blue)
      .text("FECHA:", 482, 116);

    doc
      .font("Helvetica")
      .fontSize(6.3)
      .fillColor(text)
      .text(`Santiago, ${this.fmtDate(quotation.fecha)}`, 512, 116, {
        width: 55,
        align: "center",
      });

    const infoTop = 160;

    doc.roundedRect(18, infoTop, 576, 75, 5).fillAndStroke("#ffffff", border);

    doc
      .moveTo(310, infoTop + 5)
      .lineTo(310, infoTop + 63)
      .lineWidth(0.55)
      .strokeColor(border)
      .stroke();

    this.labelValueRow(
      doc,
      30,
      infoTop + 7,
      "personas.png",
      "SEÑORES",
      quotation.senores,
      172,
    );

    this.labelValueRow(
      doc,
      30,
      infoTop + 24,
      "ubicacion.png",
      "DIRECCIÓN",
      quotation.direccion || "",
      172,
    );

    this.labelValueRow(
      doc,
      30,
      infoTop + 41,
      "rut.png",
      "R.U.T.",
      quotation.rut || "",
      172,
    );

    this.labelValueRow(
      doc,
      30,
      infoTop + 58,
      "dinero.png",
      "CONDICIONES DE PAGO",
      quotation.condicionesPago || "TRANSFERENCIA ANTICIPADA",
      128,
    );

    this.labelValueRow(
      doc,
      330,
      infoTop + 7,
      "ubicacion.png",
      "COMUNA",
      quotation.comuna || "",
      150,
    );

    this.labelValueRow(
      doc,
      330,
      infoTop + 24,
      "ciudad.png",
      "CIUDAD",
      quotation.ciudad || "SANTIAGO",
      150,
    );

    this.labelValueRow(
      doc,
      330,
      infoTop + 41,
      "usuario.png",
      "ATENCION",
      quotation.atencion || "",
      150,
    );

    this.labelValueRow(
      doc,
      330,
      infoTop + 58,
      "telefono.png",
      "CONTACTO",
      quotation.contacto || "",
      150,
    );

    const equipos = String(quotation.equipoDescripcion || "")
      .split("|")
      .map((e) => e.trim())
      .filter(Boolean);

    const equipY = 240;
    const equipBoxHeight = 25;
    const equipGap = 6;

    equipos.forEach((equipo: string, index: number) => {
      const currentY = equipY + index * (equipBoxHeight + equipGap);

      doc.roundedRect(18, currentY, 576, equipBoxHeight, 3).fill(blue);

      this.drawIcon(doc, "camionblanco.png", 36, currentY + 5, 14);

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#ffffff")
        .text(`EQUIPO ${index + 1}:`, 72, currentY + 9, {
          width: 90,
        });

      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor("#ffffff")
        .text(equipo.toUpperCase(), 155, currentY + 9, {
          width: 400,
          lineBreak: false,
          ellipsis: true,
        });
    });

    const equiposHeight =
      equipos.length * equipBoxHeight + (equipos.length - 1) * equipGap;

    const tableX = 18;
    const tableY = equipY + equiposHeight + 10;
    const tableW = 576;
    const headerH = 21;
    const rowH = 28;

    const c1 = 62;
    const c2 = 330;
    const c3 = 115;
    const c4 = 69;

    doc.rect(tableX, tableY, tableW, headerH).fill(blue);

    doc
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .fillColor("#ffffff")
      .text("CANTIDAD", tableX, tableY + 7, { width: c1, align: "center" })
      .text("DETALLE", tableX + c1, tableY + 7, {
        width: c2,
        align: "center",
      })
      .text("VALOR UNITARIO", tableX + c1 + c2, tableY + 7, {
        width: c3,
        align: "center",
      })
      .text("TOTAL", tableX + c1 + c2 + c3, tableY + 7, {
        width: c4,
        align: "center",
      });

    let y = tableY + headerH;

    const rows = quotation.items;

    rows.forEach((item: any) => {
      if (y + rowH > 640) {
        addNewPage();

        y = 40;

        doc.rect(tableX, y, tableW, headerH).fill(blue);

        doc
          .font("Helvetica-Bold")
          .fontSize(6.5)
          .fillColor("#ffffff")
          .text("CANTIDAD", tableX, y + 7, {
            width: c1,
            align: "center",
          })
          .text("DETALLE", tableX + c1, y + 7, {
            width: c2,
            align: "center",
          })
          .text("VALOR UNITARIO", tableX + c1 + c2, y + 7, {
            width: c3,
            align: "center",
          })
          .text("TOTAL", tableX + c1 + c2 + c3, y + 7, {
            width: c4,
            align: "center",
          });

        y += headerH;
      }

      doc.rect(tableX, y, tableW, rowH).fillAndStroke("#ffffff", border);

      doc
        .moveTo(tableX + c1, y)
        .lineTo(tableX + c1, y + rowH)
        .strokeColor(border)
        .stroke();

      doc
        .moveTo(tableX + c1 + c2, y)
        .lineTo(tableX + c1 + c2, y + rowH)
        .strokeColor(border)
        .stroke();

      doc
        .moveTo(tableX + c1 + c2 + c3, y)
        .lineTo(tableX + c1 + c2 + c3, y + rowH)
        .strokeColor(border)
        .stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(text)
        .text(String(item.cantidad || ""), tableX, y + 9, {
          width: c1,
          align: "center",
        });

      doc
        .font("Helvetica-Bold")
        .fontSize(6.8)
        .fillColor(text)
        .text(
          this.text(item.detalleTitulo).toUpperCase(),
          tableX + c1 + 8,
          y + 5,
          {
            width: c2 - 14,
            lineBreak: false,
            ellipsis: true,
          },
        );

      doc
        .font("Helvetica")
        .fontSize(5.5)
        .text(
          this.text(item.detalleDescripcion).toUpperCase(),
          tableX + c1 + 8,
          y + 15,
          {
            width: c2 - 14,
            lineBreak: false,
            ellipsis: true,
          },
        );

      doc
        .font("Helvetica-Bold")
        .fontSize(7.7)
        .text(this.money(item.valorUnitario), tableX + c1 + c2, y + 10, {
          width: c3,
          align: "center",
        })
        .text(this.money(item.total), tableX + c1 + c2 + c3, y + 10, {
          width: c4,
          align: "center",
        });

      y += rowH;
    });

    let extraY = y + 5;

    if (extraY + 180 > 760) {
      addNewPage();
      extraY = 40;
    }

    doc.roundedRect(18, extraY, 282, 67, 3).fillAndStroke("#ffffff", border);

    doc.rect(18, extraY, 282, 16).fill(blue);

    doc
  .font("Helvetica-Bold")
  .fontSize(6.1)
  .fillColor("#ffffff")
  .text(
    this.text(
      quotation.horarioOperacionTitulo,
      "PARA HORAS EXTRAS TRABAJADAS SE APLICARÁ EL SIGUIENTE RECARGO:",
    ).toUpperCase(),
    24,
    extraY + 5,
  );

    const horarioTexto = this.text(
  quotation.horarioOperacionDetalle,
  "LUNES A VIERNES\n08:00 A 18:00 HRS.",
).toUpperCase();

const horarioLineas = horarioTexto
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

doc.font("Helvetica").fontSize(6.3).fillColor(text);

horarioLineas.slice(0, 6).forEach((line, index) => {
  doc.text(line, 27, extraY + 22 + index * 9.5, {
    width: 260,
  });
});

    const totalsX = 380;
    const totalsY = extraY;
    const totalsW = 214;
    const totalsH = 67;

    doc
      .roundedRect(totalsX, totalsY, totalsW, totalsH, 3)
      .fillAndStroke("#ffffff", border);

    const totalRows = [
      ["NETO", this.money(quotation.neto)],
      ["IVA", this.money(quotation.iva)],
      ["TOTAL", this.money(quotation.total)],
    ];

    totalRows.forEach((r, index) => {
      const rowHeight = totalsH / 3;
      const ry = totalsY + index * rowHeight;

      if (index === 2) {
        doc.rect(totalsX, ry, totalsW, rowHeight).fill(blue);
        doc.fillColor("#ffffff");
      } else {
        doc.fillColor(text);
      }

      doc
        .font("Helvetica-Bold")
        .fontSize(index === 2 ? 10.5 : 7.6)
        .text(r[0], totalsX + 35, ry + 7, {
          width: 70,
          align: "center",
        })
        .text(r[1], totalsX + 125, ry + 7, {
          width: 70,
          align: "right",
        });

      if (index < 2) {
        doc
          .moveTo(totalsX, ry + rowHeight)
          .lineTo(totalsX + totalsW, ry + rowHeight)
          .strokeColor(border)
          .stroke();
      }

      doc
        .moveTo(totalsX + 110, ry)
        .lineTo(totalsX + 110, ry + rowHeight)
        .strokeColor(border)
        .stroke();
    });

    const opY = extraY + 78;

    const opRows = [
      ["obra.png", "OBRA", quotation.obra || ""],
      ["rut.png", "COTIZADO POR", quotation.cotizadoPor || ""],
    ];

    const opX = 18;
    const opW = 576;
    const opH = 35;
    const opLeftW = 170;
    const opRowH = opH / 2;
    const opRightX = opX + opLeftW;

    doc.roundedRect(opX, opY, opW, opH, 3).fillAndStroke("#ffffff", border);

    opRows.forEach((r, index) => {
      const ry = opY + index * opRowH;

      doc.rect(opX, ry, opLeftW, opRowH).fill(lightBlue);

      this.drawIcon(doc, r[0], opX + 18, ry + 4, 9);

      doc
        .font("Helvetica-Bold")
        .fontSize(7.1)
        .fillColor(blue)
        .text(r[1], opX + 52, ry + 5.5, {
          width: opLeftW - 60,
        });

      doc
        .font("Helvetica")
        .fontSize(6.8)
        .fillColor(text)
        .text(this.text(r[2]).toUpperCase(), opRightX + 18, ry + 5.5, {
          width: opW - opLeftW - 28,
          lineBreak: false,
          ellipsis: true,
        });
    });

    doc
      .moveTo(opRightX, opY)
      .lineTo(opRightX, opY + opH)
      .strokeColor(border)
      .lineWidth(0.6)
      .stroke();

    doc
      .moveTo(opX, opY + opRowH)
      .lineTo(opX + opW, opY + opRowH)
      .strokeColor(border)
      .lineWidth(0.6)
      .stroke();

    doc
      .roundedRect(opX, opY, opW, opH, 3)
      .lineWidth(0.7)
      .strokeColor(border)
      .stroke();

    const footerY = 725;

    // ============================
    // FIRMA ARRIBA DE OBSERVACIONES
    // ============================
    const firmaY = opY + 68;
    const signaturePath = this.resolveSignaturePath();

    if (signaturePath) {
      doc.image(signaturePath, 260, firmaY - 22, {
        width: 70,
      });
    }

    doc
      .moveTo(220, firmaY)
      .lineTo(375, firmaY)
      .strokeColor(border)
      .lineWidth(0.8)
      .stroke();

    doc
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor(blue)
      .text("AUTORIZA", 220, firmaY + 5, {
        width: 155,
        align: "center",
      });

    doc
      .font("Helvetica-Bold")
      .fontSize(6.4)
      .fillColor(text)
      .text(
        this.text(quotation.cotizadoPor, "MARGARITA NARANJO ROSSEL").toUpperCase(),
        220,
        firmaY + 15,
        {
          width: 155,
          align: "center",
        },
      );

    // ============================
    // OBSERVACIONES DEBAJO DE FIRMA
    // ============================
    let obsY = firmaY + 42;

    if (obsY + 95 > footerY - 8) {
      addNewPage();
      obsY = 40;
    }

    doc.roundedRect(18, obsY, 576, 95, 3).fillAndStroke("#ffffff", border);

    doc.rect(18, obsY, 120, 16).fill(blue);

    this.drawIcon(doc, "alertablanco.png", 26, obsY + 3, 9);

    doc
      .font("Helvetica-Bold")
      .fontSize(6.7)
      .fillColor("#ffffff")
      .text("OBSERVACIONES:", 42, obsY + 5);

    const defaultObservaciones = [
      "SE CONSIDERARÁN PARA COBRO LOS HORARIOS DESDE QUE EL EQUIPO SALE DE NUESTRAS INSTALACIONES HASTA SU REGRESO.",
      "SE SOLICITA EXPRESAMENTE INFORMAR CON 24 HORAS HÁBILES DE ANTICIPACIÓN A LA HORA PROGRAMADA PARA LLEGADA A OBRA, EN CASO DE ANULACIÓN O CAMBIO DE FECHA PARA EL SERVICIO. DE OTRO MODO EL COBRO SE REALIZARÁ COMO SI SE HUBIESE EFECTUADO EN SU TOTALIDAD.",
      "VALOR HORA SERÁ REAJUSTADO CADA 6 MESES POR DESGASTE DE EQUIPOS.",
      "CONSIDERAR LEY 18.528 PARA TRASLADO DE ESTRUCTURAS, CONTENEDORES O CUALQUIER OTRO TIPO DE CARGA.",
      "CUALQUIER TRASLADO FUERA DE OBRA (CONSIDERAR ANILLO DE AMERICO VESPUCIO) TENDRÁ UN COSTO ADICIONAL SEGÚN CONDICIONES DEL SERVICIO.",
    ];

    const observaciones =
      quotation.observaciones && quotation.observaciones.length > 0
        ? quotation.observaciones
        : defaultObservaciones;

    let obsTextY = obsY + 21;

    observaciones.slice(0, 5).forEach((obs: string, index: number) => {
      const obsText = this.text(obs).toUpperCase();

      doc
        .font("Helvetica")
        .fontSize(5.9)
        .fillColor(text)
        .text(`${index + 1}.-`, 26, obsTextY, {
          width: 18,
        })
        .text(obsText, 50, obsTextY, {
          width: 520,
          lineGap: 1,
        });

      const h = doc.heightOfString(obsText, {
        width: 520,
        lineGap: 0,
      });

      obsTextY += Math.min(Math.max(h + 2, 8), 15);
    });

    drawFooter(footerY);

    doc.end();
  }

  async remove(id: string, user: any) {
    if (!this.canManage(user)) {
      throw new ForbiddenException("No tienes permisos para eliminar cotizaciones");
    }

    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
    });

    if (!quotation) {
      throw new NotFoundException("Cotización no encontrada");
    }

    if (user.role !== Role.SUPERADMIN && quotation.empresa !== user.empresa) {
      throw new ForbiddenException("No puedes eliminar esta cotización");
    }

    await this.prisma.quotation.update({
      where: { id },
      data: {
        activo: false,
        deletedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        entity: AuditEntity.QUOTATION,
        entityId: quotation.id,
        action: AuditAction.DELETE,
        actorId: user.id,
        actorEmail: user.email,
      },
    });

    return { ok: true };
  }
}