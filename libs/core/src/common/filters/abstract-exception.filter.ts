import { Env } from '@app/core/constants/app.constant';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Request, Response } from 'express';
import { IConfigsService } from '../../configs/configs.interface';
import { LoggerService } from '../../logger/logger.service';
import { ErrorResponse } from './error-response.interface';

export abstract class AbstractExceptionFilter extends BaseExceptionFilter {
  protected abstract readonly configsService: IConfigsService;
  protected abstract readonly loggerService: LoggerService;

  constructor() {
    super();
  }

  async catch(exception: any, host: ArgumentsHost): Promise<Response<ErrorResponse>> {
    const env = this.configsService.AppConfig.env;
    const isProduction = env === Env.production;

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response: Response<ErrorResponse> = ctx.getResponse<Response>();

    const handledData = await this.handle(exception, host);
    const errorResponse: ErrorResponse = {
      statusCode: handledData.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR,
      message: handledData.message ?? exception.message,
      path: request.url,
      error: handledData.error ?? exception.name,
      callClass: handledData.callClass ?? exception.callClass,
      callMethod: handledData.callMethod ?? exception.callMethod,
      stack: handledData.stack ?? exception.stack,
    };

    const req = {
      method: request.method,
      url: request.url,
      query: request.query,
    };

    const responseTime = Date.now() - (request as any).startTime;
    const res = { status: errorResponse.statusCode, responseTime, headers: response.getHeaders() };

    if (errorResponse.statusCode >= 500) {
      this.loggerService.error(this.catch.name, errorResponse, 'An error occurred.');
    }

    this.loggerService.warn(
      this.catch.name,
      { request: req, response: res, body: errorResponse, exception: exception?.stack },
      `RESPONSE(ERROR): [${request.method}]${request.url}`,
    );

    if (isProduction) {
      delete errorResponse.callClass;
      delete errorResponse.callMethod;
      delete errorResponse.stack;
    }

    return response.status(errorResponse.statusCode).json(errorResponse);
  }

  abstract handle(exception: any, host: ArgumentsHost): Promise<Partial<ErrorResponse>>;
}
