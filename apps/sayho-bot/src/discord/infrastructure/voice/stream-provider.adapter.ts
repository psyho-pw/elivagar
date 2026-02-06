import { Readable } from 'stream';
import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { ConfigsService } from '@app/core/configs/configs.service';
import { LoggerService } from '@app/core/logger/logger.service';
import { createAudioResource, StreamType } from '@discordjs/voice';
import { Inject, Injectable } from '@nestjs/common';
import { YtdlCore, toPipeableStream } from '@ybd-project/ytdl-core';
import { fetch as undiciFetch, ProxyAgent } from 'undici';
import { AudioResource } from '../../domain/ports/audio-player.port';
import { IPoTokenService, PoTokenServicePort } from '../../domain/ports/po-token.port';
import { IStreamProvider } from '../../domain/ports/stream-provider.port';

@Injectable()
export class StreamProviderAdapter implements IStreamProvider {
  constructor(
    @Inject(ConfigsServiceKey) private readonly configsService: ConfigsService,
    @Inject(PoTokenServicePort)
    private readonly poTokenService: IPoTokenService,
    private readonly loggerService: LoggerService,
  ) {}

  private createProxyFetcher(agent: ProxyAgent) {
    return (url: URL | RequestInfo, options?: RequestInit): Promise<Response> =>
      undiciFetch(url.toString(), {
        ...((options ?? {}) as Record<string, unknown>),
        dispatcher: agent,
      }) as unknown as Promise<Response>;
  }

  private createYtdlClient(): YtdlCore {
    const proxyUrl = this.configsService.YoutubeConfig.proxy;
    const proxyAgent = proxyUrl
      ? new ProxyAgent({
          uri: proxyUrl,
          keepAliveTimeout: 60000, // 60s
          keepAliveMaxTimeout: 600000, // 10min
          connect: {
            timeout: 30000, // connection timeout 30s
          },
        })
      : undefined;

    const tokenData = this.poTokenService.getPoToken();
    const poToken = tokenData?.poToken || undefined;
    const visitorData = tokenData?.visitorData || undefined;

    if (proxyAgent) {
      this.loggerService.debug(
        'createYtdlClient',
        `Using proxy: ${proxyUrl?.replace(/:[^:@]+@/, ':***@')}`,
      );
    }

    return new YtdlCore({
      clients: ['ios', 'android', 'tv'],
      fetcher: proxyAgent ? this.createProxyFetcher(proxyAgent) : undefined,
      poToken,
      visitorData,
      disablePoTokenAutoGeneration: true,
      highWaterMark: 1024 * 1024 * 32,
    });
  }

  private async createStreamWithRetry(url: string, maxRetries: number = 2): Promise<Readable> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const ytdl = this.createYtdlClient();
        const webStream = await ytdl.download(url, { filter: 'audioandvideo' });

        if (attempt > 1) {
          this.loggerService.info(
            'createStreamWithRetry',
            `Successfully created stream on attempt ${attempt} for ${url}`,
          );
        }

        return toPipeableStream(webStream);
      } catch (error: unknown) {
        lastError = error;

        const errorWithCode = error as { code?: string; syscall?: string; message?: string };
        const isRetryable =
          errorWithCode.code === 'ETIMEDOUT' ||
          errorWithCode.code === 'ECONNRESET' ||
          errorWithCode.code === 'ECONNREFUSED' ||
          errorWithCode.syscall === 'connect';

        if (!isRetryable || attempt === maxRetries) {
          break;
        }

        this.loggerService.warn(
          'createStreamWithRetry',
          `Retrying stream creation (attempt ${attempt}/${maxRetries}) for ${url}: ${errorWithCode.message ?? String(error)}`,
        );

        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw lastError;
  }

  async createStream(url: string): Promise<Readable> {
    try {
      return await this.createStreamWithRetry(url);
    } catch (error: unknown) {
      const errorWithDetails = error as {
        message?: string;
        code?: string;
        errno?: number;
        syscall?: string;
        stack?: string;
        statusCode?: number;
      };

      this.loggerService.error(
        'createStream',
        `Stream creation error for ${url}: ${JSON.stringify({
          message: errorWithDetails.message,
          code: errorWithDetails.code,
          errno: errorWithDetails.errno,
          syscall: errorWithDetails.syscall,
          stack: errorWithDetails.stack?.split('\n').slice(0, 3).join('\n'),
        })}`,
      );

      const isNetworkError =
        errorWithDetails.code === 'ECONNREFUSED' ||
        errorWithDetails.code === 'ETIMEDOUT' ||
        errorWithDetails.code === 'ENOTFOUND' ||
        errorWithDetails.code === 'ECONNRESET' ||
        errorWithDetails.syscall === 'connect' ||
        errorWithDetails.message?.includes('proxy') ||
        errorWithDetails.message?.includes('PROXY');

      if (isNetworkError) {
        throw new Error(
          `Network/Proxy connection failed (${errorWithDetails.code || errorWithDetails.syscall}). Please check proxy settings. URL: ${url}`,
        );
      }

      const isAuthError =
        errorWithDetails.statusCode === 403 ||
        errorWithDetails.statusCode === 401 ||
        errorWithDetails.message?.includes('Sign in') ||
        errorWithDetails.message?.includes('authentication');

      if (isAuthError) {
        throw new Error(`YouTube authentication failed. PoToken may be expired. URL: ${url}`);
      }

      const isMediaNotFound =
        errorWithDetails.message?.includes('formats') ||
        errorWithDetails.message?.includes('Cannot read properties of null') ||
        errorWithDetails.statusCode === 404;

      if (isMediaNotFound) {
        throw new Error(
          `Cannot get YouTube video information. The video may have been deleted or made private. URL: ${url}`,
        );
      }

      throw new Error(
        `An error occurred while creating the stream: ${errorWithDetails.message || String(error)}. URL: ${url}`,
      );
    }
  }

  createAudioResource(stream: Readable): AudioResource {
    const resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
    });

    return {
      id: Math.random().toString(36).substring(7),
      stream,
      _internal: resource,
    } as AudioResource & { _internal: ReturnType<typeof createAudioResource> };
  }

  async createAudioResourceFromUrl(url: string): Promise<AudioResource> {
    const stream = await this.createStream(url);
    return this.createAudioResource(stream);
  }
}
