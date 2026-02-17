import { Env } from '@app/core/constants/app.constant';
import { ArgumentsHost, Catch, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { AbstractExceptionFilter } from './abstract-exception.filter';
import { ErrorResponse } from './error-response.interface';
import { ConfigsServiceKey } from '../../configs/configs.constant';
import { IConfigsService } from '../../configs/configs.interface';
import { LoggerService } from '../../logger/logger.service';

@Catch()
export class GeneralExceptionFilter extends AbstractExceptionFilter {
  constructor(
    @Inject(ConfigsServiceKey) protected readonly configsService: IConfigsService,
    protected readonly loggerService: LoggerService,
  ) {
    super();
  }

  async handle(exception: Error, host: ArgumentsHost): Promise<Partial<ErrorResponse>> {
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

    //FIXME: Production에서 validation error message 제거 블록

    return errorResponse;
  }
}
