import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt/jwt.guard';
import type { JwtAuthRequest } from './auth/jwt-auth-request';
import { MetricsService } from './observability/metrics.service';
import { RolesGuard } from './auth/roles/roles.guard';
import { Roles } from './auth/roles/roles.decorator';

@Controller()
export class AppController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  hello() {
    return { ok: true, message: 'API online' };
  }

  @Get('/metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'OWNER')
  metricsSnapshot() {
    return this.metrics.snapshot();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  me(@Req() req: JwtAuthRequest) {
    return req.user; // payload do token
  }
}
