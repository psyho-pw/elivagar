import { Injectable } from '@nestjs/common';

@Injectable()
export class SayhoBotService {
  getHello(): string {
    return 'Hello World!';
  }
}
