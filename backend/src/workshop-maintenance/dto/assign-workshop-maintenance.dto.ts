import { IsUUID } from "class-validator";

export class AssignWorkshopMaintenanceDto {
  @IsUUID()
  assignedToId!: string;
}