import { Env } from '@app/core/constants/app.constant';
import { Global, Module } from '@nestjs/common';
import { utilities, WinstonModule } from 'nest-winston';
import winston from 'winston';
import { LoggerService } from './logger.service';
import { ConfigsServiceKey } from '../configs/configs.constant';
import { IConfigsService } from '../configs/configs.interface';

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      inject: [ConfigsServiceKey],
      useFactory: (configsService: IConfigsService) => {
        const { env, serviceName } = configsService.AppConfig;
        const isDeployedEnv = env !== Env.development && env !== Env.test;

        if (isDeployedEnv) {
          return { transports: [new winston.transports.Console({ level: 'info' })] };
        }

        return {
          transports: [
            new winston.transports.Console({
              level: env === Env.test ? 'verbose' : 'silly',
              format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                utilities.format.nestLike(serviceName, { prettyPrint: true, colors: true }),
              ),
            }),
          ],
        };
      },
    }),
  ],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
