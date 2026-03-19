-- 1) Agregar el nuevo valor al enum WorkerType
ALTER TYPE "WorkerType" ADD VALUE IF NOT EXISTS 'ADQUISICIONES';

-- 2) Agregar columna codigo como nullable temporalmente
ALTER TABLE "WorkshopTask"
ADD COLUMN "codigo" TEXT;

-- 3) Rellenar las tareas existentes con códigos únicos
WITH ordered_tasks AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "WorkshopTask"
)
UPDATE "WorkshopTask" wt
SET "codigo" = 'TALLER-' || LPAD(ordered_tasks.rn::text, 4, '0')
FROM ordered_tasks
WHERE wt.id = ordered_tasks.id;

-- 4) Dejar la columna obligatoria
ALTER TABLE "WorkshopTask"
ALTER COLUMN "codigo" SET NOT NULL;

-- 5) Crear índice único
CREATE UNIQUE INDEX "WorkshopTask_codigo_key" ON "WorkshopTask"("codigo");

-- 6) Índice adicional
CREATE INDEX "WorkshopTask_codigo_idx" ON "WorkshopTask"("codigo");
