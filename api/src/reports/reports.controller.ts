import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { ReportsService } from './reports.service';
import type { Response } from 'express';
import { PassThrough } from 'stream';
import type { JwtAuthRequest } from '../auth/jwt-auth-request';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Permissions } from '../auth/roles/permissions.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  private tenantId(req: JwtAuthRequest) {
    return req.user.tenantId;
  }

  @Get('data')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('reports.read')
  async data(
    @Req() req: JwtAuthRequest,
    @Query('days') days: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('area') area?: string,
    @Query('responsible') responsible?: string,
    @Query('deadlineType') deadlineType?: string,
  ) {
    const n = days ? parseInt(days, 10) : 14;
    return this.reports.getData(this.tenantId(req), n, {
      q,
      status,
      area,
      responsible,
      deadlineType,
    });
  }

  @Get('pdf')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('reports.read')
  async pdf(
    @Req() req: JwtAuthRequest,
    @Query('days') days: string,
    @Res() res: Response,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('area') area?: string,
    @Query('responsible') responsible?: string,
    @Query('deadlineType') deadlineType?: string,
  ) {
    const n = days ? parseInt(days, 10) : 14;
    await this.reports.logReportAction(
      this.tenantId(req),
      req.user.sub,
      'REPORT_EXPORTED_PDF',
      { days: n, q, status, area, responsible, deadlineType },
    );
    const data = await this.reports.getData(this.tenantId(req), n, {
      q,
      status,
      area,
      responsible,
      deadlineType,
    });
    const doc = this.reports.buildPdf(data, req.user.email);
    const stream = new PassThrough();

    const fileName = `relatorio-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    doc.pipe(stream);
    stream.pipe(res);
    doc.end();
  }

  @Post('action')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('reports.read')
  action(
    @Req() req: JwtAuthRequest,
    @Body()
    body: {
      type?: string;
      days?: number;
      q?: string;
      status?: string;
      area?: string;
      responsible?: string;
      deadlineType?: string;
    },
  ) {
    const type = String(body?.type || '')
      .trim()
      .toUpperCase();
    const action =
      type === 'CSV'
        ? 'REPORT_EXPORTED_CSV'
        : type === 'PRINT'
          ? 'REPORT_PRINTED'
          : null;
    if (!action) return { ok: false };
    return this.reports.logReportAction(
      this.tenantId(req),
      req.user.sub,
      action,
      {
        days: Number(body?.days || 0),
        q: body?.q,
        status: body?.status,
        area: body?.area,
        responsible: body?.responsible,
        deadlineType: body?.deadlineType,
      },
    );
  }
}
