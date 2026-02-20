// ✅ Archivo: src/auth/dto/login.dto.ts (COMPLETO)
// ✅ Cambio: ahora login usa rut + password

import { IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  rut: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

