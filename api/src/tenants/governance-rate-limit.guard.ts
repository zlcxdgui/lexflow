import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { JwtAuthRequest } from '../auth/jwt-auth-request';
import { AuditService } from '../audit/audit.service';

type Bucket = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, Bucket>();

@Injectable()
export class GovernanceRateLimitGuard implements CanActivate {
  constructor(private readonly audit: AuditService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<JwtAuthRequest>();
    const userId = req.user?.sub || 'anonymous';
    const tenantId = req.user?.tenantId;
    const routePath =
      typeof req.path === 'string'
        ? req.path
        : typeof req.url === 'string'
          ? req.url
          : 'unknown';
    const routeKey = `${req.method}:${routePath}`;

    const windowMs = Number(process.env.GOVERNANCE_RATE_WINDOW_MS || 60_000);
    const maxRequests = Number(process.env.GOVERNANCE_RATE_MAX || 30);
    const now = Date.now();
    const key = `${userId}:${routeKey}`;
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.windowStart > windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return true;
    }

    bucket.count += 1;
    if (bucket.count <= maxRequests) return true;

    void this.audit.log(
      tenantId || 'platform',
      'SECURITY_RATE_LIMIT_HIT',
      req.user?.sub,
      undefined,
      {
        route: routeKey,
        maxRequests,
        windowMs,
      },
    );

    throw new HttpException(
      'Muitas tentativas em ações de governança. Tente novamente em instantes.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
