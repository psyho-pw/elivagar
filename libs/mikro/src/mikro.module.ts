import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { IConfigsService } from '@app/core/configs/configs.interface';
import { MikroOrmModuleOptions, MikroOrmModule as OrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { DynamicModule } from '@nestjs/common';

export class MikroOrmModule {
  private static instance?: DynamicModule | Promise<DynamicModule>;

  private static makeDistPath(serviceName: string): string {
    return `dist/apps/${serviceName}/apps/${serviceName}/src/**/*.entity.js`;
  }

  private static makeTsPath(serviceName: string): string {
    return `apps/${serviceName}/src/**/*.entity.ts`;
  }

  private static makeTsMigrationsPath(serviceName: string): string {
    return `libs/mikro/migrations/${serviceName}`;
  }

  private static getSchemaName(serviceName: string): string {
    // sayho-bot → sayho
    return serviceName === 'sayho-bot' ? 'sayho' : serviceName;
  }

  public static getInstance(): DynamicModule | Promise<DynamicModule> {
    if (this.instance) return this.instance;

    this.instance = OrmModule.forRootAsync({
      imports: [],
      inject: [ConfigsServiceKey],
      driver: PostgreSqlDriver,
      useFactory: async (configsService: IConfigsService): Promise<MikroOrmModuleOptions> => {
        const { serviceName } = configsService.AppConfig;
        const { host, port, user, password, dbName } = configsService.DatabaseConfig;

        const schema = this.getSchemaName(serviceName);

        const options: MikroOrmModuleOptions = {
          driver: PostgreSqlDriver,
          entitiesTs: [this.makeTsPath(serviceName)],
          entities: [this.makeDistPath(serviceName)],
          host,
          port,
          user,
          password,
          dbName,
          schema,
          autoLoadEntities: true,
          allowGlobalContext: true,
          discovery: {
            warnWhenNoEntities: false,
            requireEntitiesArray: false,
          },
          migrations: {
            tableName: 'migrations',
            path: this.makeTsMigrationsPath(serviceName),
            pathTs: this.makeTsMigrationsPath(serviceName),
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
