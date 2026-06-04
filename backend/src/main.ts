import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import {
  PrismaKnownRequestExceptionFilter,
  PrismaValidationExceptionFilter,
} from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(
    new PrismaValidationExceptionFilter(),
    new PrismaKnownRequestExceptionFilter(),
  );
  const isProd = process.env.NODE_ENV === 'production';
  app.enableCors({
    origin: isProd
      ? (process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(',') : 'http://localhost')
      : (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          // Vite change souvent de port (5173, 5174, 5175…)
          if (!origin) return callback(null, true);
          if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            return callback(null, true);
          }
          return callback(null, false);
        },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Comptabli API')
    .setDescription('API for Comptabli accounting platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`[Nest] Service listant sur http://127.0.0.1:${port}`);
}
bootstrap();
