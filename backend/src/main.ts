import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // ============================
  // VALIDACIÓN GLOBAL
  // ============================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // ============================
  // CORS (LOCAL + PROD)
  // ============================
  const allowedOrigins = [
    "http://localhost:5173",
    process.env.FRONTEND_URL || "https://sistemagruasthomas.cl",
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // permite tools sin Origin (curl/postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
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

  await app.listen(3000, "0.0.0.0");
  console.log("🚀 Backend corriendo en puerto 3000");
}

bootstrap();



