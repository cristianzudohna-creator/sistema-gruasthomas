import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ClientsService } from "./clients.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Role } from "@prisma/client";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

@Controller("clients")
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  // ✅ FIX: resolver role de forma robusta
  private getRole(req: any): string {
    const user = req?.user || {};

    const direct =
      user?.role ||
      user?.rol ||
      user?.userRole ||
      "";

    if (typeof direct === "string" && direct.trim()) {
      return direct.trim().toUpperCase();
    }

    const roles = user?.roles || user?.authorities || user?.permissions;
    if (Array.isArray(roles) && roles.length > 0) {
      return String(roles[0]).trim().toUpperCase();
    }

    return "";
  }

  private isAdmin(role?: string) {
    const r = String(role || "").toUpperCase();
    return (
      r === String(Role.SUPERADMIN) ||
      r === String(Role.CONTROL_FLOTA) ||
      r === String(Role.ADMINISTRADORA)
    );
  }

  @Get()
  async list(
    @Req() req: any,
    @Query("search") search?: string,
    @Query("take") take?: string,
    @Query("limit") limit?: string
  ) {
    const role = this.getRole(req);
    if (!this.isAdmin(role)) {
      throw new ForbiddenException("No autorizado.");
    }

    // ✅ compat: frontend puede mandar take o limit
    const finalTake = take ?? limit;

    return this.service.list(req.user, search, finalTake);
  }

  @Get(":id")
  async get(@Req() req: any, @Param("id") id: string) {
    const role = this.getRole(req);
    if (!this.isAdmin(role)) {
      throw new ForbiddenException("No autorizado.");
    }
    if (!id) throw new BadRequestException("Falta id");

    return this.service.getById(id, req.user);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateClientDto) {
    const role = this.getRole(req);
    if (!this.isAdmin(role)) {
      throw new ForbiddenException("No autorizado.");
    }

    return this.service.create(dto, req.user);
  }

  @Patch(":id")
  async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateClientDto
  ) {
    const role = this.getRole(req);
    if (!this.isAdmin(role)) {
      throw new ForbiddenException("No autorizado.");
    }
    if (!id) throw new BadRequestException("Falta id");

    return this.service.update(id, dto, req.user);
  }

  @Delete(":id")
  async remove(@Req() req: any, @Param("id") id: string) {
    const role = this.getRole(req);
    if (!this.isAdmin(role)) {
      throw new ForbiddenException("No autorizado.");
    }
    if (!id) throw new BadRequestException("Falta id");

    return this.service.remove(id, req.user);
  }
}

