import { IKafkaConfig } from '@app/core/configs/configs.interface';
import { ConfigsService as CoreConfigsService } from '@app/core/configs/configs.service';
import { KafkaConfigKey } from '@app/core/configs/configurations/kafka.config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigsService extends CoreConfigsService {
  public get KafkaConfig(): IKafkaConfig {
    return this.configService.getOrThrow<IKafkaConfig>(KafkaConfigKey);
  }
}
