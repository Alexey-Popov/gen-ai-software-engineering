import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ValidationError } from 'class-validator';
import { AppModule } from './app.module';

/**
 * Flattens class-validator errors into the response shape required by Task 2:
 *   { "error": "Validation failed", "details": [{ field, message }] }
 */
function formatValidationErrors(errors: ValidationError[]) {
  const details: { field: string; message: string }[] = [];

  const walk = (error: ValidationError, parentPath = '') => {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;
    for (const message of Object.values(error.constraints ?? {})) {
      details.push({ field, message });
    }
    for (const child of error.children ?? []) {
      walk(child, field);
    }
  };

  errors.forEach((e) => walk(e));
  return new BadRequestException({ error: 'Validation failed', details });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not declared in the DTO
      forbidNonWhitelisted: true, // reject unknown properties
      transform: true, // coerce query params to their declared types
      exceptionFactory: formatValidationErrors,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🏦 Banking Transactions API is running on http://localhost:${port}`);
}

bootstrap();
