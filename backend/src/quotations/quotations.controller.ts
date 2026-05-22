import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";

import type { Response } from "express";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { QuotationsService } from "./quotations.service";

@Controller("quotations")
@UseGuards(JwtAuthGuard)
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Get()
  async findAll(@Req() req: any) {
    return this.quotationsService.findAll(req.user);
  }

  @Get(":id/pdf")
  async generatePdf(
    @Param("id") id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    return this.quotationsService.generatePdf(id, req.user, res);
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @Req() req: any) {
    return this.quotationsService.findOne(id, req.user);
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    return this.quotationsService.create(body, req.user);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.quotationsService.update(id, body, req.user);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @Req() req: any) {
    return this.quotationsService.remove(id, req.user);
  }
}