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

  private isAdmin(role?: Role) {
    return [Role.SUPERADMIN, Role.CONTROL_FLOTA, Role.ADMINISTRADORA].includes(role as any);
  }

  @Get()
  async list(@Req() req: any, @Query("search") search?: string, @Query("take") take?: string) {
    const role = req.user?.role as Role | undefined;
    if (!this.isAdmin(role)) throw new ForbiddenException("No autorizado.");

    return this.service.list(req.user, search, take);
  }

  @Get(":id")
  async get(@Req() req: any, @Param("id") id: string) {
    const role = req.user?.role as Role | undefined;
    if (!this.isAdmin(role)) throw new ForbiddenException("No autorizado.");
    if (!id) throw new BadRequestException("Falta id");

    return this.service.getById(id, req.user);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateClientDto) {
    const role = req.user?.role as Role | undefined;
    if (!this.isAdmin(role)) throw new ForbiddenException("No autorizado.");

    return this.service.create(dto, req.user);
  }

  @Patch(":id")
  async update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateClientDto) {
    const role = req.user?.role as Role | undefined;
    if (!this.isAdmin(role)) throw new ForbiddenException("No autorizado.");
    if (!id) throw new BadRequestException("Falta id");

    return this.service.update(id, dto, req.user);
  }

  @Delete(":id")
  async remove(@Req() req: any, @Param("id") id: string) {
    const role = req.user?.role as Role | undefined;
    if (!this.isAdmin(role)) throw new ForbiddenException("No autorizado.");
    if (!id) throw new BadRequestException("Falta id");

    return this.service.remove(id, req.user);
  }
}

