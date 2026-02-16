import { Module, OnModuleInit } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

import { UsersModule } from "./users/users.module";
import { UsersService } from "./users/users.service";

import { AuthModule } from "./auth/auth.module";
import { VehiclesModule } from "./vehicles/vehicles.module";

// ✅ EXISTENTES
import { HorometerModule } from "./horometer/horometer.module";
import { CompanyModule } from "./company/company.module";

// ✅ ORDENES DE TRABAJO
import { WorkOrdersModule } from "./work-orders/work-orders.module";

// ✅ MAIL
import { MailModule } from "./mail/mail.module";

// ✅ ALERTAS
import { AlertsModule } from "./alerts/alerts.module";

// ✅ NUEVO CLIENTES
import { ClientsModule } from "./clients/clients.module";

// ✅ Scheduler / Cron
import { ScheduleModule } from "@nestjs/schedule";

@Module({
  imports: [
    ScheduleModule.forRoot(),

    AuthModule,
    UsersModule,
    VehiclesModule,
    HorometerModule,
    CompanyModule,
    WorkOrdersModule,
    MailModule,
    AlertsModule,

    // 🔥 AQUÍ
    ClientsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly usersService: UsersService) {}

  async onModuleInit() {
    // await this.usersService.ensureAdmin();
  }
}




