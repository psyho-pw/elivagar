import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configs, IApp, IConfigsService, IDatabase } from './configs.interface';
import { AppConfigKey } from './configurations/app.config';
import { DatabaseConfigKey } from './configurations/database.config';

@Injectable()
export class ConfigsService implements IConfigsService {
  public constructor(private readonly configService: ConfigService<Configs>) {}

  public get All(): Configs {
    return {
      [AppConfigKey]: this.AppConfig,
      [DatabaseConfigKey]: this.DatabaseConfig,
    };
  }

  public get AppConfig(): IApp {
    return this.configService.getOrThrow(AppConfigKey, { infer: true });
  }

  public get DatabaseConfig(): IDatabase {
    return this.configService.getOrThrow(DatabaseConfigKey, { infer: true });
  }
}
