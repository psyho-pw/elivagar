import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { IConfigsService } from '@app/core/configs/configs.interface';
import { LoggerService } from '@app/core/logger/logger.service';
import { KafkaTopics } from '@app/kafka/events/events.constant';
import { KafkaServiceKey } from '@app/kafka/kafka/kafka.constant';
import { IKafkaService } from '@app/kafka/kafka/kafka.interface';
import { Inject, Injectable } from '@nestjs/common';
import { Aspect, LazyDecorator, WrapParams, createDecorator } from '@toss/nestjs-aop';
import { AnonymousFunction } from 'libs/core/types/anonymous-function.type';
import { GeneralException } from '../exceptions/general.exception';

export const DiscordErrorHandlerKey = Symbol('DiscordErrorHandler');

export interface HandleDiscordErrorOptions {
  bubble?: boolean;
}

export const HandleDiscordError = (options?: HandleDiscordErrorOptions): MethodDecorator =>
  createDecorator(DiscordErrorHandlerKey, options ?? { bubble: false });

@Aspect(DiscordErrorHandlerKey)
@Injectable()
export class DiscordErrorAspect implements LazyDecorator<
  AnonymousFunction,
  HandleDiscordErrorOptions
> {
  constructor(
    @Inject(KafkaServiceKey) private readonly kafkaService: IKafkaService,
    private readonly loggerService: LoggerService,
    @Inject(ConfigsServiceKey) private readonly configsService: IConfigsService,
  ) {}

  wrap({ method, methodName, metadata }: WrapParams<AnonymousFunction, HandleDiscordErrorOptions>) {
    return async (...args: unknown[]): Promise<unknown> => {
      try {
        return await method(...args);
      } catch (error: unknown) {
        if (error instanceof GeneralException) error.CallMethod = methodName;

        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? (error.stack ?? '') : '';

        this.loggerService.error('wrap', error, errorMessage);

        const env = this.configsService.AppConfig.env;
        // if (env === Env.production) {
        this.kafkaService.emit(KafkaTopics.SayhoBot.ErrorOccurred, {
          message: errorMessage,
          stack: errorStack.substring(0, 1024),
          context: methodName,
          timestamp: new Date().toISOString(),
        });
        // }

        if (metadata?.bubble) {
          throw error;
        }
      }
    };
  }
}
