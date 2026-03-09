import { IsObject, IsOptional, IsString } from "class-validator";

type WorkerReportDetalleHoras = {
  salidaPlanta?: string;
  llegadaFaena?: string;

  // obra
  inicioServicioObra?: string;
  terminoServicioObra?: string;

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

type WorkerReportRecibiConforme = {
  nombre?: string;
  rut?: string;
  at?: string;
};

type WorkerReportSignature = {
  dataUrl?: string;
  signedAt?: string;
};

type WorkerReport = {
  movimientos?: string;
  detalleHoras?: WorkerReportDetalleHoras;
  recibiConforme?: WorkerReportRecibiConforme;
  signature?: WorkerReportSignature;
};

export class SaveWorkOrderDraftDto {
  @IsOptional()
  @IsObject()
  workerReport?: WorkerReport;

  @IsOptional()
  @IsString()
  comentarioFinal?: string;
}