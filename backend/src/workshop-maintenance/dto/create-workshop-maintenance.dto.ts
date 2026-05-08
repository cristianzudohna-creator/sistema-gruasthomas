import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { Empresa } from "@prisma/client";

export class CreateWorkshopMaintenanceDto {
  @IsEnum(Empresa)
  empresa!: Empresa;

  @IsUUID()
  vehicleId!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}