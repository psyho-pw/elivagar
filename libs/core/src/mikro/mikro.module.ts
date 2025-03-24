import { MikroOrmModuleOptions, MikroOrmModule as OrmModule } from '@mikro-orm/nestjs';
import { DynamicModule } from '@nestjs/common';

export class MikroOrmModule {
  private static instance?: DynamicModule | Promise<DynamicModule>;

  public static forRootAsync(): DynamicModule | Promise<DynamicModule> {
    if (this.instance) return this.instance;

    return OrmModule.forRootAsync({
      imports: [],
      inject: [],
      useFactory: async (): Promise<MikroOrmModuleOptions> => {
        const options = {
          type: 'mysql',
          entities: ['./dist/entities'],
          entitiesTs: ['./src/entities'],
          dbName: 'test',
          user: 'root',
          password: 'admin',
        };

        return options;
      },
    });
  }
}
