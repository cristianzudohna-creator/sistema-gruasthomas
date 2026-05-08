import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CompleteWorkshopMaintenanceDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  kilometraje?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  horas?: number;

  @IsOptional()
  @IsString()
  fecha?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trabajosRealizados?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  repuestosLubricantes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  codigosFiltros?: string[];

  @IsOptional()
  @IsString()
  observaciones?: string;
}