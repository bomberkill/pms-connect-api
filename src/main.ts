import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as session from 'express-session';
import * as passport from 'passport';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService); // Get ConfigService instance

  // Enable CORS
  app.enableCors({
    origin: "*", // For development. In production, specify your frontend domain(s).
                  // e.g., 'http://localhost:3001' or ['http://yourdomain.com', 'https://yourdomain.com']
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

   // Configuration de session (même si l'authentification JWT est sans état)
  // Cela peut aider à résoudre les problèmes où req.logIn n'est pas défini.
  app.use(
    session({
      secret: configService.get<string>('SESSION_SECRET', 'a_very_strong_session_secret_key'), // Mettez une clé secrète forte dans .env
      resave: false,
      saveUninitialized: false,
      // cookie: { secure: process.env.NODE_ENV === 'production' }, // Activez 'secure' en production (HTTPS)
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session()); // Nécessaire pour que req.logIn soit potentiellement disponible

  app.useGlobalPipes(new ValidationPipe()); // <--- AJOUTÉ: Enable global validation

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);  
  console.log(`Application is running on: http://localhost:${port}/graphql`);
}
bootstrap();
