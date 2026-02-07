import { LoggerService } from '@app/core/logger/logger.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationService {
  constructor(private readonly loggerService: LoggerService) {}

  getHello(): string {
    return 'Hello World!';
  }
}
