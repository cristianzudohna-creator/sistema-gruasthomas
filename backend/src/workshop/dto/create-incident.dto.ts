// ✅ Archivo: src/workshop/dto/create-incident.dto.ts
// ✅ Simplificado para OPERADOR / RIGGER / PREVENCION
// ✅ NUEVO: foto opcional en base64
// - patente
// - descripción
// - ubicación opcional
// - empresa
// - reportedById
// - foto opcional

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

  // ✅ NUEVO: foto en base64
  @IsOptional()
  @IsString()
  foto?: string;
}