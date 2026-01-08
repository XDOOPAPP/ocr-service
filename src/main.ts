/* eslint-disable @typescript-eslint/no-unsafe-call */
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { RpcExceptionFilter } from './common/filters/rpc-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
        queue: 'ocr_queue',
        queueOptions: {
          durable: true,
        },
      },
    },
  );

  // Global exception filter
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  app.useGlobalFilters(new RpcExceptionFilter());

  // Global interceptor for response transformation
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.listen();
  console.log(
    `🚀 OCR Microservice is listening on RabbitMQ queue: ocr_queue`,
  );
}
bootstrap();
