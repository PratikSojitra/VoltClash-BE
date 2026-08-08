import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Request, Response, Express } from 'express';
const express = require('express');
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

let cachedServer: Express | undefined;

async function bootstrap() {
  if (!cachedServer) {
    const expressInstance = express();
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressInstance),
    );
    
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
    cachedServer = expressInstance;
  }
  return cachedServer;
}

export default async (req: Request, res: Response) => {
  const server = await bootstrap();
  return server(req, res);
};
