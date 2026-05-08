import { IsString } from "class-validator";

export class SignWorkshopMaintenanceDto {
  @IsString()
  firmaDataUrl!: string;
}