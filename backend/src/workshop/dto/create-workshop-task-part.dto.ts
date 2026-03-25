// ✅ Archivo: src/workshop/dto/create-workshop-task-part.dto.ts

import { Type } from "class-transformer";
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

export class CreateWorkshopTaskPartDto {
  @IsUUID()
  workshopTaskId: string;

  @IsString()
  @MaxLength(150)
  nombre: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costoUnitario?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costoTotal?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;

  // ✅ NUEVO: foto en base64
  @IsOptional()
  @IsString()
  @MaxLength(15_000_000)
  fotoDataUrl?: string;

  // ✅ NUEVO: nombre original archivo
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fotoNombre?: string;
}