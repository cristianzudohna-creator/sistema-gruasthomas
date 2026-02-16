import { IsBoolean, IsObject, IsOptional, IsString } from "class-validator";

export class CompleteWorkOrderDto {
  @IsObject()
  workerReport: any;

  @IsOptional()
  @IsString()
  comentarioFinal?: string;

  // opcional: si quieres que cambie el estado
  @IsOptional()
  @IsBoolean()
  marcarCompletada?: boolean;
}
