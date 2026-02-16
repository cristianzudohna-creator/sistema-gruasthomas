import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ============================
  // CORS
  // ============================
  app.enableCors({
    origin: "http://localhost:5173",
    credentials: true,
  });

  // ============================
  // Carpetas necesarias
  // ============================
  const uploadsBase = join(process.cwd(), "uploads");

  const folders = [
    "horometer",
    "vehicle-docs",
    "vehicle-maint",

    // ✅ NUEVO: OTs (fotos + firma) y branding (logo)
    "work-orders",
    "branding",
  ];

  for (const folder of folders) {
    const dir = join(uploadsBase, folder);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // ============================
  // Servir archivos estáticos
  // ============================
  app.useStaticAssets(uploadsBase, {
    prefix: "/uploads/",
  });

  await app.listen(3000);
  console.log("🚀 Backend corriendo en http://localhost:3000");
}

bootstrap();



