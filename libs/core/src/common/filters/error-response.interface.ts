import { HttpStatus } from '@nestjs/common';

export interface ErrorResponse {
  statusCode: HttpStatus;
  message: string;
  path: string;
  error: string;
  callClass?: string;
  callMethod?: string;
  stack?: string;
}
