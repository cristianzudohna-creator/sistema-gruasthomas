// ✅ Archivo: src/workshop/dto/create-incident.dto.ts
// ✅ Simplificado para OPERADOR / RIGGER / PREVENCION
// ✅ MEJORADO:
// - soporte de foto base64
// - nombre de archivo
// - listo para edición posterior

import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { Empresa } from "@prisma/client";

export class CreateIncidentDto {
  @IsString()
  @MaxLength(20)
  patente: string;

  @IsUUID()
  reportedById: string;

  @IsEnum(Empresa)
  empresa: Empresa;

  @IsString()
  @MaxLength(2000)
  descripcion: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  ubicacionTexto?: string;

  // ✅ FOTO BASE64 (igual que update)
  @IsOptional()
  @IsString()
  foto?: string;

  // ✅ NUEVO: nombre del archivo (para guardar mejor)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fotoNombre?: string;
}