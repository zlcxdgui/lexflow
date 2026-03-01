import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { nextTenantCode } from '../common/tenant-code';
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
import PDFDocument = require('pdfkit');

type ListQuery = Record<string, string | undefined>;
type Direction = 'IN' | 'OUT';
type Frequency = 'WEEKLY' | 'MONTHLY' | 'YEARLY';
type InstallmentStatus = 'OPEN' | 'SETTLED' | 'OVERDUE' | 'CANCELED';
type EntryStatus = 'OPEN' | 'PARTIAL' | 'SETTLED' | 'OVERDUE' | 'CANCELED';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private trim(value?: string | null) {
    return String(value || '').trim();
  }

  private trimOrNull(value?: string | null) {
    const text = this.trim(value);
    return text || null;
  }

  private parseDate(value?: string | null, label = 'data') {
    const text = this.trim(value);
    if (!text) throw new BadRequestException(`${label} é obrigatória`);
    const d = new Date(text);
    if (Number.isNaN(d.getTime()))
      throw new BadRequestException(`${label} inválida`);
    return d;
  }

  private parseOptionalDate(value?: string | null) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const text = this.trim(value);
    if (!text) return null;
    const d = new Date(text);
    if (Number.isNaN(d.getTime()))
      throw new BadRequestException('Data inválida');
    return d;
  }

  private parseIntStrict(
    value: unknown,
    label: string,
    min = 0,
    max = 1_000_000_000,
  ) {
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
      throw new BadRequestException(`${label} inválido`);
    }
    return n;
  }

  private normalizeDirection(value?: string | null): Direction {
    const v = this.trim(value).toUpperCase();
    if (v === 'IN' || v === 'OUT') return v;
    throw new BadRequestException('direction inválido');
  }

  private normalizeFrequency(value?: string | null): Frequency {
    const v = this.trim(value || 'MONTHLY').toUpperCase();
    if (v === 'WEEKLY' || v === 'MONTHLY' || v === 'YEARLY') return v;
    throw new BadRequestException('Frequência inválida');
  }

  private normalizeAccountType(value?: string | null) {
    const v = this.trim(value || 'BANK').toUpperCase();
    if (['CASH', 'BANK', 'DIGITAL'].includes(v)) return v;
    throw new BadRequestException('Tipo de conta inválido');
  }

  private normalizeCategoryKind(value?: string | null) {
    const v = this.trim(value || 'BOTH').toUpperCase();
    if (['RECEIVABLE', 'PAYABLE', 'BOTH'].includes(v)) return v;
    throw new BadRequestException('Kind de categoria inválido');
  }

  private normalizePaymentMethod(value?: string | null) {
    if (value == null) return null;
    const v = this.trim(value).toUpperCase();
    if (!v) return null;
    if (['CASH', 'PIX', 'BANK_TRANSFER', 'CARD', 'OTHER'].includes(v)) return v;
    throw new BadRequestException('Forma de pagamento inválida');
  }

  private async getTenantTimezone(tenantId: string) {
    const tenantModel = (this.prisma as any)?.tenant;
    if (!tenantModel?.findUnique) return 'America/Manaus';
    try {
      const tenant = await tenantModel.findUnique({
        where: { id: tenantId },
        select: { timezone: true },
      });
      return String(tenant?.timezone || 'America/Manaus');
    } catch {
      return 'America/Manaus';
    }
  }

  private datePartsInTimeZone(date: Date, timeZone: string) {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(date);
    const year = Number(parts.find((p) => p.type === 'year')?.value || '0');
    const month = Number(parts.find((p) => p.type === 'month')?.value || '1');
    const day = Number(parts.find((p) => p.type === 'day')?.value || '1');
    return { year, month, day };
  }

  private daySerialInTimeZone(date: Date, timeZone: string) {
    const parts = this.datePartsInTimeZone(date, timeZone);
    return Math.floor(
      Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000,
    );
  }

  private dateKeyInTimeZone(date: Date, timeZone: string) {
    const parts = this.datePartsInTimeZone(date, timeZone);
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  }

  private startOfMonthInTimeZone(now: Date, timeZone: string) {
    const parts = this.datePartsInTimeZone(now, timeZone);
    return new Date(Date.UTC(parts.year, parts.month - 1, 1, 0, 0, 0, 0));
  }

  private monthRangeInTimeZone(now: Date, timeZone: string) {
    const parts = this.datePartsInTimeZone(now, timeZone);
    const from = new Date(Date.UTC(parts.year, parts.month - 1, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(parts.year, parts.month, 0, 23, 59, 59, 999));
    return { from, to };
  }

  private endOfDay(date: Date) {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      23,
      59,
      59,
      999,
    );
  }

  private formatCurrencyCents(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format((Number(value || 0) || 0) / 100);
  }

  private formatDateBR(
    date: Date | string | null | undefined,
    timeZone = 'America/Manaus',
  ) {
    if (!date) return '-';
    const raw = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(raw.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(raw);
  }

  private formatDateTimeBR(
    date: Date | string | null | undefined,
    timeZone = 'America/Manaus',
  ) {
    if (!date) return '-';
    const raw = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(raw.getTime())) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(raw);
  }

  private directionLabel(value?: string | null) {
    return String(value || '').toUpperCase() === 'OUT' ? 'Pagar' : 'Receber';
  }

  private statusLabel(value?: string | null) {
    const raw = String(value || '').toUpperCase();
    if (raw === 'SETTLED') return 'Quitado';
    if (raw === 'OVERDUE') return 'Vencido';
    if (raw === 'CANCELED') return 'Cancelado';
    if (raw === 'PARTIAL') return 'Parcial';
    return 'Em aberto';
  }

  private sanitizeFileNamePart(value?: string | null) {
    const base = String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_ ]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();
    return base || 'caso';
  }

  private pagination(query: ListQuery) {
    const page = Math.max(1, Number(query.page || '1') || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(query.pageSize || '20') || 20),
    );
    return { page, pageSize, skip: (page - 1) * pageSize };
  }

  private effectiveInstallmentStatus(
    item: {
      status: string;
      dueDate: Date;
      paidAt?: Date | null;
      canceledAt?: Date | null;
    },
    tenantTimeZone = 'America/Manaus',
  ): InstallmentStatus {
    const raw = String(item.status || '').toUpperCase();
    if (raw === 'CANCELED' || item.canceledAt) return 'CANCELED';
    if (raw === 'SETTLED' || item.paidAt) return 'SETTLED';
    const dueSerial = this.daySerialInTimeZone(
      new Date(item.dueDate),
      tenantTimeZone,
    );
    const todaySerial = this.daySerialInTimeZone(new Date(), tenantTimeZone);
    if (dueSerial < todaySerial) return 'OVERDUE';
    return 'OPEN';
  }

  private deriveEntryStatus(
    installments: Array<{
      status: string;
      dueDate: Date;
      paidAt?: Date | null;
      canceledAt?: Date | null;
    }>,
    tenantTimeZone = 'America/Manaus',
  ): EntryStatus {
    if (!installments.length) return 'OPEN';
    const statuses = installments.map((i) =>
      this.effectiveInstallmentStatus(i, tenantTimeZone),
    );
    const hasOpen = statuses.some((s) => s === 'OPEN');
    const hasOverdue = statuses.some((s) => s === 'OVERDUE');
    const hasSettled = statuses.some((s) => s === 'SETTLED');
    const hasCanceled = statuses.some((s) => s === 'CANCELED');
    if (statuses.every((s) => s === 'CANCELED')) return 'CANCELED';
    if (statuses.every((s) => s === 'SETTLED')) return 'SETTLED';
    if (hasOverdue) return 'OVERDUE';
    if ((hasSettled || hasCanceled) && hasOpen) return 'PARTIAL';
    if (hasSettled && hasCanceled) return 'PARTIAL';
    return 'OPEN';
  }

  private serializeInstallment(row: any, tenantTimeZone = 'America/Manaus') {
    return {
      ...row,
      effectiveStatus: this.effectiveInstallmentStatus(row, tenantTimeZone),
    };
  }

  private serializeEntry(row: any, tenantTimeZone = 'America/Manaus') {
    const installments = Array.isArray(row.installments)
      ? row.installments
      : [];
    const effectiveStatus = this.deriveEntryStatus(
      installments,
      tenantTimeZone,
    );
    const installmentsSummary = installments.reduce(
      (acc: any, item: any) => {
        const s = this.effectiveInstallmentStatus(item, tenantTimeZone);
        acc.total += 1;
        acc.totalAmountCents += Number(item.amountCents || 0);
        acc[s.toLowerCase()] += 1;
        return acc;
      },
      {
        total: 0,
        totalAmountCents: 0,
        open: 0,
        settled: 0,
        overdue: 0,
        canceled: 0,
      },
    );
    return {
      ...row,
      effectiveStatus,
      installments: installments.map((i: any) =>
        this.serializeInstallment(i, tenantTimeZone),
      ),
      installmentsSummary,
    };
  }

  private async ensureClient(tenantId: string, clientId?: string | null) {
    if (!clientId) return null;
    const row = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Pessoa não encontrada');
    return row.id;
  }

  private async ensureMatter(tenantId: string, matterId?: string | null) {
    if (!matterId) return null;
    const row = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      select: { id: true, clientId: true },
    });
    if (!row) throw new NotFoundException('Caso não encontrado');
    return row;
  }

  private async ensureCategory(tenantId: string, id?: string | null) {
    const value = this.trim(id);
    if (!value) throw new BadRequestException('Categoria é obrigatória');
    const row = await this.prisma.financeCategory.findFirst({
      where: { id: value, tenantId },
    });
    if (!row)
      throw new NotFoundException('Categoria financeira não encontrada');
    return row;
  }

  private async ensureCostCenter(tenantId: string, id?: string | null) {
    const value = this.trim(id);
    if (!value) throw new BadRequestException('Centro de custo é obrigatório');
    const row = await this.prisma.financeCostCenter.findFirst({
      where: { id: value, tenantId },
    });
    if (!row) throw new NotFoundException('Centro de custo não encontrado');
    return row;
  }

  private async ensureAccount(tenantId: string, id?: string | null) {
    const value = this.trim(id);
    if (!value) throw new BadRequestException('Conta é obrigatória');
    const row = await this.prisma.financeAccount.findFirst({
      where: { id: value, tenantId },
    });
    if (!row) throw new NotFoundException('Conta financeira não encontrada');
    return row;
  }

  private async validateEntryLinks(input: {
    tenantId: string;
    direction: Direction;
    clientId?: string | null;
    matterId?: string | null;
    categoryId?: string | null;
    costCenterId?: string | null;
    accountId?: string | null;
  }) {
    const [clientId, matter, category, costCenter, account] = await Promise.all(
      [
        this.ensureClient(input.tenantId, input.clientId || null),
        this.ensureMatter(input.tenantId, input.matterId || null),
        this.ensureCategory(input.tenantId, input.categoryId || null),
        this.ensureCostCenter(input.tenantId, input.costCenterId || null),
        this.ensureAccount(input.tenantId, input.accountId || null),
      ],
    );
    if (matter?.clientId && clientId && matter.clientId !== clientId) {
      throw new BadRequestException(
        'Pessoa não corresponde ao caso selecionado',
      );
    }
    const expected = input.direction === 'IN' ? 'RECEIVABLE' : 'PAYABLE';
    const kind = String(category.kind || 'BOTH').toUpperCase();
    if (kind !== 'BOTH' && kind !== expected) {
      throw new BadRequestException(
        'Categoria incompatível com tipo de lançamento',
      );
    }
    return {
      clientId,
      matterId: matter?.id || null,
      categoryId: category.id,
      costCenterId: costCenter.id,
      accountId: account.id,
    };
  }

  private async refreshEntryStatusTx(
    tx: any,
    tenantId: string,
    entryId: string,
    tenantTimeZone = 'America/Manaus',
  ) {
    const rows = await tx.financeInstallment.findMany({
      where: { tenantId, entryId },
      select: { status: true, dueDate: true, paidAt: true, canceledAt: true },
    });
    const status = this.deriveEntryStatus(rows, tenantTimeZone);
    await tx.financeEntry.update({ where: { id: entryId }, data: { status } });
    return status;
  }

  async listAccounts(tenantId: string) {
    return this.prisma.financeAccount.findMany({
      where: { tenantId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createAccount(
    tenantId: string,
    actorId: string,
    dto: CreateFinanceAccountDto,
  ) {
    const name = this.trim(dto.name);
    if (!name) throw new BadRequestException('Nome é obrigatório');
    const created = await this.prisma.$transaction(async (tx) => {
      const code = await nextTenantCode(tx, tenantId, 'FINANCE_ACCOUNT');
      return tx.financeAccount.create({
        data: {
          tenantId,
          code,
          name,
          type: this.normalizeAccountType(dto.type),
          isActive: dto.isActive !== false,
        },
      });
    });
    await this.audit.log(
      tenantId,
      'FINANCE_CATALOG_ACCOUNT_CREATED',
      actorId,
      undefined,
      { financeAccountId: created.id, name },
    );
    return created;
  }

  async updateAccount(
    tenantId: string,
    actorId: string,
    id: string,
    dto: CreateFinanceAccountDto,
  ) {
    const current = await this.prisma.financeAccount.findFirst({
      where: { id, tenantId },
    });
    if (!current)
      throw new NotFoundException('Conta financeira não encontrada');
    const updated = await this.prisma.financeAccount.update({
      where: { id },
      data: {
        name:
          dto.name !== undefined
            ? this.trim(dto.name) || current.name
            : undefined,
        type:
          dto.type !== undefined
            ? this.normalizeAccountType(dto.type)
            : undefined,
        isActive:
          dto.isActive !== undefined ? Boolean(dto.isActive) : undefined,
      },
    });
    await this.audit.log(
      tenantId,
      'FINANCE_CATALOG_ACCOUNT_UPDATED',
      actorId,
      undefined,
      { financeAccountId: updated.id },
    );
    return updated;
  }

  async listCategories(tenantId: string) {
    return this.prisma.financeCategory.findMany({
      where: { tenantId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createCategory(
    tenantId: string,
    actorId: string,
    dto: CreateFinanceCategoryDto,
  ) {
    const name = this.trim(dto.name);
    if (!name) throw new BadRequestException('Nome é obrigatório');
    const created = await this.prisma.$transaction(async (tx) => {
      const code = await nextTenantCode(tx, tenantId, 'FINANCE_CATEGORY');
      return tx.financeCategory.create({
        data: {
          tenantId,
          code,
          name,
          kind: this.normalizeCategoryKind(dto.kind),
          isActive: dto.isActive !== false,
        },
      });
    });
    await this.audit.log(
      tenantId,
      'FINANCE_CATALOG_CATEGORY_CREATED',
      actorId,
      undefined,
      { financeCategoryId: created.id },
    );
    return created;
  }

  async updateCategory(
    tenantId: string,
    actorId: string,
    id: string,
    dto: CreateFinanceCategoryDto,
  ) {
    const current = await this.prisma.financeCategory.findFirst({
      where: { id, tenantId },
    });
    if (!current)
      throw new NotFoundException('Categoria financeira não encontrada');
    const updated = await this.prisma.financeCategory.update({
      where: { id },
      data: {
        name:
          dto.name !== undefined
            ? this.trim(dto.name) || current.name
            : undefined,
        kind:
          dto.kind !== undefined
            ? this.normalizeCategoryKind(dto.kind)
            : undefined,
        isActive:
          dto.isActive !== undefined ? Boolean(dto.isActive) : undefined,
      },
    });
    await this.audit.log(
      tenantId,
      'FINANCE_CATALOG_CATEGORY_UPDATED',
      actorId,
      undefined,
      { financeCategoryId: updated.id },
    );
    return updated;
  }

  async listCostCenters(tenantId: string) {
    return this.prisma.financeCostCenter.findMany({
      where: { tenantId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createCostCenter(
    tenantId: string,
    actorId: string,
    dto: CreateFinanceCostCenterDto,
  ) {
    const name = this.trim(dto.name);
    if (!name) throw new BadRequestException('Nome é obrigatório');
    const created = await this.prisma.$transaction(async (tx) => {
      const code = await nextTenantCode(tx, tenantId, 'FINANCE_COST_CENTER');
      return tx.financeCostCenter.create({
        data: { tenantId, code, name, isActive: dto.isActive !== false },
      });
    });
    await this.audit.log(
      tenantId,
      'FINANCE_CATALOG_COST_CENTER_CREATED',
      actorId,
      undefined,
      { financeCostCenterId: created.id },
    );
    return created;
  }

  async updateCostCenter(
    tenantId: string,
    actorId: string,
    id: string,
    dto: CreateFinanceCostCenterDto,
  ) {
    const current = await this.prisma.financeCostCenter.findFirst({
      where: { id, tenantId },
    });
    if (!current) throw new NotFoundException('Centro de custo não encontrado');
    const updated = await this.prisma.financeCostCenter.update({
      where: { id },
      data: {
        name:
          dto.name !== undefined
            ? this.trim(dto.name) || current.name
            : undefined,
        isActive:
          dto.isActive !== undefined ? Boolean(dto.isActive) : undefined,
      },
    });
    await this.audit.log(
      tenantId,
      'FINANCE_CATALOG_COST_CENTER_UPDATED',
      actorId,
      undefined,
      { financeCostCenterId: updated.id },
    );
    return updated;
  }

  private splitInstallments(total: number, count: number) {
    const base = Math.floor(total / count);
    const rem = total - base * count;
    return Array.from(
      { length: count },
      (_, index) => base + (index === count - 1 ? rem : 0),
    );
  }

  private addFrequency(baseDate: Date, index: number, frequency: Frequency) {
    const d = new Date(baseDate);
    if (frequency === 'WEEKLY') {
      d.setDate(d.getDate() + index * 7);
      return d;
    }
    if (frequency === 'YEARLY') {
      d.setFullYear(d.getFullYear() + index);
      return d;
    }
    d.setMonth(d.getMonth() + index);
    return d;
  }

  private buildInstallments(
    dto: CreateFinanceEntryDto,
    totalAmountCents: number,
  ) {
    const count = this.parseIntStrict(
      dto.installmentsCount ?? 1,
      'Quantidade de parcelas',
      1,
      360,
    );
    const firstDueDate = this.parseDate(
      dto.firstDueDate,
      'Primeiro vencimento',
    );
    const frequency = this.normalizeFrequency(dto.installmentFrequency);
    const amounts = this.splitInstallments(totalAmountCents, count);
    return amounts.map((amountCents, index) => ({
      number: index + 1,
      amountCents,
      dueDate: this.addFrequency(firstDueDate, index, frequency),
      status: 'OPEN',
    }));
  }

  private async createEntryInternal(
    tx: any,
    tenantId: string,
    actorId: string,
    dto: CreateFinanceEntryDto,
    opts?: { origin?: string; recurrenceTemplateId?: string | null },
  ) {
    const direction = this.normalizeDirection(dto.direction);
    const description = this.trim(dto.description);
    if (!description) throw new BadRequestException('Descrição é obrigatória');
    const totalAmountCents = this.parseIntStrict(
      dto.totalAmountCents,
      'Valor total',
      1,
    );
    const issueDate = this.parseDate(dto.issueDate, 'Data de emissão');
    const competenceDate = this.parseOptionalDate(dto.competenceDate);
    const links = await this.validateEntryLinks({
      tenantId,
      direction,
      clientId: dto.clientId || null,
      matterId: dto.matterId || null,
      categoryId: dto.categoryId,
      costCenterId: dto.costCenterId,
      accountId: dto.accountId,
    });
    const installments = this.buildInstallments(dto, totalAmountCents);
    const code = await nextTenantCode(tx, tenantId, 'FINANCE_ENTRY');

    const created = await tx.financeEntry.create({
      data: {
        code,
        tenantId,
        direction,
        status: 'OPEN',
        description,
        notes: this.trimOrNull(dto.notes),
        clientId: links.clientId,
        matterId: links.matterId,
        categoryId: links.categoryId,
        costCenterId: links.costCenterId,
        accountId: links.accountId,
        issueDate,
        competenceDate: competenceDate === undefined ? null : competenceDate,
        totalAmountCents,
        installmentsCount: installments.length,
        origin: String(opts?.origin || 'MANUAL').toUpperCase(),
        recurrenceTemplateId: opts?.recurrenceTemplateId || null,
        createdByUserId: actorId,
        installments: {
          create: installments.map((inst) => ({ ...inst, tenantId })),
        },
      },
      include: {
        client: { select: { id: true, name: true, code: true } },
        matter: { select: { id: true, title: true, code: true } },
        category: true,
        costCenter: true,
        account: true,
        installments: { orderBy: { number: 'asc' } },
      },
    });
    await this.refreshEntryStatusTx(tx, tenantId, created.id);
    return created;
  }

  async createEntry(
    tenantId: string,
    actorId: string,
    dto: CreateFinanceEntryDto,
  ) {
    const tenantTimeZone = await this.getTenantTimezone(tenantId);
    const created = await this.prisma.$transaction((tx) =>
      this.createEntryInternal(tx, tenantId, actorId, dto, {
        origin: 'MANUAL',
      }),
    );
    await this.audit.log(
      tenantId,
      'FINANCE_ENTRY_CREATED',
      actorId,
      created.matterId || undefined,
      {
        financeEntryId: created.id,
        direction: created.direction,
        totalAmountCents: created.totalAmountCents,
        installmentsCount: created.installmentsCount,
        clientId: created.clientId,
        matterId: created.matterId,
      },
    );
    return this.serializeEntry(created, tenantTimeZone);
  }

  async getEntry(tenantId: string, id: string) {
    const tenantTimeZone = await this.getTenantTimezone(tenantId);
    const row = await this.prisma.financeEntry.findFirst({
      where: { id, tenantId },
      include: {
        client: { select: { id: true, name: true, code: true } },
        matter: { select: { id: true, title: true, code: true } },
        category: true,
        costCenter: true,
        account: true,
        createdBy: { select: { id: true, name: true, email: true } },
        canceledBy: { select: { id: true, name: true, email: true } },
        installments: {
          orderBy: [{ number: 'asc' }],
          include: {
            account: true,
            settledBy: { select: { id: true, name: true, email: true } },
            canceledBy: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!row)
      throw new NotFoundException('Lançamento financeiro não encontrado');
    return this.serializeEntry(row, tenantTimeZone);
  }

  async updateEntry(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateFinanceEntryDto,
  ) {
    const tenantTimeZone = await this.getTenantTimezone(tenantId);
    const current = await this.prisma.financeEntry.findFirst({
      where: { id, tenantId },
      include: { installments: true },
    });
    if (!current)
      throw new NotFoundException('Lançamento financeiro não encontrado');

    const structuralChange =
      dto.clientId !== undefined ||
      dto.matterId !== undefined ||
      dto.categoryId !== undefined ||
      dto.costCenterId !== undefined ||
      dto.accountId !== undefined ||
      dto.issueDate !== undefined ||
      dto.competenceDate !== undefined;
    if (
      structuralChange &&
      current.installments.some(
        (inst) =>
          this.effectiveInstallmentStatus(inst, tenantTimeZone) === 'SETTLED',
      )
    ) {
      throw new BadRequestException(
        'Não é possível alterar estrutura após baixa em parcela',
      );
    }

    let links:
      | {
          clientId: string | null;
          matterId: string | null;
          categoryId: string;
          costCenterId: string;
          accountId: string;
        }
      | undefined;
    if (structuralChange) {
      links = await this.validateEntryLinks({
        tenantId,
        direction:
          String(current.direction || 'IN').toUpperCase() === 'OUT'
            ? 'OUT'
            : 'IN',
        clientId: dto.clientId === undefined ? current.clientId : dto.clientId,
        matterId: dto.matterId === undefined ? current.matterId : dto.matterId,
        categoryId:
          dto.categoryId === undefined ? current.categoryId : dto.categoryId,
        costCenterId:
          dto.costCenterId === undefined
            ? current.costCenterId
            : dto.costCenterId,
        accountId:
          dto.accountId === undefined ? current.accountId : dto.accountId,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.financeEntry.update({
        where: { id },
        data: {
          description:
            dto.description !== undefined
              ? this.trim(dto.description) || current.description
              : undefined,
          notes:
            dto.notes !== undefined ? this.trimOrNull(dto.notes) : undefined,
          clientId: links ? links.clientId : undefined,
          matterId: links ? links.matterId : undefined,
          categoryId: links ? links.categoryId : undefined,
          costCenterId: links ? links.costCenterId : undefined,
          accountId: links ? links.accountId : undefined,
          issueDate:
            dto.issueDate !== undefined
              ? this.parseDate(dto.issueDate, 'Data de emissão')
              : undefined,
          competenceDate:
            dto.competenceDate !== undefined
              ? this.parseOptionalDate(dto.competenceDate)
              : undefined,
        },
        include: {
          client: { select: { id: true, name: true, code: true } },
          matter: { select: { id: true, title: true, code: true } },
          category: true,
          costCenter: true,
          account: true,
          installments: { orderBy: { number: 'asc' } },
        },
      });
      await this.refreshEntryStatusTx(tx, tenantId, id, tenantTimeZone);
      return row;
    });

    await this.audit.log(
      tenantId,
      'FINANCE_ENTRY_UPDATED',
      actorId,
      updated.matterId || undefined,
      {
        financeEntryId: updated.id,
      },
    );
    return this.serializeEntry(updated, tenantTimeZone);
  }

  async cancelEntry(
    tenantId: string,
    actorId: string,
    id: string,
    dto?: CancelFinanceEntryDto,
  ) {
    const tenantTimeZone = await this.getTenantTimezone(tenantId);
    const current = await this.prisma.financeEntry.findFirst({
      where: { id, tenantId },
      include: { installments: true },
    });
    if (!current)
      throw new NotFoundException('Lançamento financeiro não encontrado');
    const reason = this.trimOrNull(dto?.reason);
    if (!reason) {
      throw new BadRequestException('Motivo do cancelamento é obrigatório');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.financeInstallment.updateMany({
        where: { tenantId, entryId: id, status: { in: ['OPEN', 'OVERDUE'] } },
        data: {
          status: 'CANCELED',
          canceledAt: new Date(),
          canceledByUserId: actorId,
        },
      });
      return tx.financeEntry.update({
        where: { id },
        data: {
          status: 'CANCELED',
          canceledAt: new Date(),
          canceledByUserId: actorId,
        },
        include: {
          client: { select: { id: true, name: true, code: true } },
          matter: { select: { id: true, title: true, code: true } },
          category: true,
          costCenter: true,
          account: true,
          installments: { orderBy: { number: 'asc' } },
        },
      });
    });
    await this.audit.log(
      tenantId,
      'FINANCE_ENTRY_CANCELED',
      actorId,
      updated.matterId || undefined,
      {
        financeEntryId: updated.id,
        reason,
      },
    );
    return this.serializeEntry(updated, tenantTimeZone);
  }

  async listEntries(tenantId: string, query: ListQuery) {
    const tenantTimeZone = await this.getTenantTimezone(tenantId);
    const { page, pageSize } = this.pagination(query);
    const q = this.trim(query.q).toLowerCase();
    const direction = this.trim(query.direction).toUpperCase();
    const status = this.trim(query.status).toUpperCase();
    const rows = await this.prisma.financeEntry.findMany({
      where: {
        tenantId,
        ...(direction === 'IN' || direction === 'OUT' ? { direction } : {}),
        ...(query.clientId ? { clientId: query.clientId } : {}),
        ...(query.matterId ? { matterId: query.matterId } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.costCenterId ? { costCenterId: query.costCenterId } : {}),
        ...(query.accountId ? { accountId: query.accountId } : {}),
      },
      include: {
        client: { select: { id: true, name: true, code: true } },
        matter: { select: { id: true, title: true, code: true } },
        category: true,
        costCenter: true,
        account: true,
        installments: { orderBy: [{ dueDate: 'asc' }, { number: 'asc' }] },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    let value = rows.map((row) => this.serializeEntry(row, tenantTimeZone));
    if (q) {
      value = value.filter((row: any) =>
        [
          row.description,
          row.client?.name,
          row.matter?.title,
          row.category?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    if (status && status !== 'ALL') {
      value = value.filter((row: any) => row.effectiveStatus === status);
    }
    if (query.dueFrom || query.dueTo) {
      const dueFrom = query.dueFrom
        ? this.parseDate(query.dueFrom, 'dueFrom')
        : null;
      const dueTo = query.dueTo
        ? this.endOfDay(this.parseDate(query.dueTo, 'dueTo'))
        : null;
      value = value.filter((row: any) =>
        row.installments.some((inst: any) => {
          const d = new Date(inst.dueDate);
          if (dueFrom && d < dueFrom) return false;
          if (dueTo && d > dueTo) return false;
          return true;
        }),
      );
    }
    const total = value.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    return {
      value: value.slice(start, start + pageSize),
      total,
      page: currentPage,
      pageSize,
      totalPages,
    };
  }

  async listInstallments(tenantId: string, query: ListQuery) {
    const tenantTimeZone = await this.getTenantTimezone(tenantId);
    const { page, pageSize } = this.pagination(query);
    const q = this.trim(query.q).toLowerCase();
    const status = this.trim(query.status).toUpperCase();
    const direction = this.trim(query.direction).toUpperCase();
    const dateBasis =
      this.trim(query.dateBasis).toUpperCase() === 'PAID' ? 'PAID' : 'DUE';
    const dueFrom = query.dueFrom
      ? this.parseDate(query.dueFrom, 'dueFrom')
      : null;
    const dueTo = query.dueTo
      ? this.endOfDay(this.parseDate(query.dueTo, 'dueTo'))
      : null;
    const rows = await this.prisma.financeInstallment.findMany({
      where: {
        tenantId,
        ...(query.entryId ? { entryId: query.entryId } : {}),
        ...(query.accountId ? { accountId: query.accountId } : {}),
        entry: {
          ...(direction === 'IN' || direction === 'OUT' ? { direction } : {}),
          ...(query.clientId ? { clientId: query.clientId } : {}),
          ...(query.matterId ? { matterId: query.matterId } : {}),
          ...(query.categoryId ? { categoryId: query.categoryId } : {}),
          ...(query.costCenterId ? { costCenterId: query.costCenterId } : {}),
        },
      } as any,
      include: {
        account: true,
        settledBy: { select: { id: true, name: true, email: true } },
        canceledBy: { select: { id: true, name: true, email: true } },
        entry: {
          include: {
            client: { select: { id: true, name: true, code: true } },
            matter: { select: { id: true, title: true, code: true } },
            category: true,
            costCenter: true,
            account: true,
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 5000,
    });
    let value = rows.map((row) =>
      this.serializeInstallment(row, tenantTimeZone),
    );
    if (q) {
      value = value.filter((row: any) =>
        [
          row.description,
          row.entry?.description,
          row.entry?.client?.name,
          row.entry?.matter?.title,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    if (status && status !== 'ALL')
      value = value.filter((row: any) => row.effectiveStatus === status);
    if (dueFrom || dueTo) {
      value = value.filter((row: any) => {
        const effectiveStatus = String(row.effectiveStatus || '').toUpperCase();
        const basisDate =
          dateBasis === 'PAID'
            ? row.paidAt
              ? new Date(row.paidAt)
              : effectiveStatus === 'CANCELED' && row.canceledAt
                ? new Date(row.canceledAt)
                : null
            : new Date(row.dueDate);
        if (!basisDate || Number.isNaN(basisDate.getTime())) return false;
        if (dueFrom && basisDate < dueFrom) return false;
        if (dueTo && basisDate > dueTo) return false;
        return true;
      });
    }
    const total = value.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    return {
      value: value.slice(start, start + pageSize),
      total,
      page: currentPage,
      pageSize,
      totalPages,
    };
  }

  async logMatterPdfExport(
    tenantId: string,
    actorId: string,
    matterId: string,
    query: ListQuery,
  ) {
    await this.audit.log(tenantId, 'REPORT_EXPORTED_PDF', actorId, matterId, {
      module: 'finance',
      scope: 'matter',
      format: 'pdf',
      direction: this.trimOrNull(query.direction),
      status: this.trimOrNull(query.status),
      dueFrom: this.trimOrNull(query.dueFrom),
      dueTo: this.trimOrNull(query.dueTo),
      dateBasis: this.trimOrNull(query.dateBasis),
    });
  }

  async exportMatterPdf(tenantId: string, matterId: string, query: ListQuery) {
    const tenantTimeZone = await this.getTenantTimezone(tenantId);
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      select: {
        id: true,
        code: true,
        title: true,
        client: { select: { id: true, name: true, code: true } },
      },
    });
    if (!matter) throw new NotFoundException('Caso não encontrado');

    const direction = this.trim(query.direction).toUpperCase();
    const status = this.trim(query.status).toUpperCase();
    const dateBasis =
      this.trim(query.dateBasis).toUpperCase() === 'PAID' ? 'PAID' : 'DUE';
    const dueFrom = query.dueFrom
      ? this.parseDate(query.dueFrom, 'dueFrom')
      : null;
    const dueTo = query.dueTo
      ? this.endOfDay(this.parseDate(query.dueTo, 'dueTo'))
      : null;

    const rows = await this.prisma.financeInstallment.findMany({
      where: {
        tenantId,
        entry: {
          matterId,
          ...(direction === 'IN' || direction === 'OUT' ? { direction } : {}),
        },
      } as any,
      include: {
        entry: {
          select: {
            id: true,
            code: true,
            description: true,
            direction: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { number: 'asc' }],
      take: 10000,
    });

    let installments = rows.map((row) =>
      this.serializeInstallment(row, tenantTimeZone),
    );
    if (status && status !== 'ALL') {
      installments = installments.filter(
        (row: any) =>
          String(row.effectiveStatus || '').toUpperCase() === status,
      );
    }
    if (dueFrom || dueTo) {
      installments = installments.filter((row: any) => {
        const effectiveStatus = String(row.effectiveStatus || '').toUpperCase();
        const basisDate =
          dateBasis === 'PAID'
            ? row.paidAt
              ? new Date(row.paidAt)
              : effectiveStatus === 'CANCELED' && row.canceledAt
                ? new Date(row.canceledAt)
                : null
            : new Date(row.dueDate);
        if (!basisDate || Number.isNaN(basisDate.getTime())) return false;
        if (dueFrom && basisDate < dueFrom) return false;
        if (dueTo && basisDate > dueTo) return false;
        return true;
      });
    }

    const summary = installments.reduce(
      (acc, item: any) => {
        const dir =
          String(item.entry?.direction || 'IN').toUpperCase() === 'OUT'
            ? 'OUT'
            : 'IN';
        const effectiveStatus = String(
          item.effectiveStatus || '',
        ).toUpperCase();
        const baseAmount = Number(item.amountCents || 0);
        const paidAmount = Number(
          item.paidAmountCents || item.amountCents || 0,
        );
        if (dir === 'IN') {
          acc.totalIn += baseAmount;
          if (effectiveStatus === 'SETTLED') acc.settledIn += paidAmount;
          if (effectiveStatus === 'OVERDUE') acc.overdueIn += baseAmount;
        } else {
          acc.totalOut += baseAmount;
          if (effectiveStatus === 'SETTLED') acc.settledOut += paidAmount;
          if (effectiveStatus === 'OVERDUE') acc.overdueOut += baseAmount;
        }
        return acc;
      },
      {
        totalIn: 0,
        totalOut: 0,
        settledIn: 0,
        settledOut: 0,
        overdueIn: 0,
        overdueOut: 0,
      },
    );

    const fileDate = this.dateKeyInTimeZone(new Date(), tenantTimeZone);
    const caseRef = matter.code
      ? String(matter.code)
      : this.sanitizeFileNamePart(matter.title);
    const titlePart = this.sanitizeFileNamePart(matter.title);
    const fileName = `financeiro-caso-${caseRef}-${titlePart}-${fileDate}.pdf`;

    return new Promise<{ pdf: Buffer; fileName: string }>((resolve) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 32, size: 'A4' });
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve({ pdf: Buffer.concat(chunks), fileName }));

      const matterCode = matter.code ? `#${matter.code} · ` : '';
      const contentWidth = doc.page.width - 64;
      const pageBottom = doc.page.height - 32;
      const truncate = (text: string, max = 40) =>
        text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text;
      const ensureSpace = (space: number) => {
        if (doc.y + space > pageBottom) doc.addPage();
      };

      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor('#111827')
        .text(`Financeiro do caso ${matterCode}${matter.title}`);
      doc.moveDown(0.3);

      const periodText =
        dueFrom || dueTo
          ? `${dueFrom ? this.formatDateBR(dueFrom, tenantTimeZone) : '-'} até ${dueTo ? this.formatDateBR(dueTo, tenantTimeZone) : '-'}`
          : 'Sem período aplicado';
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#374151')
        .text(`Cliente: ${matter.client?.name || '-'}`)
        .text(`Gerado em: ${this.formatDateTimeBR(new Date(), tenantTimeZone)}`)
        .text(
          `Base de data: ${dateBasis === 'PAID' ? 'Baixa' : 'Vencimento'} · Período: ${periodText}`,
        )
        .text(`Total de parcelas no relatório: ${installments.length}`);

      doc.moveDown(0.6);
      doc
        .moveTo(32, doc.y)
        .lineTo(32 + contentWidth, doc.y)
        .strokeColor('#E5E7EB')
        .stroke();
      doc.moveDown(0.6);

      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#111827')
        .text('Resumo');
      doc.moveDown(0.4);

      const summaryItems = [
        {
          label: 'Receber (previsto)',
          value: this.formatCurrencyCents(summary.totalIn),
        },
        {
          label: 'Recebido',
          value: this.formatCurrencyCents(summary.settledIn),
        },
        {
          label: 'Receber vencido',
          value: this.formatCurrencyCents(summary.overdueIn),
        },
        {
          label: 'Pagar (previsto)',
          value: this.formatCurrencyCents(summary.totalOut),
        },
        { label: 'Pago', value: this.formatCurrencyCents(summary.settledOut) },
        {
          label: 'Pagar vencido',
          value: this.formatCurrencyCents(summary.overdueOut),
        },
      ];
      const gap = 12;
      const cardW = (contentWidth - gap) / 2;
      const cardH = 46;
      const summaryStartY = doc.y;
      for (let i = 0; i < summaryItems.length; i += 1) {
        const item = summaryItems[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 32 + col * (cardW + gap);
        const y = summaryStartY + row * (cardH + 8);
        doc
          .roundedRect(x, y, cardW, cardH, 6)
          .fillAndStroke('#F9FAFB', '#E5E7EB');
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#6B7280')
          .text(item.label, x + 10, y + 8, {
            width: cardW - 20,
          });
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor('#111827')
          .text(item.value, x + 10, y + 21, {
            width: cardW - 20,
          });
      }
      doc.y =
        summaryStartY + Math.ceil(summaryItems.length / 2) * (cardH + 8) + 4;

      ensureSpace(40);
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#111827')
        .text('Parcelas', 32, doc.y, {
          width: contentWidth,
          align: 'left',
        });
      doc.moveDown(0.4);

      const cols = [
        { key: 'title', label: 'Lançamento', width: 180 },
        { key: 'direction', label: 'Tipo', width: 55 },
        { key: 'status', label: 'Status', width: 70 },
        { key: 'dueDate', label: 'Venc.', width: 70 },
        { key: 'paidAt', label: 'Baixa', width: 70 },
        { key: 'amount', label: 'Valor', width: 86 },
      ] as const;
      const tableX = 32;
      const rowH = 20;
      const drawHeader = () => {
        ensureSpace(rowH + 8);
        const headerY = doc.y;
        let x = tableX;
        doc
          .roundedRect(tableX, headerY, contentWidth, rowH, 5)
          .fillAndStroke('#F3F4F6', '#E5E7EB');
        for (const col of cols) {
          doc
            .font('Helvetica-Bold')
            .fontSize(8)
            .fillColor('#374151')
            .text(col.label, x + 6, headerY + 6, {
              width: col.width - 12,
              ellipsis: true,
            });
          x += col.width;
        }
        doc.y = headerY + rowH;
      };

      if (installments.length === 0) {
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#6B7280')
          .text('Nenhuma parcela encontrada para os filtros informados.');
      } else {
        drawHeader();
        for (const row of installments) {
          ensureSpace(rowH + 1);
          if (doc.y + rowH > pageBottom) {
            doc.addPage();
            drawHeader();
          }
          const rowY = doc.y;
          const title = row.entry?.code
            ? `#${row.entry.code} · ${row.entry?.description || `Parcela ${row.number}`}`
            : row.entry?.description || `Parcela ${row.number}`;
          const rowValues: Record<string, string> = {
            title: truncate(title, 56),
            direction: this.directionLabel(row.entry?.direction),
            status: this.statusLabel(row.effectiveStatus),
            dueDate: this.formatDateBR(row.dueDate, tenantTimeZone),
            paidAt: row.paidAt
              ? this.formatDateBR(row.paidAt, tenantTimeZone)
              : '-',
            amount: this.formatCurrencyCents(Number(row.amountCents || 0)),
          };
          doc
            .rect(tableX, rowY, contentWidth, rowH)
            .fillAndStroke('#FFFFFF', '#E5E7EB');
          let x = tableX;
          for (const col of cols) {
            doc
              .font('Helvetica')
              .fontSize(8.5)
              .fillColor('#111827')
              .text(rowValues[col.key], x + 6, rowY + 6, {
                width: col.width - 12,
                ellipsis: true,
              });
            x += col.width;
          }
          doc.y = rowY + rowH;
        }
      }

      doc.end();
    });
  }

  async settleInstallment(
    tenantId: string,
    actorId: string,
    id: string,
    dto: SettleFinanceInstallmentDto,
  ) {
    const tenantTimeZone = await this.getTenantTimezone(tenantId);
    const current = await this.prisma.financeInstallment.findFirst({
      where: { id, tenantId },
      include: { entry: true },
    });
    if (!current)
      throw new NotFoundException('Parcela financeira não encontrada');
    if (
      this.effectiveInstallmentStatus(current, tenantTimeZone) === 'SETTLED'
    ) {
      throw new BadRequestException('Parcela já liquidada');
    }
    if (
      this.effectiveInstallmentStatus(current, tenantTimeZone) === 'CANCELED'
    ) {
      throw new BadRequestException('Parcela cancelada');
    }
    const discountCents =
      dto.discountCents !== undefined
        ? this.parseIntStrict(dto.discountCents, 'Desconto', 0)
        : 0;
    const interestCents =
      dto.interestCents !== undefined
        ? this.parseIntStrict(dto.interestCents, 'Juros', 0)
        : 0;
    const fineCents =
      dto.fineCents !== undefined
        ? this.parseIntStrict(dto.fineCents, 'Multa', 0)
        : 0;
    let accountId: string | null =
      current.accountId || current.entry.accountId || null;
    if (dto.accountId !== undefined) {
      accountId = dto.accountId
        ? (await this.ensureAccount(tenantId, dto.accountId)).id
        : null;
    }
    const paidAmountCents =
      dto.paidAmountCents !== undefined
        ? this.parseIntStrict(dto.paidAmountCents, 'Valor pago', 0)
        : Math.max(
            0,
            Number(current.amountCents || 0) +
              interestCents +
              fineCents -
              discountCents,
          );
    const paidAt = dto.paidAt
      ? this.parseDate(dto.paidAt, 'Data da baixa')
      : new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.financeInstallment.update({
        where: { id },
        data: {
          status: 'SETTLED',
          paidAt,
          paidAmountCents,
          discountCents,
          interestCents,
          fineCents,
          paymentMethod: this.normalizePaymentMethod(dto.paymentMethod),
          accountId,
          settledByUserId: actorId,
        },
      });
      await this.refreshEntryStatusTx(
        tx,
        tenantId,
        row.entryId,
        tenantTimeZone,
      );
      return row;
    });
    await this.audit.log(
      tenantId,
      'FINANCE_INSTALLMENT_SETTLED',
      actorId,
      current.entry.matterId || undefined,
      {
        financeInstallmentId: updated.id,
        financeEntryId: updated.entryId,
        paidAmountCents: updated.paidAmountCents,
        paidAt: updated.paidAt?.toISOString(),
        paymentMethod: updated.paymentMethod,
        notes: this.trimOrNull(dto.notes),
      },
    );
    return this.getEntry(tenantId, current.entryId);
  }

  async updateInstallment(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateFinanceInstallmentDto,
  ) {
    const tenantTimeZone = await this.getTenantTimezone(tenantId);
    const current = await this.prisma.financeInstallment.findFirst({
      where: { id, tenantId },
      include: { entry: true },
    });
    if (!current)
      throw new NotFoundException('Parcela financeira não encontrada');
    const effectiveStatus = this.effectiveInstallmentStatus(
      current,
      tenantTimeZone,
    );
    if (effectiveStatus === 'SETTLED') {
      throw new BadRequestException('Parcela liquidada não pode ser editada');
    }
    if (effectiveStatus === 'CANCELED') {
      throw new BadRequestException('Parcela cancelada não pode ser editada');
    }

    const dueDate =
      dto.dueDate !== undefined
        ? this.parseDate(dto.dueDate, 'Vencimento')
        : undefined;
    const description =
      dto.description !== undefined
        ? this.trimOrNull(dto.description)
        : undefined;
    if (dueDate === undefined && description === undefined) {
      throw new BadRequestException('Nenhuma alteração informada');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.financeInstallment.update({
        where: { id },
        data: {
          dueDate,
          description,
        },
      });
      await this.refreshEntryStatusTx(
        tx,
        tenantId,
        current.entryId,
        tenantTimeZone,
      );
    });

    await this.audit.log(
      tenantId,
      'FINANCE_INSTALLMENT_UPDATED',
      actorId,
      current.entry.matterId || undefined,
      {
        financeInstallmentId: current.id,
        financeEntryId: current.entryId,
        dueDate: dueDate?.toISOString(),
        description,
      },
    );
    return this.getEntry(tenantId, current.entryId);
  }

  async cancelInstallment(
    tenantId: string,
    actorId: string,
    id: string,
    dto?: CancelFinanceInstallmentDto,
  ) {
    const tenantTimeZone = await this.getTenantTimezone(tenantId);
    const current = await this.prisma.financeInstallment.findFirst({
      where: { id, tenantId },
      include: { entry: true },
    });
    if (!current)
      throw new NotFoundException('Parcela financeira não encontrada');
    const reason = this.trimOrNull(dto?.reason);
    if (!reason) {
      throw new BadRequestException('Motivo do cancelamento é obrigatório');
    }
    if (
      this.effectiveInstallmentStatus(current, tenantTimeZone) === 'SETTLED'
    ) {
      throw new BadRequestException('Parcela liquidada não pode ser cancelada');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.financeInstallment.update({
        where: { id },
        data: {
          status: 'CANCELED',
          canceledAt: new Date(),
          canceledByUserId: actorId,
        },
      });
      await this.refreshEntryStatusTx(
        tx,
        tenantId,
        current.entryId,
        tenantTimeZone,
      );
    });
    await this.audit.log(
      tenantId,
      'FINANCE_INSTALLMENT_CANCELED',
      actorId,
      current.entry.matterId || undefined,
      {
        financeInstallmentId: current.id,
        financeEntryId: current.entryId,
        reason,
      },
    );
    return this.getEntry(tenantId, current.entryId);
  }

  async getSummary(tenantId: string, query: ListQuery) {
    const tenantTimeZone = await this.getTenantTimezone(tenantId);
    const now = new Date();
    const defaultRange = this.monthRangeInTimeZone(now, tenantTimeZone);
    const from = query.from
      ? this.parseDate(query.from, 'from')
      : defaultRange.from;
    const to = query.to
      ? this.endOfDay(this.parseDate(query.to, 'to'))
      : defaultRange.to;
    const entryFilter = {
      ...(query.matterId ? { matterId: query.matterId } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
    };

    const [dueRows, paidRows] = await Promise.all([
      this.prisma.financeInstallment.findMany({
        where: {
          tenantId,
          dueDate: { gte: from, lte: to },
          entry: entryFilter,
        } as any,
        include: { entry: { select: { direction: true } } },
        take: 10000,
      }),
      this.prisma.financeInstallment.findMany({
        where: {
          tenantId,
          paidAt: { gte: from, lte: to },
          entry: entryFilter,
        } as any,
        include: { entry: { select: { direction: true } } },
        take: 10000,
      }),
    ]);
    const out = {
      previstoReceber: 0,
      previstoPagar: 0,
      abertoReceber: 0,
      abertoPagar: 0,
      realizadoReceber: 0,
      realizadoPagar: 0,
      saldoPeriodo: 0,
      inadimplenciaReceber: 0,
      breakdownByStatus: {} as Record<
        string,
        { count: number; amountCents: number }
      >,
      period: { from: from.toISOString(), to: to.toISOString() },
    };

    for (const row of dueRows) {
      const dir =
        String(row.entry?.direction || 'IN').toUpperCase() === 'OUT'
          ? 'OUT'
          : 'IN';
      const status = this.effectiveInstallmentStatus(row, tenantTimeZone);
      if (status === 'CANCELED') continue;
      const amount = Number(row.amountCents || 0);
      if (dir === 'IN') out.previstoReceber += amount;
      else out.previstoPagar += amount;
      if (status === 'OPEN' || status === 'OVERDUE') {
        if (dir === 'IN') out.abertoReceber += amount;
        else out.abertoPagar += amount;
      }
      if (dir === 'IN' && status === 'OVERDUE')
        out.inadimplenciaReceber += amount;
      const key = `${dir}:${status}`;
      out.breakdownByStatus[key] = out.breakdownByStatus[key] || {
        count: 0,
        amountCents: 0,
      };
      out.breakdownByStatus[key].count += 1;
      out.breakdownByStatus[key].amountCents += amount;
    }

    for (const row of paidRows) {
      const dir =
        String(row.entry?.direction || 'IN').toUpperCase() === 'OUT'
          ? 'OUT'
          : 'IN';
      const status = this.effectiveInstallmentStatus(row, tenantTimeZone);
      if (status !== 'SETTLED') continue;
      const paid = Number(row.paidAmountCents || row.amountCents || 0);
      if (dir === 'IN') out.realizadoReceber += paid;
      else out.realizadoPagar += paid;
    }

    out.saldoPeriodo = out.realizadoReceber - out.realizadoPagar;
    return out;
  }

  async getCashflow(tenantId: string, query: ListQuery) {
    const tenantTimeZone = await this.getTenantTimezone(tenantId);
    const summary = await this.getSummary(tenantId, query);
    const from = new Date(summary.period.from);
    const to = new Date(summary.period.to);
    const rows = await this.prisma.financeInstallment.findMany({
      where: {
        tenantId,
        OR: [
          { dueDate: { gte: from, lte: to } },
          { paidAt: { gte: from, lte: to } },
        ],
      },
      include: { entry: { select: { direction: true } } },
      take: 10000,
    });
    const pointMap = new Map<
      string,
      { key: string; previsto: number; realizado: number }
    >();
    const keyOf = (d: Date) => this.dateKeyInTimeZone(d, tenantTimeZone);
    for (const row of rows) {
      const dir =
        String(row.entry?.direction || 'IN').toUpperCase() === 'OUT'
          ? 'OUT'
          : 'IN';
      const sign = dir === 'IN' ? 1 : -1;
      const dueKey = keyOf(new Date(row.dueDate));
      const duePoint = pointMap.get(dueKey) || {
        key: dueKey,
        previsto: 0,
        realizado: 0,
      };
      duePoint.previsto += sign * Number(row.amountCents || 0);
      pointMap.set(dueKey, duePoint);
      if (
        row.paidAt &&
        this.effectiveInstallmentStatus(row, tenantTimeZone) === 'SETTLED'
      ) {
        const paidKey = keyOf(new Date(row.paidAt));
        const paidPoint = pointMap.get(paidKey) || {
          key: paidKey,
          previsto: 0,
          realizado: 0,
        };
        paidPoint.realizado +=
          sign * Number(row.paidAmountCents || row.amountCents || 0);
        pointMap.set(paidKey, paidPoint);
      }
    }
    return {
      period: summary.period,
      granularity: 'daily',
      value: Array.from(pointMap.values()).sort((a, b) =>
        a.key.localeCompare(b.key),
      ),
    };
  }

  async getAging(tenantId: string, query: ListQuery) {
    const tenantTimeZone = await this.getTenantTimezone(tenantId);
    const rows = await this.prisma.financeInstallment.findMany({
      where: {
        tenantId,
        entry: {
          direction: 'IN',
          ...(query.matterId ? { matterId: query.matterId } : {}),
          ...(query.clientId ? { clientId: query.clientId } : {}),
        },
      } as any,
      include: {
        entry: {
          select: {
            id: true,
            description: true,
            client: { select: { id: true, name: true, code: true } },
            matter: { select: { id: true, title: true, code: true } },
          },
        },
      },
      take: 5000,
    });
    const now = new Date();
    const buckets = {
      current: { label: 'Não vencidos', count: 0, amountCents: 0 },
      b0_30: { label: '0-30 dias', count: 0, amountCents: 0 },
      b31_60: { label: '31-60 dias', count: 0, amountCents: 0 },
      b61_90: { label: '61-90 dias', count: 0, amountCents: 0 },
      b90p: { label: '90+ dias', count: 0, amountCents: 0 },
    };
    const topOverdue: any[] = [];
    for (const row of rows) {
      const status = this.effectiveInstallmentStatus(row, tenantTimeZone);
      if (status === 'SETTLED' || status === 'CANCELED') continue;
      const amount = Number(row.amountCents || 0);
      const days =
        this.daySerialInTimeZone(now, tenantTimeZone) -
        this.daySerialInTimeZone(new Date(row.dueDate), tenantTimeZone);
      if (days < 0) {
        buckets.current.count += 1;
        buckets.current.amountCents += amount;
        continue;
      }
      if (days <= 30) {
        buckets.b0_30.count += 1;
        buckets.b0_30.amountCents += amount;
      } else if (days <= 60) {
        buckets.b31_60.count += 1;
        buckets.b31_60.amountCents += amount;
      } else if (days <= 90) {
        buckets.b61_90.count += 1;
        buckets.b61_90.amountCents += amount;
      } else {
        buckets.b90p.count += 1;
        buckets.b90p.amountCents += amount;
      }
      topOverdue.push({
        ...this.serializeInstallment(row, tenantTimeZone),
        daysOverdue: days,
      });
    }
    topOverdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
    return {
      asOf: now.toISOString(),
      buckets,
      topOverdue: topOverdue.slice(0, 50),
    };
  }

  async listRecurrenceTemplates(tenantId: string) {
    return this.prisma.financeRecurrenceTemplate.findMany({
      where: { tenantId },
      include: {
        client: { select: { id: true, name: true, code: true } },
        matter: { select: { id: true, title: true, code: true } },
        category: true,
        costCenter: true,
        account: true,
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createRecurrenceTemplate(
    tenantId: string,
    actorId: string,
    dto: CreateFinanceRecurrenceTemplateDto,
  ) {
    const name = this.trim(dto.name);
    const description = this.trim(dto.description);
    if (!name) throw new BadRequestException('Nome do template é obrigatório');
    if (!description) throw new BadRequestException('Descrição é obrigatória');
    const direction = this.normalizeDirection(dto.direction);
    const amountCents = this.parseIntStrict(dto.amountCents, 'Valor', 1);
    const frequency = this.normalizeFrequency(dto.frequency);
    const links = await this.validateEntryLinks({
      tenantId,
      direction,
      clientId: dto.clientId || null,
      matterId: dto.matterId || null,
      categoryId: dto.categoryId,
      costCenterId: dto.costCenterId,
      accountId: dto.accountId,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await nextTenantCode(
        tx,
        tenantId,
        'FINANCE_RECURRENCE_TEMPLATE',
      );
      return tx.financeRecurrenceTemplate.create({
        data: {
          tenantId,
          code,
          name,
          isActive: dto.isActive !== false,
          direction,
          description,
          notes: this.trimOrNull(dto.notes),
          clientId: links.clientId,
          matterId: links.matterId,
          categoryId: links.categoryId,
          costCenterId: links.costCenterId,
          accountId: links.accountId,
          amountCents,
          frequency,
          installmentsPerGeneration: this.parseIntStrict(
            dto.installmentsPerGeneration ?? 1,
            'Parcelas por geração',
            1,
            360,
          ),
          dayOfMonth:
            dto.dayOfMonth == null
              ? null
              : this.parseIntStrict(dto.dayOfMonth, 'Dia do mês', 1, 31),
          startDate: this.parseDate(dto.startDate, 'Data inicial'),
          endDate: dto.endDate
            ? this.parseDate(dto.endDate, 'Data final')
            : null,
          createdByUserId: actorId,
        },
        include: {
          client: { select: { id: true, name: true, code: true } },
          matter: { select: { id: true, title: true, code: true } },
          category: true,
          costCenter: true,
          account: true,
        },
      });
    });
    await this.audit.log(
      tenantId,
      'FINANCE_RECURRENCE_TEMPLATE_CREATED',
      actorId,
      created.matterId || undefined,
      {
        financeRecurrenceTemplateId: created.id,
        frequency: created.frequency,
        direction: created.direction,
      },
    );
    return created;
  }

  async updateRecurrenceTemplate(
    tenantId: string,
    actorId: string,
    id: string,
    dto: CreateFinanceRecurrenceTemplateDto,
  ) {
    const current = await this.prisma.financeRecurrenceTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!current)
      throw new NotFoundException('Template recorrente não encontrado');
    let links:
      | {
          clientId: string | null;
          matterId: string | null;
          categoryId: string;
          costCenterId: string;
          accountId: string;
        }
      | undefined;
    if (
      dto.clientId !== undefined ||
      dto.matterId !== undefined ||
      dto.categoryId !== undefined ||
      dto.costCenterId !== undefined ||
      dto.accountId !== undefined ||
      dto.direction !== undefined
    ) {
      links = await this.validateEntryLinks({
        tenantId,
        direction: dto.direction
          ? this.normalizeDirection(dto.direction)
          : String(current.direction).toUpperCase() === 'OUT'
            ? 'OUT'
            : 'IN',
        clientId: dto.clientId === undefined ? current.clientId : dto.clientId,
        matterId: dto.matterId === undefined ? current.matterId : dto.matterId,
        categoryId:
          dto.categoryId === undefined ? current.categoryId : dto.categoryId,
        costCenterId:
          dto.costCenterId === undefined
            ? current.costCenterId
            : dto.costCenterId,
        accountId:
          dto.accountId === undefined ? current.accountId : dto.accountId,
      });
    }
    const updated = await this.prisma.financeRecurrenceTemplate.update({
      where: { id },
      data: {
        name:
          dto.name !== undefined
            ? this.trim(dto.name) || current.name
            : undefined,
        isActive:
          dto.isActive !== undefined ? Boolean(dto.isActive) : undefined,
        direction:
          dto.direction !== undefined
            ? this.normalizeDirection(dto.direction)
            : undefined,
        description:
          dto.description !== undefined
            ? this.trim(dto.description) || current.description
            : undefined,
        notes: dto.notes !== undefined ? this.trimOrNull(dto.notes) : undefined,
        clientId: links ? links.clientId : undefined,
        matterId: links ? links.matterId : undefined,
        categoryId: links ? links.categoryId : undefined,
        costCenterId: links ? links.costCenterId : undefined,
        accountId: links ? links.accountId : undefined,
        amountCents:
          dto.amountCents !== undefined
            ? this.parseIntStrict(dto.amountCents, 'Valor', 1)
            : undefined,
        frequency:
          dto.frequency !== undefined
            ? this.normalizeFrequency(dto.frequency)
            : undefined,
        installmentsPerGeneration:
          dto.installmentsPerGeneration !== undefined
            ? this.parseIntStrict(
                dto.installmentsPerGeneration,
                'Parcelas por geração',
                1,
                360,
              )
            : undefined,
        dayOfMonth:
          dto.dayOfMonth !== undefined
            ? dto.dayOfMonth == null
              ? null
              : this.parseIntStrict(dto.dayOfMonth, 'Dia do mês', 1, 31)
            : undefined,
        startDate:
          dto.startDate !== undefined
            ? this.parseDate(dto.startDate, 'Data inicial')
            : undefined,
        endDate:
          dto.endDate !== undefined
            ? dto.endDate
              ? this.parseDate(dto.endDate, 'Data final')
              : null
            : undefined,
      },
    });
    await this.audit.log(
      tenantId,
      'FINANCE_RECURRENCE_TEMPLATE_UPDATED',
      actorId,
      updated.matterId || undefined,
      {
        financeRecurrenceTemplateId: updated.id,
      },
    );
    return updated;
  }

  private nextCompetence(date: Date, frequency: Frequency) {
    if (frequency === 'WEEKLY')
      return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);
    if (frequency === 'YEARLY')
      return new Date(date.getFullYear() + 1, date.getMonth(), 1);
    return new Date(date.getFullYear(), date.getMonth() + 1, 1);
  }

  private isBeforeTemplateStartByFrequency(
    candidate: Date,
    startDate: Date,
    frequency: Frequency,
  ) {
    if (frequency === 'WEEKLY') return candidate < startDate;
    if (frequency === 'YEARLY') {
      return candidate.getUTCFullYear() < startDate.getUTCFullYear();
    }
    const candidateMonth = Date.UTC(
      candidate.getUTCFullYear(),
      candidate.getUTCMonth(),
      1,
    );
    const startMonth = Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      1,
    );
    return candidateMonth < startMonth;
  }

  private isAfterTemplateEndByFrequency(
    candidate: Date,
    endDate: Date,
    frequency: Frequency,
  ) {
    if (frequency === 'WEEKLY') return candidate > endDate;
    if (frequency === 'YEARLY') {
      return candidate.getUTCFullYear() > endDate.getUTCFullYear();
    }
    const candidateMonth = Date.UTC(
      candidate.getUTCFullYear(),
      candidate.getUTCMonth(),
      1,
    );
    const endMonth = Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      1,
    );
    return candidateMonth > endMonth;
  }

  async generateFromRecurrenceTemplate(
    tenantId: string,
    actorId: string,
    id: string,
    dto?: GenerateRecurrenceDto,
  ) {
    const tenantTimeZone = await this.getTenantTimezone(tenantId);
    const tpl = await this.prisma.financeRecurrenceTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!tpl) throw new NotFoundException('Template recorrente não encontrado');
    if (!tpl.isActive) throw new BadRequestException('Template inativo');
    const frequency = this.normalizeFrequency(tpl.frequency);
    const competenceDate = dto?.competenceDate
      ? this.parseDate(dto.competenceDate, 'Competência')
      : this.startOfMonthInTimeZone(new Date(), tenantTimeZone);
    const existing = await this.prisma.financeEntry.findFirst({
      where: { tenantId, recurrenceTemplateId: id, competenceDate },
      select: { id: true },
    });
    if (existing)
      throw new BadRequestException(
        'Já existe lançamento gerado para esta competência',
      );
    if (
      tpl.startDate &&
      this.isBeforeTemplateStartByFrequency(
        competenceDate,
        new Date(tpl.startDate),
        frequency,
      )
    ) {
      throw new BadRequestException(
        'Competência anterior ao início do template',
      );
    }
    if (
      tpl.endDate &&
      this.isAfterTemplateEndByFrequency(
        competenceDate,
        new Date(tpl.endDate),
        frequency,
      )
    ) {
      throw new BadRequestException('Competência após fim do template');
    }

    const dueDate = dto?.dueDate
      ? this.parseDate(dto.dueDate, 'Vencimento')
      : tpl.dayOfMonth
        ? new Date(
            competenceDate.getFullYear(),
            competenceDate.getMonth(),
            Math.min(
              tpl.dayOfMonth,
              new Date(
                competenceDate.getFullYear(),
                competenceDate.getMonth() + 1,
                0,
              ).getDate(),
            ),
          )
        : competenceDate;

    const created = await this.prisma.$transaction(async (tx) => {
      const entry = await this.createEntryInternal(
        tx,
        tenantId,
        actorId,
        {
          direction: tpl.direction,
          description: tpl.description,
          notes: tpl.notes,
          clientId: tpl.clientId,
          matterId: tpl.matterId,
          categoryId: tpl.categoryId,
          costCenterId: tpl.costCenterId,
          accountId: tpl.accountId,
          issueDate: competenceDate.toISOString(),
          competenceDate: competenceDate.toISOString(),
          totalAmountCents: tpl.amountCents,
          installmentsCount: tpl.installmentsPerGeneration,
          firstDueDate: dueDate.toISOString(),
          installmentFrequency: tpl.frequency,
        },
        { origin: 'RECURRENCE', recurrenceTemplateId: tpl.id },
      );
      await tx.financeRecurrenceTemplate.update({
        where: { id: tpl.id },
        data: { lastGeneratedCompetenceDate: competenceDate },
      });
      return entry;
    });

    await this.audit.log(
      tenantId,
      'FINANCE_RECURRENCE_GENERATED',
      actorId,
      tpl.matterId || undefined,
      {
        financeRecurrenceTemplateId: tpl.id,
        financeEntryId: created.id,
        competenceDate: competenceDate.toISOString(),
      },
    );
    return this.serializeEntry(created, tenantTimeZone);
  }

  async generateRecurrenceRange(
    tenantId: string,
    actorId: string,
    input: { from: string; to: string },
  ) {
    const tenantTimeZone = await this.getTenantTimezone(tenantId);
    const from = this.parseDate(input.from, 'from');
    const to = this.endOfDay(this.parseDate(input.to, 'to'));
    if (to < from) throw new BadRequestException('Intervalo inválido');
    const templates = await this.prisma.financeRecurrenceTemplate.findMany({
      where: { tenantId, isActive: true },
    });
    const generated: Array<{ templateId: string; entryId: string }> = [];
    const errors: Array<{ templateId: string; error: string }> = [];
    for (const tpl of templates) {
      const frequency = this.normalizeFrequency(tpl.frequency);
      let cursor =
        String(tpl.frequency).toUpperCase() === 'WEEKLY'
          ? new Date(from)
          : this.startOfMonthInTimeZone(from, tenantTimeZone);
      while (cursor <= to) {
        if (
          tpl.startDate &&
          this.isBeforeTemplateStartByFrequency(
            cursor,
            new Date(tpl.startDate),
            frequency,
          )
        ) {
          cursor = this.nextCompetence(cursor, frequency);
          continue;
        }
        if (
          tpl.endDate &&
          this.isAfterTemplateEndByFrequency(
            cursor,
            new Date(tpl.endDate),
            frequency,
          )
        ) {
          break;
        }
        try {
          const entry = await this.generateFromRecurrenceTemplate(
            tenantId,
            actorId,
            tpl.id,
            {
              competenceDate: cursor.toISOString(),
            },
          );
          generated.push({ templateId: tpl.id, entryId: entry.id });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.toLowerCase().includes('já existe lançamento')) {
            errors.push({ templateId: tpl.id, error: msg });
          }
        }
        cursor = this.nextCompetence(cursor, frequency);
      }
    }
    return { generatedCount: generated.length, generated, errors };
  }
}
