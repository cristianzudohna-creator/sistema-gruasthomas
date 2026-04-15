// ✅ Archivo: src/workshop/dto/update-workshop-task.dto.ts

import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";
import {
  Empresa,
  WorkshopTaskPriority,
  WorkshopTaskStatus,
} from "@prisma/client";

export class UpdateWorkshopTaskDto {
  @IsOptional()
  @IsUUID()
  incidentId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsEnum(Empresa)
  empresa?: Empresa;

  @IsOptional()
  @IsUUID()
  createdById?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  // ✅ SOPORTE APOYOS
  @IsOptional()
  @IsArray()
  @IsUUID("all", { each: true })
  helperIds?: string[];

  @IsOptional()
  @IsUUID()
  closedById?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @IsOptional()
  @IsEnum(WorkshopTaskPriority)
  priority?: WorkshopTaskPriority;

  @IsOptional()
  @IsEnum(WorkshopTaskStatus)
  status?: WorkshopTaskStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diagnostico?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  trabajoRealizado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  observaciones?: string;

  // ✅ problema libre del repuesto
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  problemaRepuesto?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  actualCost?: number;

  // ✅ compatibilidad anterior
  @IsOptional()
  @IsString()
  fotoEvidencia?: string;

  // ✅ NUEVO: foto base64 para editar evidencia desde frontend actual
  @IsOptional()
  @IsString()
  foto?: string;

  // ✅ NUEVO: nombre original/virtual del archivo
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fotoNombre?: string;
}