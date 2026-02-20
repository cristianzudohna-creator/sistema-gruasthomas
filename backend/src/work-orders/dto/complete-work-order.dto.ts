import { IsBoolean, IsObject, IsOptional, IsString } from "class-validator";

type WorkerReportDetalleHoras = {
  salidaPlanta?: string;
  llegadaFaena?: string;

  // ✅ NUEVO OBRA
  inicioServicioObra?: string;   // "HH:MM"
  terminoServicioObra?: string;  // "HH:MM"

  salidaFaena?: string;
  llegadaPlanta?: string;

  colacion?: string | null;

  kmSalidaPlanta?: string | null;
  kmLlegadaFaena?: string | null;
  kmSalidaFaena?: string | null;
  kmLlegadaPlanta?: string | null;

  // legacy opcional
  kmSalida?: string | null;
  kmLlegada?: string | null;
};

type WorkerReport = {
  movimientos?: string;
  detalleHoras?: WorkerReportDetalleHoras;
  recibiConforme?: { nombre?: string; rut?: string; at?: string };
  signature?: { dataUrl?: string; signedAt?: string };
};

export class CompleteWorkOrderDto {
  @IsObject()
  workerReport: WorkerReport; // ✅ antes era any (sigue aceptando todo, pero queda documentado)

  @IsOptional()
  @IsString()
  comentarioFinal?: string;

  // opcional: si quieres que cambie el estado
  @IsOptional()
  @IsBoolean()
  marcarCompletada?: boolean;
}

