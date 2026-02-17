import { ClsStorage, IClsService } from '@app/core/cls/cls.interface';
import { ClsServiceKey } from '@app/core/cls/cls.module';
import { AnonymousFunction } from '@app/core/types/anonymous-function.type';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import { Inject, Injectable } from '@nestjs/common';
import { Aspect, LazyDecorator, WrapParams, createDecorator } from '@toss/nestjs-aop';
import { v7 } from 'uuid';

export const DiscordContextKey = Symbol('DiscordContext');

export interface DiscordContextOptions {
  eventType?: string;
}

export const WithDiscordContext = (options?: DiscordContextOptions): MethodDecorator =>
  createDecorator(DiscordContextKey, options ?? {});

@Aspect(DiscordContextKey)
@Injectable()
export class DiscordContextAspect implements LazyDecorator<
  AnonymousFunction,
  DiscordContextOptions
> {
  constructor(
    @Inject(ClsServiceKey) private readonly clsService: IClsService,
    private readonly orm: MikroORM,
  ) {}

  wrap({ method, methodName, instance }: WrapParams<AnonymousFunction, DiscordContextOptions>) {
    return async (...args: unknown[]): Promise<unknown> => {
      const store: ClsStorage = {
        requestId: v7(),
        controllerCtx: instance.constructor.name,
        methodCtx: methodName,
      };

      return this.clsService.runWith(store, () => {
        return RequestContext.create(this.orm.em, () => method(...args));
      });
    };
  }
}
