import { IsString, IsNotEmpty } from "class-validator";

export class ForgotPasswordDto {
  @IsString({ message: "RUT inválido" })
  @IsNotEmpty({ message: "El RUT es obligatorio" })
  rut: string;
}
