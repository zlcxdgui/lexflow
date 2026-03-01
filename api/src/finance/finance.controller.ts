import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Permissions } from '../auth/roles/permissions.decorator';
import type { JwtAuthRequest } from '../auth/jwt-auth-request';
import { FinanceService } from './finance.service';
import { CreateFinanceEntryDto } from './dto/create-finance-entry.dto';
import { UpdateFinanceEntryDto } from './dto/update-finance-entry.dto';
import { SettleFinanceInstallmentDto } from './dto/settle-finance-installment.dto';
import { CancelFinanceEntryDto } from './dto/cancel-finance-entry.dto';
import { CancelFinanceInstallmentDto } from './dto/cancel-finance-installment.dto';
import { UpdateFinanceInstallmentDto } from './dto/update-finance-installment.dto';
import { CreateFinanceAccountDto } from './dto/create-finance-account.dto';
import { CreateFinanceCategoryDto } from './dto/create-finance-category.dto';
import { CreateFinanceCostCenterDto } from './dto/create-finance-cost-center.dto';
import { CreateFinanceRecurrenceTemplateDto } from './dto/create-finance-recurrence-template.dto';
import { GenerateRecurrenceDto } from './dto/generate-recurrence.dto';
import type { Response } from 'express';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  private tenantId(req: JwtAuthRequest) {
    return req.user.tenantId;
  }

  private userId(req: JwtAuthRequest) {
    return req.user.sub;
  }

  private role(req: JwtAuthRequest) {
    return String(req.user.role || '').toUpperCase();
  }

  @Get('entries')
  @Roles('ADMIN', 'OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('finance.read')
  listEntries(
    @Req() req: JwtAuthRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.finance.listEntries(this.tenantId(req), query);
  }

  @Post('entries')
  @Roles('ADMIN', 'OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('finance.create')
  createEntry(@Req() req: JwtAuthRequest, @Body() body: CreateFinanceEntryDto) {
    return this.finance.createEntry(this.tenantId(req), this.userId(req), body);
  }

  @Get('entries/:id')
  @Roles('ADMIN', 'OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('finance.read')
  getEntry(@Req() req: JwtAuthRequest, @Param('id') id: string) {
    return this.finance.getEntry(this.tenantId(req), id);
  }

  @Patch('entries/:id')
  @Roles('ADMIN', 'OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('finance.edit')
  updateEntry(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body() body: UpdateFinanceEntryDto,
  ) {
    return this.finance.updateEntry(
      this.tenantId(req),
      this.userId(req),
      id,
      body,
    );
  }

  @Post('entries/:id/cancel')
  @Roles('ADMIN', 'OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('finance.cancel')
  cancelEntry(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body() body?: CancelFinanceEntryDto,
  ) {
    return this.finance.cancelEntry(
      this.tenantId(req),
      this.userId(req),
      id,
      body,
    );
  }

  @Get('installments')
  @Roles('ADMIN', 'OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('finance.read')
  listInstallments(
    @Req() req: JwtAuthRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.finance.listInstallments(this.tenantId(req), query);
  }

  @Post('installments/:id/settle')
  @Roles('ADMIN', 'OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('finance.settle')
  settleInstallment(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body() body: SettleFinanceInstallmentDto,
  ) {
    return this.finance.settleInstallment(
      this.tenantId(req),
      this.userId(req),
      id,
      body,
    );
  }

  @Patch('installments/:id')
  @Roles('ADMIN', 'OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('finance.edit')
  updateInstallment(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body() body: UpdateFinanceInstallmentDto,
  ) {
    return this.finance.updateInstallment(
      this.tenantId(req),
      this.userId(req),
      id,
      body,
    );
  }

  @Post('installments/:id/cancel')
  @Roles('ADMIN', 'OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('finance.cancel')
  cancelInstallment(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body() body?: CancelFinanceInstallmentDto,
  ) {
    return this.finance.cancelInstallment(
      this.tenantId(req),
      this.userId(req),
      id,
      body,
    );
  }

  @Get('accounts')
  @Roles('ADMIN', 'OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('finance.catalog.read')
  listAccounts(@Req() req: JwtAuthRequest) {
    return this.finance.listAccounts(this.tenantId(req));
  }

  @Post('accounts')
  @Roles('ADMIN', 'OWNER')
  @Permissions('finance.catalog.manage')
  createAccount(
    @Req() req: JwtAuthRequest,
    @Body() body: CreateFinanceAccountDto,
  ) {
    return this.finance.createAccount(
      this.tenantId(req),
      this.userId(req),
      body,
    );
  }

  @Patch('accounts/:id')
  @Roles('ADMIN', 'OWNER')
  @Permissions('finance.catalog.manage')
  updateAccount(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body() body: CreateFinanceAccountDto,
  ) {
    return this.finance.updateAccount(
      this.tenantId(req),
      this.userId(req),
      id,
      body,
    );
  }

  @Get('categories')
  @Roles('ADMIN', 'OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('finance.catalog.read')
  listCategories(@Req() req: JwtAuthRequest) {
    return this.finance.listCategories(this.tenantId(req));
  }

  @Post('categories')
  @Roles('ADMIN', 'OWNER')
  @Permissions('finance.catalog.manage')
  createCategory(
    @Req() req: JwtAuthRequest,
    @Body() body: CreateFinanceCategoryDto,
  ) {
    return this.finance.createCategory(
      this.tenantId(req),
      this.userId(req),
      body,
    );
  }

  @Patch('categories/:id')
  @Roles('ADMIN', 'OWNER')
  @Permissions('finance.catalog.manage')
  updateCategory(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body() body: CreateFinanceCategoryDto,
  ) {
    return this.finance.updateCategory(
      this.tenantId(req),
      this.userId(req),
      id,
      body,
    );
  }

  @Get('cost-centers')
  @Roles('ADMIN', 'OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('finance.catalog.read')
  listCostCenters(@Req() req: JwtAuthRequest) {
    return this.finance.listCostCenters(this.tenantId(req));
  }

  @Post('cost-centers')
  @Roles('ADMIN', 'OWNER')
  @Permissions('finance.catalog.manage')
  createCostCenter(
    @Req() req: JwtAuthRequest,
    @Body() body: CreateFinanceCostCenterDto,
  ) {
    return this.finance.createCostCenter(
      this.tenantId(req),
      this.userId(req),
      body,
    );
  }

  @Patch('cost-centers/:id')
  @Roles('ADMIN', 'OWNER')
  @Permissions('finance.catalog.manage')
  updateCostCenter(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body() body: CreateFinanceCostCenterDto,
  ) {
    return this.finance.updateCostCenter(
      this.tenantId(req),
      this.userId(req),
      id,
      body,
    );
  }

  @Get('summary')
  @Roles('ADMIN', 'OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('finance.read')
  getSummary(
    @Req() req: JwtAuthRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.finance.getSummary(this.tenantId(req), query);
  }

  @Get('cashflow')
  @Roles('ADMIN', 'OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('finance.read')
  getCashflow(
    @Req() req: JwtAuthRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.finance.getCashflow(this.tenantId(req), query);
  }

  @Get('aging')
  @Roles('ADMIN', 'OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('finance.read')
  getAging(
    @Req() req: JwtAuthRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.finance.getAging(this.tenantId(req), query);
  }

  @Get('matters/:matterId/export.pdf')
  @Roles('ADMIN', 'OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('finance.read')
  async exportMatterPdf(
    @Req() req: JwtAuthRequest,
    @Res() res: Response,
    @Param('matterId') matterId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const report = await this.finance.exportMatterPdf(
      this.tenantId(req),
      matterId,
      query,
    );
    await this.finance.logMatterPdfExport(
      this.tenantId(req),
      this.userId(req),
      matterId,
      query,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${report.fileName}"`,
    );
    res.send(report.pdf);
  }

  @Get('recurrence-templates')
  @Roles('ADMIN', 'OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('finance.catalog.read')
  listRecurrenceTemplates(@Req() req: JwtAuthRequest) {
    return this.finance.listRecurrenceTemplates(this.tenantId(req));
  }

  @Post('recurrence-templates')
  @Roles('ADMIN', 'OWNER')
  @Permissions('finance.recurrence.manage')
  createRecurrenceTemplate(
    @Req() req: JwtAuthRequest,
    @Body() body: CreateFinanceRecurrenceTemplateDto,
  ) {
    return this.finance.createRecurrenceTemplate(
      this.tenantId(req),
      this.userId(req),
      body,
    );
  }

  @Patch('recurrence-templates/:id')
  @Roles('ADMIN', 'OWNER')
  @Permissions('finance.recurrence.manage')
  updateRecurrenceTemplate(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body() body: CreateFinanceRecurrenceTemplateDto,
  ) {
    return this.finance.updateRecurrenceTemplate(
      this.tenantId(req),
      this.userId(req),
      id,
      body,
    );
  }

  @Post('recurrence-templates/:id/generate')
  @Roles('ADMIN', 'OWNER')
  @Permissions('finance.recurrence.manage')
  generateFromRecurrenceTemplate(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body() body?: GenerateRecurrenceDto,
  ) {
    return this.finance.generateFromRecurrenceTemplate(
      this.tenantId(req),
      this.userId(req),
      id,
      body,
    );
  }

  @Post('recurrence/generate-range')
  @Roles('ADMIN', 'OWNER')
  @Permissions('finance.recurrence.manage')
  generateRecurrenceRange(
    @Req() req: JwtAuthRequest,
    @Body() body?: { from?: string; to?: string },
  ) {
    const from = String(body?.from || '').trim();
    const to = String(body?.to || '').trim();
    if (!from || !to) {
      throw new BadRequestException('from e to são obrigatórios');
    }
    return this.finance.generateRecurrenceRange(
      this.tenantId(req),
      this.userId(req),
      { from, to },
    );
  }
}
