import { MariaDbDriver } from '@mikro-orm/mariadb';
import { MikroOrmModuleOptions, MikroOrmModule as OrmModule } from '@mikro-orm/nestjs';
import { DynamicModule } from '@nestjs/common';
import { ConfigsServiceKey } from '../configs/configs.constant';
import { IConfigsService } from '../configs/configs.interface';

export class MikroOrmModule {
  private static instance?: DynamicModule | Promise<DynamicModule>;

  public static getInstance(): DynamicModule | Promise<DynamicModule> {
    if (this.instance) return this.instance;

    this.instance = OrmModule.forRootAsync({
      imports: [],
      inject: [ConfigsServiceKey],
      driver: MariaDbDriver,
      useFactory: async (configsService: IConfigsService): Promise<MikroOrmModuleOptions> => {
        const { host, port, user, password } = configsService.DatabaseConfig;
        const options: MikroOrmModuleOptions = {
          driver: MariaDbDriver,
          entities: ['./dist/entities'],
          entitiesTs: [`./apps/${configsService.AppConfig.serviceName}/src/database/entities`],
          host,
          port,
          user,
          password,
          dbName: host,
          autoLoadEntities: true,
        };

        return options;
      },
    });

    return this.instance;
  }
}
