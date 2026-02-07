import { GeneralException } from '@app/core/common/exceptions/general.exception';
import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { IConfigsService } from '@app/core/configs/configs.interface';
import { LoggerService } from '@app/core/logger/logger.service';
import { AnonymousFunction } from '@app/core/types/anonymous-function.type';
import { KafkaTopics } from '@app/kafka/events/events.constant';
import { SayhoBotErrorEvent } from '@app/kafka/events/events.interface';
import { KafkaServiceKey } from '@app/kafka/kafka/kafka.constant';
import { IKafkaService } from '@app/kafka/kafka/kafka.interface';
import { Inject, Injectable } from '@nestjs/common';
import { Aspect, LazyDecorator, WrapParams, createDecorator } from '@toss/nestjs-aop';

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

        const _env = this.configsService.AppConfig.env;
        // if (env === Env.production) {
        const event: SayhoBotErrorEvent = {
          message: errorMessage,
          stack: errorStack.substring(0, 1024),
          context: methodName,
          timestamp: new Date().toISOString(),
        };
        this.kafkaService.emit(KafkaTopics.SayhoBot.ErrorOccurred, event);
        // }

        if (metadata?.bubble) {
          throw error;
        }
      }
    };
  }
}
