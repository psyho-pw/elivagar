import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IApp, IConfigsService, IDatabase } from './configs.interface';
import { AppConfigKey } from './configurations/app.config';
import { DatabaseConfigKey } from './configurations/database.config';

@Injectable()
export class ConfigsService implements IConfigsService {
  public constructor(protected readonly configService: ConfigService) {}

  public get AppConfig(): IApp {
    return this.configService.getOrThrow<IApp>(AppConfigKey);
  }

  public get DatabaseConfig(): IDatabase {
    return this.configService.getOrThrow<IDatabase>(DatabaseConfigKey);
  }
}
