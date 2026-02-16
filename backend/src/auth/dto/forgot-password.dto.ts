import { IsEmail } from "class-validator";

export class ForgotPasswordDto {
  @IsEmail({}, { message: "Correo inválido" })
  email: string;
}
