// ✅ Archivo: src/workshop/dto/update-workshop-task.dto.ts

import { Type } from "class-transformer";
import {
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
}