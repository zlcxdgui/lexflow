import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { DashboardService } from './dashboard.service';
import type { JwtAuthRequest } from '../auth/jwt-auth-request';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Permissions } from '../auth/roles/permissions.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  private tenantId(req: JwtAuthRequest) {
    return req.user.tenantId;
  }
  private userId(req: JwtAuthRequest) {
    return req.user.sub;
  }

  private canViewAllAgenda(req: JwtAuthRequest) {
    const permissions = Array.isArray(req.user.permissions)
      ? req.user.permissions
      : [];
    return permissions.includes('agenda.read.all');
  }

  private canViewOwnAgenda(req: JwtAuthRequest) {
    const permissions = Array.isArray(req.user.permissions)
      ? req.user.permissions
      : [];
    return permissions.includes('agenda.read.own');
  }

  private canViewAgendaOnly(req: JwtAuthRequest) {
    const permissions = Array.isArray(req.user.permissions)
      ? req.user.permissions
      : [];
    return permissions.includes('agenda.read');
  }

  @Get()
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('dashboard.read')
  get(@Req() req: JwtAuthRequest, @Query('days') days?: string) {
    const n = days ? parseInt(days, 10) : 14;
    const canAll = this.canViewAllAgenda(req);
    const canOwn = this.canViewOwnAgenda(req);

    return this.dashboard.getDashboard(this.tenantId(req), n, {
      viewerUserId: !canAll && canOwn ? this.userId(req) : undefined,
      hideData: !canAll && !canOwn,
    });
  }

  @Get('notifications')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('notifications.read')
  notifications(@Req() req: JwtAuthRequest) {
    return this.dashboard.getNotifications(
      this.tenantId(req),
      this.userId(req),
    );
  }

  @Post('notifications/read')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('notifications.read')
  markRead(@Req() req: JwtAuthRequest, @Body() body: { itemKey: string }) {
    return this.dashboard.markNotificationRead(
      this.tenantId(req),
      this.userId(req),
      body?.itemKey,
    );
  }

  @Post('notifications/read-all')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('notifications.read')
  markAllRead(@Req() req: JwtAuthRequest) {
    return this.dashboard.markAllNotificationsRead(
      this.tenantId(req),
      this.userId(req),
    );
  }
}
