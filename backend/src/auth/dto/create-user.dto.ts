// ✅ Archivo: src/auth/dto/create-user.dto.ts (COMPLETO)
// ✅ Cambio: rut ahora es OBLIGATORIO
// ✅ Motivo: todos ingresan con RUT
// ✅ FIX: mensaje de workerType actualizado para incluir supervisor taller mecánico y supervisor de terreno
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

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  apellido: string;

  // ✅ RUT AHORA OBLIGATORIO
  @IsString()
  @IsNotEmpty({ message: "El RUT es obligatorio" })
  rut: string;

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
      "workerType debe ser un valor válido del sistema, por ejemplo: CONDUCTOR, RIGGER, OPERADOR, MECANICO, JEFE_TALLER, SUPERVISOR, SUPERVISOR_TERRENO u OTRO",
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

  // ⚠️ No existen en Prisma → no se guardan
  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  cargo?: string;
}




