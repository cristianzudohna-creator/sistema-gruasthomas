// ✅ Archivo: src/auth/dto/create-user.dto.ts
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { Role, Empresa, WorkerType } from "@prisma/client";

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  nombre: string;

  @IsString()
  apellido: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  // =========================
  // ✅ empresa (OPCIONAL en DTO)
  // - porque SUPERADMIN no lleva empresa
  // - la validación "obligatoria para otros roles" la hace el service
  // =========================
  @IsOptional()
  @IsEnum(Empresa, {
    message: "empresa debe ser GRUAS_THOMAS o INSPROTEL",
  })
  empresa?: Empresa;

  // =========================
  // ✅ NUEVO: workerType (OPCIONAL)
  // - solo aplica si role === TRABAJADOR
  // - validación final la hace el service
  // =========================
  @IsOptional()
  @IsEnum(WorkerType, {
    message: "workerType debe ser CONDUCTOR, RIGGER, OPERADOR, MECANICO u OTRO",
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




