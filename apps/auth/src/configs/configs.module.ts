import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { AppConfig } from '@app/core/configs/configurations/app.config';
import { DatabaseConfig } from '@app/core/configs/configurations/database.config';
import { KafkaConfig } from '@app/core/configs/configurations/kafka.config';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigsService } from './configs.service';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ cache: true, load: [AppConfig, DatabaseConfig, KafkaConfig] })],
  providers: [{ provide: ConfigsServiceKey, useClass: ConfigsService }],
  exports: [ConfigsServiceKey],
})
export class ConfigsModule {
  get configsService(): unknown {
    return Reflect.getMetadata('providers', this);
  }
}
