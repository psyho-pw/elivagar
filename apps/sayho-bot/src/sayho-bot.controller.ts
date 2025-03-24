import { Controller, Get } from "@nestjs/common";
import { SayhoBotService } from "./sayho-bot.service";

@Controller()
export class SayhoBotController {
  constructor(private readonly sayhoBotService: SayhoBotService) {}

  @Get()
  getHello(): string {
    return this.sayhoBotService.getHello();
  }
}
