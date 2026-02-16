import { IsIn, IsOptional, IsString } from "class-validator";

// ✅ Empresas válidas (ajusta si tienes más)
export const EMPRESAS_VALIDAS = ["GRUAS_THOMAS", "INSPROTEL"] as const;
export type EmpresaDto = (typeof EMPRESAS_VALIDAS)[number];

export class CreateClientDto {
  // ✅ Para SUPERADMIN/CONTROL_FLOTA (ADMINISTRADORA se ignora)
  @IsOptional()
  @IsString()
  @IsIn(EMPRESAS_VALIDAS as any)
  empresa?: EmpresaDto;

  @IsString()
  nombre!: string;

  @IsOptional()
  @IsString()
  rut?: string;

  @IsOptional()
  @IsString()
  giro?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  comuna?: string;

  @IsOptional()
  @IsString()
  ciudad?: string;
}

