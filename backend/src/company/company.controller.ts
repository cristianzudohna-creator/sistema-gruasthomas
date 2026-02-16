import { Body, Controller, Get, Put, Req } from "@nestjs/common";
import { CompanyService } from "./company.service";

@Controller("company")
export class CompanyController {
  constructor(private service: CompanyService) {}

  @Get("me")
  async getMe(@Req() req: any) {
    // Asumimos que tu auth ya pone el user en req.user
    return this.service.getMyCompany(req.user);
  }

  @Put("me")
  async updateMe(@Req() req: any, @Body() body: any) {
    return this.service.updateMyCompany(req.user, body);
  }
}
