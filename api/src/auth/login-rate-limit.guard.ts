import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

type Bucket = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, Bucket>();

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const body = req.body as Record<string, unknown> | undefined;
    const rawEmail = body?.email;
    const email =
      typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    const ip = req.ip || 'unknown';
    const key = `${ip}:${email || 'no-email'}`;

    const windowMs = Number(process.env.AUTH_RATE_WINDOW_MS || 60_000);
    const maxRequests = Number(process.env.AUTH_RATE_MAX || 20);
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.windowStart > windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return true;
    }

    bucket.count += 1;
    if (bucket.count <= maxRequests) return true;

    throw new HttpException(
      'Muitas tentativas de login. Tente novamente em instantes.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
