import { GeneralException } from '@app/core/common/exceptions/general.exception';
import { HttpStatus } from '@nestjs/common';

export type DiscordExceptionContext = 'service' | 'client' | 'command' | 'event' | 'notification';

export class DiscordException extends GeneralException {
  private readonly context: DiscordExceptionContext;
  private readonly metadata?: Record<string, unknown>;

  constructor(
    message: string,
    context: DiscordExceptionContext,
    callMethod?: string,
    metadata?: Record<string, unknown>,
    status?: number,
  ) {
    const callClass = `Discord${context.charAt(0).toUpperCase() + context.slice(1)}Service`;
    super({
      callClass,
      callMethod: callMethod ?? '',
      message,
      status: status || HttpStatus.INTERNAL_SERVER_ERROR,
    });

    this.context = context;
    this.metadata = metadata;
  }

  get Context(): DiscordExceptionContext {
    return this.context;
  }

  get Metadata(): Record<string, unknown> | undefined {
    return this.metadata;
  }
}
