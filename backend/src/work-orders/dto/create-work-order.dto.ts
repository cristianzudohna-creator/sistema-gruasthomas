// ✅ Archivo: src/work-orders/dto/create-work-order.dto.ts (COMPLETO)

import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ArrayUnique,
  IsIn,
  IsUUID,
  IsDateString,
} from "class-validator";

export const DIAS_TRABAJO_VALIDOS = [
  "LUN",
  "MAR",
  "MIE",
  "JUE",
  "VIE",
  "SAB",
  "DOM",
] as const;

export type DiaTrabajo = (typeof DIAS_TRABAJO_VALIDOS)[number];

// ✅ Empresas válidas (ajusta si tienes más)
export const EMPRESAS_VALIDAS = ["GRUAS_THOMAS", "INSPROTEL"] as const;
export type EmpresaDto = (typeof EMPRESAS_VALIDAS)[number];

export class CreateWorkOrderDto {
  // =========================================
  // ✅ EMPRESA (CLAVE PARA SUPERADMIN)
  // - Si el usuario logueado no tiene empresa (SUPERADMIN),
  //   se usará dto.empresa para crear OT.
  // =========================================
  @IsOptional()
  @IsString()
  @IsIn(EMPRESAS_VALIDAS as any)
  empresa?: EmpresaDto;

  // =========================================
  // ✅ Relación a Cliente (tabla Client)
  // =========================================
  @IsOptional()
  @IsUUID()
  clientId?: string;

  // =========================================
  // Cliente (registro manual)
  // =========================================
  @IsOptional()
  @IsString()
  cliente?: string;

  @IsOptional()
  @IsString()
  rut?: string;

  // ✅ NUEVO: Solicitado por (Sr.)
  @IsOptional()
  @IsString()
  solicitadoPor?: string;

  @IsOptional()
@IsString()
telefonoSolicitadoPor?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  comuna?: string;

  @IsOptional()
  @IsString()
  ciudad?: string;

  // ✅ NUEVO: Teléfono (guardar en BD)
  @IsOptional()
  @IsString()
  telefonoCliente?: string;

  // ✅ NUEVO: Dirección de la faena
  @IsOptional()
  @IsString()
  direccionFaena?: string;

  // =========================================
  // Ubicación
  // =========================================
  @IsOptional()
  @IsString()
  lugar?: string;

  @IsOptional()
  @IsString()
  horario?: string;

  @IsOptional()
  @IsString()
  mapsLink?: string;

  // =========================================
  // Equipo
  // =========================================
  @IsOptional()
  @IsString()
  camion?: string;

  @IsOptional()
  @IsString()
  conductor?: string;

  // ✅ CLAVE: ID del conductor (assignedToId)
  @IsOptional()
  @IsUUID()
  conductorId?: string;

  @IsOptional()
  @IsString()
  operador?: string;

  @IsOptional()
  @IsString()
  rigger?: string;

  @IsOptional()
  @IsBoolean()
  sinJib?: boolean;

  // =========================================
  // ✅ Días de trabajo (compat)
  // =========================================
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(DIAS_TRABAJO_VALIDOS as any, { each: true })
  diasTrabajo?: DiaTrabajo[];

  // =========================================
  // ✅ NUEVO: Días programados (calendario)
  // - Array de fechas ISO: ["2026-02-19", "2026-02-20", ...]
  // =========================================
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsDateString({}, { each: true })
  diasProgramados?: string[];

  // =========================================
  // Nota
  // =========================================
  @IsOptional()
  @IsString()
  nota?: string;
}





