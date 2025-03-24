import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configs, IApp, IConfigsService } from './configs.interface';

@Injectable()
export class ConfigsService implements IConfigsService {
  public constructor(private readonly configService: ConfigService<Configs>) {}

  public get All(): Configs {
    return {
      App: this.AppConfig,
    };
  }

  public get AppConfig(): IApp {
    return this.configService.getOrThrow('App', { infer: true });
  }
}
