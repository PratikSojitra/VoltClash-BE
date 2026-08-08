import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

let cachedServer: any;

async function bootstrap() {
  if (!cachedServer) {
    // Create Nest app without manually injecting Express - it uses Express by default internally
    const app = await NestFactory.create(AppModule);
    
    // Enable CORS for frontend integration
    app.enableCors();

    // Enable global DTO validation and type transformation
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    // Configure Swagger API Documentation
    const config = new DocumentBuilder()
      .setTitle('VoltClash API')
      .setDescription('VoltClash Clash of Clans tracker and upgrade planner backend services')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    await app.init();
    
    // Extract the raw Express instance that Vercel requires
    cachedServer = app.getHttpAdapter().getInstance();
  }
  return cachedServer;
}

export default async (req: any, res: any) => {
  const server = await bootstrap();
  return server(req, res);
};
