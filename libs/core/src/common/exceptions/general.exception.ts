import { HttpException, HttpExceptionOptions, HttpStatus } from '@nestjs/common';

type IGeneralExceptionDto = {
  callClass: string;
  callMethod: string;
  message: string;
  status?: number;
  originalError?: Error;
};

export class GeneralException extends HttpException {
  private readonly callClass: string;
  private callMethod: string;

  constructor(dto: IGeneralExceptionDto) {
    const { callClass, callMethod, message, status, originalError } = dto;
    const response = { callClass, callMethod, message };
    const statusCode = status || HttpStatus.INTERNAL_SERVER_ERROR;
    const options: HttpExceptionOptions | undefined = originalError
      ? { cause: originalError }
      : undefined;

    super(response, statusCode, options);
    this.callClass = callClass;
    this.callMethod = callMethod;
  }

  get CallClass(): string {
    return this.callClass;
  }

  get CallMethod(): string {
    return this.callMethod;
  }

  set CallMethod(value: string) {
    this.callMethod = value;
  }

  getCalledFrom(): string {
    return `${this.callClass}.${this.callMethod}`;
  }
}
