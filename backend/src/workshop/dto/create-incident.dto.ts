// ✅ Archivo: src/workshop/dto/create-incident.dto.ts
// ✅ Simplificado para OPERADOR / RIGGER
// - patente
// - descripción
// - ubicación opcional
// - type se asignará automáticamente en backend como OTRO

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
}