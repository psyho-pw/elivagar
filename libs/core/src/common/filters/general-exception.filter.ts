import { Env } from '@app/core/constants/app.constant';
import { ArgumentsHost, Catch, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { ConfigsServiceKey } from '../../configs/configs.constant';
import { IConfigsService } from '../../configs/configs.interface';
import { LoggerService } from '../../logger/logger.service';
import { AbstractExceptionFilter } from './abstract-exception.filter';
import { ErrorResponse } from './error-response.interface';

@Catch()
export class GeneralExceptionFilter extends AbstractExceptionFilter {
  constructor(
    @Inject(ConfigsServiceKey) protected readonly configsService: IConfigsService,
    protected readonly loggerService: LoggerService,
  ) {
    super();
  }

  async handle(exception: any, host: ArgumentsHost) {
    const env = this.configsService.AppConfig.env;
    const isProduction = env === Env.production;
    if (host.getType() !== 'http') throw exception;

    const errorResponse: Partial<ErrorResponse> = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: exception?.message || 'Something went wrong unexpectedly',
      error: exception.message,
    };

    if (exception instanceof HttpException) {
      errorResponse.statusCode = exception.getStatus();
      errorResponse.message = exception.message;
    }

    const status = errorResponse.statusCode;
    const useResponseMessage =
      !isProduction ||
      (status !== HttpStatus.BAD_REQUEST && status !== HttpStatus.INTERNAL_SERVER_ERROR);
    if (useResponseMessage) {
      if (exception?.response?.message) errorResponse.message = exception?.response?.message;
    }

    return errorResponse;
  }
}
