// ✅ Archivo: src/auth/dto/update-user.dto.ts (COMPLETO)
// ✅ Cambio: rut sigue siendo opcional en update, PERO si viene debe ser string NO vacío
// ✅ Motivo: evitar que alguien deje rut="" y después no pueda loguear

import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  IsNotEmpty,
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
  // ✅ RUT (si viene, no puede ser vacío)
  // =========================
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "rut no puede ser vacío" })
  rut?: string;

  // ⚠️ No existen en Prisma → no se guardan (puedes borrarlos si quieres)
  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  cargo?: string;
}




