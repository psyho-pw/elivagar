import { LoggerService } from '@app/core/logger/logger.service';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { EMPTY, Observable } from 'rxjs';

@Catch()
export class KafkaExceptionFilter implements ExceptionFilter {
  constructor(private readonly loggerService: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): Observable<void> {
    if (host.getType() !== 'rpc') throw exception;

    const rpcCtx = host.switchToRpc();
    const kafkaContext = rpcCtx.getContext<KafkaContext>();
    const topic = kafkaContext.getTopic();
    const partition = kafkaContext.getPartition();

    this.loggerService.error(
      'catch',
      { topic, partition, error: exception },
      `Kafka consumer error on topic: ${topic}`,
    );

    return EMPTY;
  }
}
