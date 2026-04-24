// ✅ Archivo: src/auth/dto/update-user.dto.ts (COMPLETO)
// ✅ Cambio: rut sigue siendo opcional en update, PERO si viene debe ser string NO vacío
// ✅ Motivo: evitar que alguien deje rut="" y después no pueda loguear
// ✅ NUEVO: workerType contempla supervisor taller mecánico y supervisor de terreno
// ✅ NUEVO AHORA:
// - soporte workerTypesExtra WorkerType[]

import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  IsNotEmpty,
  IsArray,
} from "class-validator";
import { Role, Empresa, WorkerType } from "@prisma/client";

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  // opcional: si mandas password, se re-hashea
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  apellido?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  // =========================
  // empresa
  // =========================
  @IsOptional()
  @IsEnum(Empresa, {
    message: "empresa debe ser GRUAS_THOMAS o INSPROTEL",
  })
  empresa?: Empresa;

  // =========================
  // workerType principal
  // =========================
  @IsOptional()
  @IsEnum(WorkerType, {
    message:
      "workerType debe ser un valor válido del sistema, por ejemplo: CONDUCTOR, RIGGER, OPERADOR, MECANICO, ADQUISICIONES, JEFE_TALLER, SUPERVISOR, SUPERVISOR_TERRENO u OTRO",
  })
  workerType?: WorkerType;

  // =========================
  // workerTypesExtra
  // =========================
  @IsOptional()
  @IsArray()
  @IsEnum(WorkerType, {
    each: true,
    message:
      "workerTypesExtra debe contener valores válidos de WorkerType",
  })
  workerTypesExtra?: WorkerType[];

  // =========================
  // RUT
  // =========================
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "rut no puede ser vacío" })
  rut?: string;

  // ⚠️ No existen en Prisma → no se guardan
  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  cargo?: string;
}




