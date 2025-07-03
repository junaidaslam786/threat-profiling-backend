import * as dotenv from 'dotenv';
dotenv.config(); // Always FIRST!

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { OrgContextMiddleware } from './middleware/org-context.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Use global middlewares
  app.use(new LoggerMiddleware().use);
  app.use(new OrgContextMiddleware().use);

  // Enable CORS (optional, for frontend integration)
  app.enableCors({
    origin: '*', // Change to frontend domain in production!
    credentials: true,
  });

  // Global prefix (optional)
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT || 3000);
  console.log(
    `Server started at http://localhost:${process.env.PORT || 3000}/api`,
  );
}
bootstrap();
