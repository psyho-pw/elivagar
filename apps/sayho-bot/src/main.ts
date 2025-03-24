import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { IApp, IConfigsService } from '@app/core/configs/configs.interface';
import { LoggerService } from '@app/core/logger/logger.service';
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { SayhoBotModule } from './sayho-bot.module';

class Main {
  public static async bootstrap(): Promise<{ appConfig: IApp; loggerService: LoggerService }> {
    const app = await NestFactory.create<NestExpressApplication>(SayhoBotModule, {
      bufferLogs: true,
    });
    const configService: IConfigsService = app.get(ConfigsServiceKey);
    const appConfig = configService.AppConfig;

    const loggerService: LoggerService = await app.resolve(LoggerService);
    loggerService.setContext(Main.name);
    loggerService.info(Main.bootstrap.name, configService.All, 'mapped env variables');

    app.set('trust proxy', true);
    app.use(helmet());
    app.enableCors();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
    await app.listen(appConfig.port);

    return { appConfig, loggerService };
  }
}

Main.bootstrap().then(({ appConfig, loggerService }) => {
  loggerService.info(
    Main.name,
    `🚀 [${appConfig.serviceName}][${appConfig.env}] Server listening on port ${appConfig.port}`,
  );
});
