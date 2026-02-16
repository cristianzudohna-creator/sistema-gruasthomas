// ✅ Archivo: src/auth/dto/update-user.dto.ts

import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
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
  // ✅ empresa (OPCIONAL)
  // - SUPERADMIN → null
  // - otros roles → validación real se hace en el service
  // =========================
  @IsOptional()
  @IsEnum(Empresa, {
    message: "empresa debe ser GRUAS_THOMAS o INSPROTEL",
  })
  empresa?: Empresa;

  // =========================
  // ✅ workerType (OPCIONAL)
  // - solo aplica si role === TRABAJADOR
  // - si no es TRABAJADOR → el service lo fuerza a null
  // =========================
  @IsOptional()
  @IsEnum(WorkerType, {
    message:
      "workerType debe ser CONDUCTOR, RIGGER, OPERADOR, MECANICO u OTRO",
  })
  workerType?: WorkerType;

  // =========================
  // Opcionales
  // =========================
  @IsOptional()
  @IsString()
  rut?: string;

  // ⚠️ No existen en Prisma → no se guardan (puedes borrarlos si quieres)
  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  cargo?: string;
}



