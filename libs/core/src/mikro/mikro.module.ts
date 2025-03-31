import { MariaDbDriver } from '@mikro-orm/mariadb';
import { MikroOrmModuleOptions, MikroOrmModule as OrmModule } from '@mikro-orm/nestjs';
import { DynamicModule } from '@nestjs/common';
import { ConfigsServiceKey } from '../configs/configs.constant';
import { IConfigsService } from '../configs/configs.interface';

export class MikroOrmModule {
  private static instance?: DynamicModule | Promise<DynamicModule>;

  private static makeModulePath(serviceName: string): string {
    return `apps/${serviceName}/src/**`;
  }

  private static makeDistPath(serviceName: string): string {
    return `dist/${serviceName}/${this.makeModulePath(serviceName)}/*.entity.js`;
  }

  private static makeTsPath(serviceName: string): string {
    return `${this.makeModulePath(serviceName)}/*.entity.ts`;
  }

  private static makeTsMigrationsPath(): string {
    return `migrations`;
  }

  public static getInstance(): DynamicModule | Promise<DynamicModule> {
    if (this.instance) return this.instance;

    this.instance = OrmModule.forRootAsync({
      imports: [],
      inject: [ConfigsServiceKey],
      driver: MariaDbDriver,
      useFactory: async (configsService: IConfigsService): Promise<MikroOrmModuleOptions> => {
        const { serviceName } = configsService.AppConfig;
        const { host, port, user, password } = configsService.DatabaseConfig;

        const options: MikroOrmModuleOptions = {
          driver: MariaDbDriver,
          entitiesTs: [this.makeTsPath(serviceName)],
          entities: [this.makeDistPath(serviceName)],
          host,
          port,
          user,
          password,
          dbName: host,
          autoLoadEntities: true,
          migrations: {
            tableName: 'migrations',
            pathTs: this.makeTsMigrationsPath(),
            glob: '!(*.d).{js,ts}',
            transactional: true,
            allOrNothing: true,
            emit: 'ts',
          },
        };

        return options;
      },
    });

    return this.instance;
  }
}
