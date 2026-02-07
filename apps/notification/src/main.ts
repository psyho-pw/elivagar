import { AbstractMain } from '@app/core/bootstrap/abstract-main';
import { BootstrapConfig } from '@app/core/bootstrap/bootstrap.interface';
import { KafkaModule } from '@app/kafka/kafka/kafka.module';
import { Type } from '@nestjs/common';
import { KafkaOptions } from '@nestjs/microservices';
import { NotificationModule } from './notification.module';

class NotificationMain extends AbstractMain {
  protected getModule(): Type<unknown> {
    return NotificationModule;
  }

  protected getBootstrapConfig(): BootstrapConfig {
    return {
      options: { bufferLogs: true, enableShutdownHooks: true },
      grpc: { enabled: true },
      middleware: { globalPrefix: 'api' },
      versioning: { enabled: true },
    };
  }

  protected async onBeforeListen(): Promise<void> {
    const kafkaConfig = this.configService.KafkaConfig!;
    const kafkaOptions: KafkaOptions = KafkaModule.getConsumerOptions({
      kafka: kafkaConfig,
      groupId: `notification-consumer`,
    });
    this.app.connectMicroservice<KafkaOptions>(kafkaOptions);
  }
}

NotificationMain.run();
