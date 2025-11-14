import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    bufferLogs: false,
  });
  
  app.setGlobalPrefix('api');
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost';
  const port = parseInt(process.env.PORT || '3000');

  app.enableCors({
    origin: ['http://localhost', 'http://localhost:80', frontendUrl],
    credentials: true,
  });
  
  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on: http://0.0.0.0:${port}`);
}

bootstrap();
