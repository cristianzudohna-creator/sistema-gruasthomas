// ✅ Archivo: src/workshop/dto/create-workshop-task.dto.ts

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

export class CreateWorkshopTaskDto {
  @IsOptional()
  @IsUUID()
  incidentId?: string;

  @IsUUID()
  vehicleId: string;

  @IsEnum(Empresa)
  empresa: Empresa;

  @IsUUID()
  createdById: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  helperIds?: string[];

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
  @MaxLength(2000)
  observaciones?: string;

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

  @IsOptional()
  @IsString()
  fotoIngreso?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fotoIngresoNombre?: string;

  // ✅ NUEVO: múltiples fotos de ingreso
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fotosIngreso?: string[];

  // ✅ NUEVO: nombres de múltiples fotos de ingreso
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fotosIngresoNombres?: string[];
}
