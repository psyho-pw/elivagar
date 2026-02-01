import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { ConfigsService } from '@app/core/configs/configs.service';
import { AppConfig } from '@app/core/configs/configurations/app.config';
import { DatabaseConfig } from '@app/core/configs/configurations/database.config';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ cache: true, load: [AppConfig, DatabaseConfig] })],
  providers: [{ provide: ConfigsServiceKey, useClass: ConfigsService }],
  exports: [ConfigsServiceKey],
})
export class ConfigsModule {
  get configsService(): unknown {
    return Reflect.getMetadata('providers', this);
  }
}
