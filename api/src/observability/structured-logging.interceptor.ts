import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { MetricsService } from './metrics.service';
import { getRequestContext } from '../common/request-context';

@Injectable()
export class StructuredLoggingInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const now = Date.now();
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: { sub?: string; tenantId?: string } }>();
    const res = context.switchToHttp().getResponse<Response>();
    const route =
      typeof req.path === 'string'
        ? req.path
        : typeof req.url === 'string'
          ? req.url
          : 'unknown';
    const rawUserAgent = req.headers['user-agent'];
    const userAgent =
      typeof rawUserAgent === 'string' ? rawUserAgent : undefined;

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Date.now() - now;
        const statusCode = res.statusCode || 200;
        const requestCtx = getRequestContext();
        const payload = {
          ts: new Date().toISOString(),
          level: statusCode >= 500 ? 'error' : 'info',
          msg: 'http_request',
          method: req.method,
          route,
          statusCode,
          durationMs,
          requestId: requestCtx?.requestId,
          tenantId: req.user?.tenantId,
          userId: req.user?.sub,
          ip: requestCtx?.ip || req.ip,
          userAgent: requestCtx?.userAgent || userAgent,
        };

        this.metrics.observeHttp(
          { method: req.method, route, statusCode },
          durationMs,
        );

        console.log(JSON.stringify(payload));
      }),
    );
  }
}
