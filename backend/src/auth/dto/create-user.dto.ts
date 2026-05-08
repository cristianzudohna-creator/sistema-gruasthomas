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
  // ✅ EMAIL AHORA OPCIONAL
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  apellido: string;

  // ✅ RUT OBLIGATORIO
  @IsString()
  @IsNotEmpty({ message: "El RUT es obligatorio" })
  rut: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsEnum(Empresa, {
    message: "empresa debe ser GRUAS_THOMAS o INSPROTEL",
  })
  empresa?: Empresa;

  @IsOptional()
  @IsEnum(WorkerType)
  workerType?: WorkerType;

  @IsOptional()
  @IsArray()
  @IsEnum(WorkerType, { each: true })
  workerTypesExtra?: WorkerType[];

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  cargo?: string;
}




