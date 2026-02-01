import { Env } from '@app/core/constants/app.constant';
import { Inject, Injectable, Scope } from '@nestjs/common';
import { INQUIRER } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { v7 } from 'uuid';
import { Log } from './logger.interface';
import { ClsServiceKey } from '../cls/cls.module';
import { ClsService } from '../cls/cls.service';
import { ConfigsServiceKey } from '../configs/configs.constant';
import { IConfigsService } from '../configs/configs.interface';

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService {
  private context: string;

  public constructor(
    @Inject(ClsServiceKey) private readonly clsService: ClsService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly winstonLogger: WinstonLogger,
    @Inject(INQUIRER) private readonly caller: object,
    @Inject(ConfigsServiceKey)
    private readonly configService: IConfigsService,
  ) {
    this.context = this.caller?.constructor.name || 'Unknown';
  }

  private format(obj: unknown, message = '', requestId?: string): Log {
    if (!requestId) requestId = this.clsService.requestId;
    const log: Log = { message, requestId, logId: v7() };
    const appConfig = this.configService.AppConfig;

    if (appConfig.env !== Env.development) {
      log.app = appConfig.serviceName;
      log.env = appConfig.env;
    }

    if (obj instanceof Error) {
      log.stack = obj.stack;
      return log;
    }

    if (typeof obj === 'string') {
      log.message = `${obj} ${message}`;
      return log;
    }

    if (typeof obj === 'object' && obj !== null) {
      log.data = obj;
    }
    return log;
  }

  public setContext(context: string): void {
    this.context = context;
  }

  private makeContextString(detailedContext: string): string {
    return `${this.context}.${detailedContext}`;
  }

  public verbose(
    detailedContext: string,
    object: unknown,
    message?: string,
    requestId?: string,
  ): void {
    const log = this.format(object, message, requestId);
    this.winstonLogger.verbose?.(log, this.makeContextString(detailedContext));
  }

  public debug(
    detailedContext: string,
    object: unknown,
    message?: string,
    requestId?: string,
  ): void {
    const log = this.format(object, message, requestId);
    this.winstonLogger.debug?.(log, this.makeContextString(detailedContext));
  }

  public info(
    detailedContext: string,
    object: unknown,
    message?: string,
    requestId?: string,
  ): void {
    const log = this.format(object, message, requestId);
    this.winstonLogger.log(log, this.makeContextString(detailedContext));
  }

  public warn(
    detailedContext: string,
    object: unknown,
    message?: string,
    requestId?: string,
  ): void {
    const log = this.format(object, message, requestId);
    this.winstonLogger.warn(log, this.makeContextString(detailedContext));
  }

  public error(
    detailedContext: string,
    object: unknown,
    message?: string,
    requestId?: string,
  ): void {
    const log = this.format(object, message, requestId);
    this.winstonLogger.error(log, undefined, this.makeContextString(detailedContext));
  }
}
