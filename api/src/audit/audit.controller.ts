import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { AuditService } from './audit.service';
import { Roles } from '../auth/roles/roles.decorator';
import { RolesGuard } from '../auth/roles/roles.guard';
import type { JwtAuthRequest } from '../auth/jwt-auth-request';
import { Permissions } from '../auth/roles/permissions.decorator';
import type { Response } from 'express';

@Roles('OWNER')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  private tenantId(req: JwtAuthRequest) {
    return req.user.tenantId;
  }

  private isPlatformAdminViewer(req: JwtAuthRequest) {
    return Boolean(req.user.isAdmin || req.user.role === 'ADMIN');
  }

  @Get('audit')
  @Permissions('audit.read')
  listTenant(
    @Req() req: JwtAuthRequest,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('q') q?: string,
    @Query('action') action?: string,
    @Query('routine') routine?: string,
    @Query('user') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.audit.listTenant(
      this.tenantId(req),
      {
        limit: limit ? parseInt(limit, 10) : undefined,
        page: page ? parseInt(page, 10) : undefined,
        q,
        action,
        routine,
        userId,
        from,
        to,
      },
      {
        isPlatformAdminViewer: this.isPlatformAdminViewer(req),
      },
    );
  }

  @Get('matters/:matterId/audit')
  @Permissions('audit.read')
  listMatter(
    @Req() req: JwtAuthRequest,
    @Param('matterId') matterId: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('q') q?: string,
    @Query('systemOnly') systemOnly?: string,
  ) {
    return this.audit.listMatter(
      this.tenantId(req),
      matterId,
      {
        limit: limit ? parseInt(limit, 10) : undefined,
        page: page ? parseInt(page, 10) : undefined,
        q,
        systemOnly: systemOnly === '1' || systemOnly === 'true',
      },
      {
        isPlatformAdminViewer: this.isPlatformAdminViewer(req),
      },
    );
  }

  @Post('audit/action')
  @Permissions('audit.read')
  async action(
    @Req() req: JwtAuthRequest,
    @Body()
    body: {
      type?: string;
      q?: string;
      action?: string;
      routine?: string;
      user?: string;
      from?: string;
      to?: string;
      matterId?: string;
    },
  ) {
    const type = String(body?.type || '')
      .trim()
      .toUpperCase();
    let actionName: string | null = null;
    if (type === 'PROCESS') actionName = 'AUDIT_FILTER_PROCESSED';
    if (type === 'EXPORT_CSV') actionName = 'AUDIT_EXPORTED_CSV';
    if (type === 'EXPORT_PDF') actionName = 'AUDIT_EXPORTED_PDF';
    if (!actionName) return { ok: false };

    await this.audit.log(
      this.tenantId(req),
      actionName,
      req.user.sub,
      body?.matterId,
      {
        q: body?.q || '',
        action: body?.action || '',
        routine: body?.routine || '',
        userId: body?.user || '',
        from: body?.from || '',
        to: body?.to || '',
        scope: body?.matterId ? 'matter' : 'tenant',
      },
    );
    return { ok: true };
  }

  @Get('audit/export.csv')
  @Permissions('audit.read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="auditoria.csv"')
  async exportTenantCsv(
    @Req() req: JwtAuthRequest,
    @Query('q') q?: string,
    @Query('action') action?: string,
    @Query('routine') routine?: string,
    @Query('user') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    await this.audit.log(
      this.tenantId(req),
      'AUDIT_EXPORTED_CSV',
      req.user.sub,
      undefined,
      {
        q: q || '',
        action: action || '',
        routine: routine || '',
        userId: userId || '',
        from: from || '',
        to: to || '',
        scope: 'tenant',
      },
    );
    return this.audit.exportTenantCsv(
      this.tenantId(req),
      { q, action, routine, userId, from, to },
      {
        isPlatformAdminViewer: this.isPlatformAdminViewer(req),
      },
    );
  }

  @Get('matters/:matterId/audit/export.csv')
  @Permissions('audit.read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="auditoria-caso.csv"')
  async exportMatterCsv(
    @Req() req: JwtAuthRequest,
    @Param('matterId') matterId: string,
    @Query('q') q?: string,
    @Query('action') action?: string,
    @Query('routine') routine?: string,
    @Query('user') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('systemOnly') systemOnly?: string,
  ) {
    await this.audit.log(
      this.tenantId(req),
      'AUDIT_EXPORTED_CSV',
      req.user.sub,
      matterId,
      {
        q: q || '',
        action: action || '',
        routine: routine || '',
        userId: userId || '',
        from: from || '',
        to: to || '',
        systemOnly: systemOnly === '1' || systemOnly === 'true',
        scope: 'matter',
      },
    );
    return this.audit.exportMatterCsv(
      this.tenantId(req),
      matterId,
      {
        q,
        action,
        routine,
        userId,
        from,
        to,
        systemOnly: systemOnly === '1' || systemOnly === 'true',
      },
      {
        isPlatformAdminViewer: this.isPlatformAdminViewer(req),
      },
    );
  }

  @Get('audit/export.pdf')
  @Permissions('audit.read')
  async exportTenantPdf(
    @Req() req: JwtAuthRequest,
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('action') action?: string,
    @Query('routine') routine?: string,
    @Query('user') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    await this.audit.log(
      this.tenantId(req),
      'AUDIT_EXPORTED_PDF',
      req.user.sub,
      undefined,
      {
        q: q || '',
        action: action || '',
        routine: routine || '',
        userId: userId || '',
        from: from || '',
        to: to || '',
        scope: 'tenant',
      },
    );
    const pdf = await this.audit.exportTenantPdf(
      this.tenantId(req),
      { q, action, routine, userId, from, to },
      {
        isPlatformAdminViewer: this.isPlatformAdminViewer(req),
      },
      {
        exportedByEmail: req.user.email || null,
      },
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="auditoria.pdf"',
    );
    res.send(pdf);
  }

  @Get('matters/:matterId/audit/export.pdf')
  @Permissions('audit.read')
  async exportMatterPdf(
    @Req() req: JwtAuthRequest,
    @Res() res: Response,
    @Param('matterId') matterId: string,
    @Query('q') q?: string,
    @Query('action') action?: string,
    @Query('routine') routine?: string,
    @Query('user') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('systemOnly') systemOnly?: string,
  ) {
    await this.audit.log(
      this.tenantId(req),
      'AUDIT_EXPORTED_PDF',
      req.user.sub,
      matterId,
      {
        q: q || '',
        action: action || '',
        routine: routine || '',
        userId: userId || '',
        from: from || '',
        to: to || '',
        systemOnly: systemOnly === '1' || systemOnly === 'true',
        scope: 'matter',
      },
    );
    const pdf = await this.audit.exportMatterPdf(
      this.tenantId(req),
      matterId,
      {
        q,
        action,
        routine,
        userId,
        from,
        to,
        systemOnly: systemOnly === '1' || systemOnly === 'true',
      },
      {
        isPlatformAdminViewer: this.isPlatformAdminViewer(req),
      },
      {
        exportedByEmail: req.user.email || null,
      },
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="auditoria-caso.pdf"',
    );
    res.send(pdf);
  }
}
