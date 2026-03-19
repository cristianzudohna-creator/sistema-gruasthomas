// ✅ Archivo: src/workshop/dto/update-incident.dto.ts

import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";
import {
  Empresa,
  VehicleIncidentSeverity,
  VehicleIncidentStatus,
  VehicleIncidentType,
} from "@prisma/client";

export class UpdateIncidentDto {
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsUUID()
  reportedById?: string;

  @IsOptional()
  @IsEnum(Empresa)
  empresa?: Empresa;

  @IsOptional()
  @IsEnum(VehicleIncidentType)
  type?: VehicleIncidentType;

  @IsOptional()
  @IsEnum(VehicleIncidentSeverity)
  severity?: VehicleIncidentSeverity;

  @IsOptional()
  @IsEnum(VehicleIncidentStatus)
  status?: VehicleIncidentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  ubicacionTexto?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  kilometraje?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  horometro?: number;
}