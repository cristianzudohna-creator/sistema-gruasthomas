// ✅ Archivo: src/auth/dto/change-password.dto.ts (COMPLETO)
// ✅ FIX: currentPassword ya NO es obligatorio
// ✅ Mantiene validación de newPassword

import { IsString, MinLength, IsOptional } from "class-validator";

export class ChangePasswordDto {
  // ❌ YA NO obligatorio
  @IsOptional()
  @IsString()
  currentPassword?: string;

  // ✅ nueva contraseña obligatoria
  @IsString()
  @MinLength(8, {
    message: "La nueva contraseña debe tener al menos 8 caracteres",
  })
  newPassword: string;
}