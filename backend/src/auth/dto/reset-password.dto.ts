import { IsString, MinLength, IsNotEmpty } from "class-validator";

export class ResetPasswordDto {
  @IsString({ message: "RUT inválido" })
  @IsNotEmpty({ message: "El RUT es obligatorio" })
  rut: string;

  @IsString({ message: "Código inválido" })
  @IsNotEmpty({ message: "El código es obligatorio" })
  code: string;

  @IsString()
  @MinLength(8, { message: "La contraseña debe tener al menos 8 caracteres" })
  newPassword: string;
}
