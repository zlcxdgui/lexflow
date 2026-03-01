import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import type { JwtAuthRequest } from '../auth/jwt-auth-request';
import { BillingService } from './billing.service';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  private assertOwnerOrAdmin(req: JwtAuthRequest) {
    const role = String(req.user.role || '').toUpperCase();
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException(
        'Sem autorização. Entre em contato com o responsável do escritório.',
      );
    }
  }

  private assertPlatformAdmin(req: JwtAuthRequest) {
    const role = String(req.user.role || '').toUpperCase();
    if (role !== 'ADMIN') {
      throw new ForbiddenException(
        'Sem autorização. Entre em contato com o responsável do escritório.',
      );
    }
  }

  @Get('entitlements/me')
  getMyEntitlements(@Req() req: JwtAuthRequest) {
    this.assertOwnerOrAdmin(req);
    return this.billing.getCurrentEntitlements(req.user.tenantId);
  }

  @Get('plans')
  listPlans() {
    return this.billing.listPlansCatalog();
  }

  @Get('requests/me')
  listMyRequests(@Req() req: JwtAuthRequest) {
    this.assertOwnerOrAdmin(req);
    return this.billing.listMyPlanChangeRequests(req.user.tenantId);
  }

  @Post('requests')
  requestPlanChange(
    @Req() req: JwtAuthRequest,
    @Body() body?: { planKey?: string; billingCycle?: string; notes?: string },
  ) {
    this.assertOwnerOrAdmin(req);
    const planKey = String(body?.planKey || '').trim();
    if (!planKey) throw new BadRequestException('Plano é obrigatório.');
    return this.billing.requestPlanChange(req.user.tenantId, req.user.sub, {
      planKey,
      billingCycle: body?.billingCycle,
      notes: body?.notes,
      userEmail: req.user.email,
    });
  }

  @Post('change-plan')
  async changePlan(
    @Req() req: JwtAuthRequest,
    @Body() body?: { planKey?: string; billingCycle?: string },
  ) {
    this.assertOwnerOrAdmin(req);
    const planKey = String(body?.planKey || '').trim();
    if (!planKey) throw new BadRequestException('Plano é obrigatório.');
    return this.billing.changePlan(req.user.tenantId, req.user.sub, {
      planKey,
      billingCycle: body?.billingCycle,
      source: 'manual-ui',
      userEmail: req.user.email,
    });
  }

  @Post('cancel-at-period-end')
  async cancelAtPeriodEnd(
    @Req() req: JwtAuthRequest,
    @Body() body?: { cancelAtPeriodEnd?: boolean },
  ) {
    this.assertOwnerOrAdmin(req);
    return this.billing.setCancelAtPeriodEnd(req.user.tenantId, req.user.sub, {
      cancelAtPeriodEnd: Boolean(body?.cancelAtPeriodEnd),
      userEmail: req.user.email,
    });
  }

  @Get('admin/tenants/:tenantId/entitlements')
  getTenantEntitlementsAdmin(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
  ) {
    this.assertPlatformAdmin(req);
    return this.billing.getCurrentEntitlements(tenantId);
  }

  @Post('admin/tenants/:tenantId/change-plan')
  changePlanAdmin(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
    @Body() body?: { planKey?: string; billingCycle?: string },
  ) {
    this.assertPlatformAdmin(req);
    const planKey = String(body?.planKey || '').trim();
    if (!planKey) throw new BadRequestException('Plano é obrigatório.');
    return this.billing.changePlan(tenantId, req.user.sub, {
      planKey,
      billingCycle: body?.billingCycle,
      source: 'platform-admin-offices',
      userEmail: req.user.email,
    });
  }

  @Post('admin/tenants/:tenantId/cancel-at-period-end')
  cancelAtPeriodEndAdmin(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
    @Body() body?: { cancelAtPeriodEnd?: boolean },
  ) {
    this.assertPlatformAdmin(req);
    return this.billing.setCancelAtPeriodEnd(tenantId, req.user.sub, {
      cancelAtPeriodEnd: Boolean(body?.cancelAtPeriodEnd),
      userEmail: req.user.email,
    });
  }

  @Get('admin/tenants/:tenantId/requests')
  listTenantRequestsAdmin(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
  ) {
    this.assertPlatformAdmin(req);
    return this.billing.listTenantPlanChangeRequestsAdmin(tenantId);
  }

  @Post('admin/requests/:requestId/review')
  reviewRequestAdmin(
    @Req() req: JwtAuthRequest,
    @Param('requestId') requestId: string,
    @Body()
    body?: { status?: 'APPROVED' | 'REJECTED'; resolutionNotes?: string },
  ) {
    this.assertPlatformAdmin(req);
    const status = String(body?.status || '').toUpperCase();
    if (status !== 'APPROVED' && status !== 'REJECTED') {
      throw new BadRequestException('Status de revisão inválido.');
    }
    return this.billing.reviewPlanChangeRequest(
      requestId,
      {
        userId: req.user.sub,
        email: req.user.email,
      },
      {
        status: status,
        resolutionNotes: body?.resolutionNotes,
      },
    );
  }
}
