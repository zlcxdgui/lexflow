import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { randomUUID } from 'node:crypto';
import { runWithRequestContext } from './common/request-context';
import type { Request, Response, NextFunction } from 'express';
import { StructuredLoggingInterceptor } from './observability/structured-logging.interceptor';
import { MetricsService } from './observability/metrics.service';
import { MessageOnlyExceptionFilter } from './common/message-only-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(
    new StructuredLoggingInterceptor(app.get(MetricsService)),
  );
  app.useGlobalFilters(new MessageOnlyExceptionFilter());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const forwarded = req.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded)
      ? forwarded[0]
      : String(forwarded || '')
          .split(',')[0]
          .trim();
    const ip = forwardedIp || req.ip;
    const userAgent = String(req.headers['user-agent'] || '');

    runWithRequestContext(
      {
        requestId: randomUUID(),
        ip,
        userAgent,
      },
      next,
    );
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
