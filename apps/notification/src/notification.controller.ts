import { Public } from '@app/auth/decorators/public.decorator';
import { Controller, Get } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('/')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Public()
  @Get('/')
  getHello(): string {
    return this.notificationService.getHello();
  }
}
