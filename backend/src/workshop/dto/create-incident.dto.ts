// ✅ Archivo: src/workshop/dto/create-incident.dto.ts
// ✅ Simplificado para OPERADOR / RIGGER / PREVENCION
// ✅ MEJORADO:
// - soporte de foto base64
// - nombre de archivo
// - listo para edición posterior
// ✅ NUEVO AHORA:
// - soporte para múltiples fotos
// - mantiene compatibilidad total con foto/fotoNombre

import {
  IsArray,
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

  // ✅ COMPATIBILIDAD ACTUAL:
  // foto principal en base64
  @IsOptional()
  @IsString()
  foto?: string;

  // ✅ COMPATIBILIDAD ACTUAL:
  // nombre archivo principal
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fotoNombre?: string;

  // ✅ NUEVO:
  // múltiples fotos base64
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fotos?: string[];

  // ✅ NUEVO:
  // nombres múltiples
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fotosNombres?: string[];
}