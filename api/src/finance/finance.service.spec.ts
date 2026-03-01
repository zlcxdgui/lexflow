import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FinanceService } from './finance.service';

type TxMock = {
  tenantCodeCounter?: {
    upsert: jest.Mock;
  };
  financeInstallment: {
    update: jest.Mock;
    findMany: jest.Mock;
    updateMany: jest.Mock;
  };
  financeEntry: {
    create: jest.Mock;
    update: jest.Mock;
  };
};

type PrismaFinanceMock = {
  financeInstallment: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  financeEntry: {
    findFirst: jest.Mock;
  };
  financeRecurrenceTemplate: {
    findFirst: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('FinanceService', () => {
  let service: FinanceService;
  let prismaMock: PrismaFinanceMock;
  let auditMock: { log: jest.Mock };
  let txMock: TxMock;

  beforeEach(() => {
    txMock = {
      tenantCodeCounter: {
        upsert: jest.fn().mockResolvedValue({ value: 101 }),
      },
      financeInstallment: {
        update: jest
          .fn()
          .mockResolvedValue({ id: 'inst-1', entryId: 'entry-1' }),
        findMany: jest.fn().mockResolvedValue([
          {
            status: 'OPEN',
            dueDate: new Date('2026-03-10T00:00:00.000Z'),
            paidAt: null,
            canceledAt: null,
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      financeEntry: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'entry-1', status: 'OPEN' }),
      },
    };

    prismaMock = {
      financeInstallment: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      financeEntry: {
        findFirst: jest.fn(),
      },
      financeRecurrenceTemplate: {
        findFirst: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(txMock)),
    };

    auditMock = {
      log: jest.fn().mockResolvedValue(null),
    };

    service = new FinanceService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  it('deve editar parcela aberta e registrar auditoria', async () => {
    prismaMock.financeInstallment.findFirst.mockResolvedValue({
      id: 'inst-1',
      tenantId: 'tenant-1',
      entryId: 'entry-1',
      status: 'OPEN',
      dueDate: new Date('2026-03-01T00:00:00.000Z'),
      paidAt: null,
      canceledAt: null,
      entry: { id: 'entry-1', matterId: 'matter-1' },
    });

    jest.spyOn(service, 'getEntry').mockResolvedValue({ id: 'entry-1' } as any);

    const result = await service.updateInstallment(
      'tenant-1',
      'user-1',
      'inst-1',
      {
        dueDate: '2026-03-15',
        description: 'Parcela ajustada',
      },
    );

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.financeInstallment.update).toHaveBeenCalledWith({
      where: { id: 'inst-1' },
      data: {
        dueDate: new Date('2026-03-15'),
        description: 'Parcela ajustada',
      },
    });
    expect(txMock.financeInstallment.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', entryId: 'entry-1' },
      select: { status: true, dueDate: true, paidAt: true, canceledAt: true },
    });
    expect(txMock.financeEntry.update).toHaveBeenCalledWith({
      where: { id: 'entry-1' },
      data: { status: 'OPEN' },
    });
    expect(auditMock.log).toHaveBeenCalledWith(
      'tenant-1',
      'FINANCE_INSTALLMENT_UPDATED',
      'user-1',
      'matter-1',
      expect.objectContaining({
        financeInstallmentId: 'inst-1',
        financeEntryId: 'entry-1',
        description: 'Parcela ajustada',
      }),
    );
    expect(result).toEqual({ id: 'entry-1' });
  });

  it('deve bloquear edição de parcela liquidada', async () => {
    prismaMock.financeInstallment.findFirst.mockResolvedValue({
      id: 'inst-1',
      tenantId: 'tenant-1',
      entryId: 'entry-1',
      status: 'SETTLED',
      dueDate: new Date('2026-03-01T00:00:00.000Z'),
      paidAt: new Date('2026-03-01T10:00:00.000Z'),
      canceledAt: null,
      entry: { id: 'entry-1', matterId: 'matter-1' },
    });

    await expect(
      service.updateInstallment('tenant-1', 'user-1', 'inst-1', {
        dueDate: '2026-03-15',
      }),
    ).rejects.toThrow(
      new BadRequestException('Parcela liquidada não pode ser editada'),
    );

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(auditMock.log).not.toHaveBeenCalled();
  });

  it('deve bloquear edição de parcela cancelada', async () => {
    prismaMock.financeInstallment.findFirst.mockResolvedValue({
      id: 'inst-1',
      tenantId: 'tenant-1',
      entryId: 'entry-1',
      status: 'CANCELED',
      dueDate: new Date('2026-03-01T00:00:00.000Z'),
      paidAt: null,
      canceledAt: new Date('2026-03-01T10:00:00.000Z'),
      entry: { id: 'entry-1', matterId: 'matter-1' },
    });

    await expect(
      service.updateInstallment('tenant-1', 'user-1', 'inst-1', {
        description: 'Teste',
      }),
    ).rejects.toThrow(
      new BadRequestException('Parcela cancelada não pode ser editada'),
    );

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(auditMock.log).not.toHaveBeenCalled();
  });

  it('deve permitir edição de parcela vencida (OVERDUE)', async () => {
    prismaMock.financeInstallment.findFirst.mockResolvedValue({
      id: 'inst-1',
      tenantId: 'tenant-1',
      entryId: 'entry-1',
      status: 'OPEN',
      dueDate: new Date('2000-01-01T00:00:00.000Z'),
      paidAt: null,
      canceledAt: null,
      entry: { id: 'entry-1', matterId: 'matter-1' },
    });

    jest.spyOn(service, 'getEntry').mockResolvedValue({ id: 'entry-1' } as any);

    await service.updateInstallment('tenant-1', 'user-1', 'inst-1', {
      dueDate: '2000-01-15',
      description: '',
    });

    expect(txMock.financeInstallment.update).toHaveBeenCalledWith({
      where: { id: 'inst-1' },
      data: {
        dueDate: new Date('2000-01-15'),
        description: null,
      },
    });
    expect(auditMock.log).toHaveBeenCalledWith(
      'tenant-1',
      'FINANCE_INSTALLMENT_UPDATED',
      'user-1',
      'matter-1',
      expect.objectContaining({
        financeInstallmentId: 'inst-1',
        financeEntryId: 'entry-1',
        description: null,
      }),
    );
  });

  it('deve baixar parcela aberta e registrar auditoria', async () => {
    prismaMock.financeInstallment.findFirst.mockResolvedValue({
      id: 'inst-1',
      tenantId: 'tenant-1',
      entryId: 'entry-1',
      status: 'OPEN',
      amountCents: 10000,
      dueDate: new Date('2099-03-01T00:00:00.000Z'),
      paidAt: null,
      canceledAt: null,
      accountId: null,
      entry: { id: 'entry-1', matterId: 'matter-1', accountId: 'acc-1' },
    });

    jest.spyOn(service, 'getEntry').mockResolvedValue({ id: 'entry-1' } as any);
    txMock.financeInstallment.update.mockResolvedValueOnce({
      id: 'inst-1',
      entryId: 'entry-1',
      paidAmountCents: 10500,
      paidAt: new Date('2099-03-05T00:00:00.000Z'),
      paymentMethod: 'PIX',
    });

    const result = await service.settleInstallment(
      'tenant-1',
      'user-1',
      'inst-1',
      {
        paidAt: '2099-03-05',
        discountCents: 0,
        interestCents: 500,
        fineCents: 0,
        paymentMethod: 'PIX',
      },
    );

    expect(txMock.financeInstallment.update).toHaveBeenCalledWith({
      where: { id: 'inst-1' },
      data: expect.objectContaining({
        status: 'SETTLED',
        paidAmountCents: 10500,
        interestCents: 500,
        paymentMethod: 'PIX',
        accountId: 'acc-1',
        settledByUserId: 'user-1',
      }),
    });
    expect(auditMock.log).toHaveBeenCalledWith(
      'tenant-1',
      'FINANCE_INSTALLMENT_SETTLED',
      'user-1',
      'matter-1',
      expect.objectContaining({
        financeInstallmentId: 'inst-1',
        financeEntryId: 'entry-1',
        paidAmountCents: 10500,
        paymentMethod: 'PIX',
      }),
    );
    expect(result).toEqual({ id: 'entry-1' });
  });

  it('deve cancelar parcela aberta e registrar auditoria', async () => {
    prismaMock.financeInstallment.findFirst.mockResolvedValue({
      id: 'inst-1',
      tenantId: 'tenant-1',
      entryId: 'entry-1',
      status: 'OPEN',
      dueDate: new Date('2099-03-01T00:00:00.000Z'),
      paidAt: null,
      canceledAt: null,
      entry: { id: 'entry-1', matterId: 'matter-1' },
    });

    jest.spyOn(service, 'getEntry').mockResolvedValue({ id: 'entry-1' } as any);

    const result = await service.cancelInstallment(
      'tenant-1',
      'user-1',
      'inst-1',
      {
        reason: 'Cancelado em teste',
      },
    );

    expect(txMock.financeInstallment.update).toHaveBeenCalledWith({
      where: { id: 'inst-1' },
      data: expect.objectContaining({
        status: 'CANCELED',
        canceledByUserId: 'user-1',
      }),
    });
    expect(auditMock.log).toHaveBeenCalledWith(
      'tenant-1',
      'FINANCE_INSTALLMENT_CANCELED',
      'user-1',
      'matter-1',
      expect.objectContaining({
        financeInstallmentId: 'inst-1',
        financeEntryId: 'entry-1',
        reason: 'Cancelado em teste',
      }),
    );
    expect(result).toEqual({ id: 'entry-1' });
  });

  it('deve exigir motivo ao cancelar parcela', async () => {
    prismaMock.financeInstallment.findFirst.mockResolvedValue({
      id: 'inst-1',
      tenantId: 'tenant-1',
      entryId: 'entry-1',
      status: 'OPEN',
      dueDate: new Date('2099-03-01T00:00:00.000Z'),
      paidAt: null,
      canceledAt: null,
      entry: { id: 'entry-1', matterId: 'matter-1' },
    });

    await expect(
      service.cancelInstallment('tenant-1', 'user-1', 'inst-1', {}),
    ).rejects.toThrow(
      new BadRequestException('Motivo do cancelamento é obrigatório'),
    );

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(auditMock.log).not.toHaveBeenCalled();
  });

  it('deve criar lançamento parcelado com soma exata em centavos', async () => {
    (service as any).validateEntryLinks = jest.fn().mockResolvedValue({
      clientId: 'client-1',
      matterId: 'matter-1',
      categoryId: 'cat-1',
      costCenterId: 'cc-1',
      accountId: 'acc-1',
    });
    (service as any).refreshEntryStatusTx = jest.fn().mockResolvedValue('OPEN');
    jest
      .spyOn(service as any, 'serializeEntry')
      .mockImplementation((value: any) => value);

    txMock.financeEntry.create.mockImplementation(async (payload: any) => ({
      id: 'entry-1',
      code: payload.data.code,
      tenantId: payload.data.tenantId,
      direction: payload.data.direction,
      status: payload.data.status,
      description: payload.data.description,
      notes: payload.data.notes,
      clientId: payload.data.clientId,
      matterId: payload.data.matterId,
      categoryId: payload.data.categoryId,
      costCenterId: payload.data.costCenterId,
      accountId: payload.data.accountId,
      issueDate: payload.data.issueDate,
      competenceDate: payload.data.competenceDate,
      totalAmountCents: payload.data.totalAmountCents,
      installmentsCount: payload.data.installmentsCount,
      origin: payload.data.origin,
      recurrenceTemplateId: payload.data.recurrenceTemplateId,
      createdByUserId: payload.data.createdByUserId,
      client: { id: 'client-1', name: 'Cliente', code: 1 },
      matter: { id: 'matter-1', title: 'Caso', code: 1 },
      category: { id: 'cat-1', name: 'Honorários' },
      costCenter: { id: 'cc-1', name: 'Operacional' },
      account: { id: 'acc-1', name: 'Banco' },
      installments: payload.data.installments.create,
    }));

    const dto = {
      direction: 'IN',
      description: 'Teste parcelado',
      clientId: 'client-1',
      matterId: 'matter-1',
      categoryId: 'cat-1',
      costCenterId: 'cc-1',
      accountId: 'acc-1',
      issueDate: '2026-03-01',
      totalAmountCents: 100,
      installmentsCount: 3,
      firstDueDate: '2026-03-10',
      installmentFrequency: 'MONTHLY',
    };

    const created = await service.createEntry('tenant-1', 'user-1', dto as any);

    expect(txMock.financeEntry.create).toHaveBeenCalledTimes(1);
    const createArg = txMock.financeEntry.create.mock.calls[0][0];
    const installments = createArg.data.installments.create as Array<{
      amountCents: number;
      number: number;
    }>;
    expect(installments).toHaveLength(3);
    expect(installments.map((i) => i.amountCents)).toEqual([33, 33, 34]);
    expect(installments.reduce((sum, i) => sum + i.amountCents, 0)).toBe(100);
    expect(created.installments.map((i: any) => i.amountCents)).toEqual([
      33, 33, 34,
    ]);
    expect(auditMock.log).toHaveBeenCalledWith(
      'tenant-1',
      'FINANCE_ENTRY_CREATED',
      'user-1',
      'matter-1',
      expect.objectContaining({
        financeEntryId: 'entry-1',
        totalAmountCents: 100,
        installmentsCount: 3,
      }),
    );
  });

  it('deve cancelar lançamento e propagar cancelamento para parcelas abertas/vencidas', async () => {
    prismaMock.financeEntry.findFirst.mockResolvedValue({
      id: 'entry-1',
      tenantId: 'tenant-1',
      matterId: 'matter-1',
      installments: [
        {
          id: 'i1',
          status: 'OPEN',
          dueDate: new Date('2099-01-01'),
          paidAt: null,
          canceledAt: null,
        },
        {
          id: 'i2',
          status: 'OPEN',
          dueDate: new Date('2000-01-01'),
          paidAt: null,
          canceledAt: null,
        },
        {
          id: 'i3',
          status: 'SETTLED',
          dueDate: new Date('2099-01-01'),
          paidAt: new Date(),
          canceledAt: null,
        },
      ],
    });

    txMock.financeEntry.update.mockResolvedValueOnce({
      id: 'entry-1',
      matterId: 'matter-1',
      direction: 'IN',
      totalAmountCents: 1000,
      installments: [
        {
          id: 'i1',
          status: 'CANCELED',
          dueDate: new Date('2099-01-01'),
          paidAt: null,
          canceledAt: new Date(),
        },
        {
          id: 'i2',
          status: 'CANCELED',
          dueDate: new Date('2000-01-01'),
          paidAt: null,
          canceledAt: new Date(),
        },
        {
          id: 'i3',
          status: 'SETTLED',
          dueDate: new Date('2099-01-01'),
          paidAt: new Date(),
          canceledAt: null,
        },
      ],
      client: null,
      matter: { id: 'matter-1', title: 'Caso', code: 1 },
      category: null,
      costCenter: null,
      account: null,
    });
    jest
      .spyOn(service as any, 'serializeEntry')
      .mockImplementation((value: any) => value);

    const result = await service.cancelEntry('tenant-1', 'user-1', 'entry-1', {
      reason: 'Teste cancelamento',
    });

    expect(txMock.financeInstallment.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        entryId: 'entry-1',
        status: { in: ['OPEN', 'OVERDUE'] },
      },
      data: expect.objectContaining({
        status: 'CANCELED',
        canceledByUserId: 'user-1',
      }),
    });
    expect(txMock.financeEntry.update).toHaveBeenCalledWith({
      where: { id: 'entry-1' },
      data: expect.objectContaining({
        status: 'CANCELED',
        canceledByUserId: 'user-1',
      }),
      include: expect.any(Object),
    });
    expect(auditMock.log).toHaveBeenCalledWith(
      'tenant-1',
      'FINANCE_ENTRY_CANCELED',
      'user-1',
      'matter-1',
      expect.objectContaining({
        financeEntryId: 'entry-1',
        reason: 'Teste cancelamento',
      }),
    );
    expect(result.id).toBe('entry-1');
  });

  it('deve exigir motivo ao cancelar lançamento', async () => {
    prismaMock.financeEntry.findFirst.mockResolvedValue({
      id: 'entry-1',
      tenantId: 'tenant-1',
      installments: [],
    });

    await expect(
      service.cancelEntry('tenant-1', 'user-1', 'entry-1', {}),
    ).rejects.toThrow(
      new BadRequestException('Motivo do cancelamento é obrigatório'),
    );

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(auditMock.log).not.toHaveBeenCalled();
  });

  it('deve bloquear alteração estrutural em lançamento após baixa de parcela', async () => {
    prismaMock.financeEntry.findFirst.mockResolvedValue({
      id: 'entry-1',
      tenantId: 'tenant-1',
      direction: 'IN',
      clientId: 'client-1',
      matterId: 'matter-1',
      categoryId: 'cat-1',
      costCenterId: 'cc-1',
      accountId: 'acc-1',
      installments: [
        {
          id: 'inst-1',
          status: 'SETTLED',
          dueDate: new Date('2099-01-01T00:00:00.000Z'),
          paidAt: new Date('2099-01-02T00:00:00.000Z'),
          canceledAt: null,
        },
      ],
    });

    await expect(
      service.updateEntry('tenant-1', 'user-1', 'entry-1', {
        accountId: 'acc-2',
      } as any),
    ).rejects.toThrow(
      new BadRequestException(
        'Não é possível alterar estrutura após baixa em parcela',
      ),
    );

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(auditMock.log).not.toHaveBeenCalled();
  });

  it('deve permitir alteração não estrutural em lançamento com parcela já baixada', async () => {
    prismaMock.financeEntry.findFirst.mockResolvedValue({
      id: 'entry-1',
      tenantId: 'tenant-1',
      direction: 'IN',
      description: 'Antigo',
      notes: null,
      clientId: 'client-1',
      matterId: 'matter-1',
      categoryId: 'cat-1',
      costCenterId: 'cc-1',
      accountId: 'acc-1',
      installments: [
        {
          id: 'inst-1',
          status: 'SETTLED',
          dueDate: new Date('2099-01-01T00:00:00.000Z'),
          paidAt: new Date('2099-01-02T00:00:00.000Z'),
          canceledAt: null,
        },
      ],
    });
    txMock.financeEntry.update.mockResolvedValueOnce({
      id: 'entry-1',
      direction: 'IN',
      description: 'Novo título',
      notes: 'Obs',
      totalAmountCents: 1000,
      matterId: 'matter-1',
      client: null,
      matter: { id: 'matter-1', title: 'Caso', code: 1 },
      category: null,
      costCenter: null,
      account: null,
      installments: [
        {
          id: 'inst-1',
          number: 1,
          status: 'SETTLED',
          dueDate: new Date('2099-01-01T00:00:00.000Z'),
          paidAt: new Date('2099-01-02T00:00:00.000Z'),
          canceledAt: null,
          amountCents: 1000,
        },
      ],
    });
    jest
      .spyOn(service as any, 'serializeEntry')
      .mockImplementation((value: any) => value);

    const result = await service.updateEntry('tenant-1', 'user-1', 'entry-1', {
      description: 'Novo título',
      notes: 'Obs',
    });

    expect(txMock.financeEntry.update).toHaveBeenCalledWith({
      where: { id: 'entry-1' },
      data: expect.objectContaining({
        description: 'Novo título',
        notes: 'Obs',
      }),
      include: expect.any(Object),
    });
    expect(auditMock.log).toHaveBeenCalledWith(
      'tenant-1',
      'FINANCE_ENTRY_UPDATED',
      'user-1',
      'matter-1',
      expect.objectContaining({ financeEntryId: 'entry-1' }),
    );
    expect(result.id).toBe('entry-1');
  });

  it('deve bloquear geração de recorrência em competência duplicada', async () => {
    prismaMock.financeRecurrenceTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1',
      tenantId: 'tenant-1',
      isActive: true,
      endDate: null,
    });
    prismaMock.financeEntry.findFirst.mockResolvedValueOnce({
      id: 'entry-existing',
    });

    await expect(
      service.generateFromRecurrenceTemplate('tenant-1', 'user-1', 'tpl-1', {
        competenceDate: '2026-03-01',
      } as any),
    ).rejects.toThrow(
      new BadRequestException(
        'Já existe lançamento gerado para esta competência',
      ),
    );

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(auditMock.log).not.toHaveBeenCalled();
  });

  it('getSummary deve calcular inadimplência e previstos/realizados', async () => {
    prismaMock.financeInstallment.findMany
      .mockResolvedValueOnce([
        {
          amountCents: 10000,
          paidAmountCents: null,
          dueDate: new Date('2000-01-01T00:00:00.000Z'),
          status: 'OPEN',
          paidAt: null,
          canceledAt: null,
          entry: { direction: 'IN' },
        },
        {
          amountCents: 20000,
          paidAmountCents: 21000,
          dueDate: new Date('2099-01-01T00:00:00.000Z'),
          status: 'SETTLED',
          paidAt: new Date('2099-01-02T00:00:00.000Z'),
          canceledAt: null,
          entry: { direction: 'IN' },
        },
        {
          amountCents: 15000,
          paidAmountCents: 15000,
          dueDate: new Date('2099-01-03T00:00:00.000Z'),
          status: 'SETTLED',
          paidAt: new Date('2099-01-04T00:00:00.000Z'),
          canceledAt: null,
          entry: { direction: 'OUT' },
        },
        {
          amountCents: 5000,
          paidAmountCents: null,
          dueDate: new Date('2099-01-05T00:00:00.000Z'),
          status: 'OPEN',
          paidAt: null,
          canceledAt: null,
          entry: { direction: 'OUT' },
        },
        {
          amountCents: 7000,
          paidAmountCents: null,
          dueDate: new Date('2099-01-06T00:00:00.000Z'),
          status: 'CANCELED',
          paidAt: null,
          canceledAt: new Date('2099-01-01T00:00:00.000Z'),
          entry: { direction: 'IN' },
        },
      ])
      .mockResolvedValueOnce([
        {
          amountCents: 20000,
          paidAmountCents: 21000,
          dueDate: new Date('2099-01-01T00:00:00.000Z'),
          status: 'SETTLED',
          paidAt: new Date('2026-02-20T00:00:00.000Z'),
          canceledAt: null,
          entry: { direction: 'IN' },
        },
        {
          amountCents: 15000,
          paidAmountCents: 15000,
          dueDate: new Date('2099-01-03T00:00:00.000Z'),
          status: 'SETTLED',
          paidAt: new Date('2026-02-21T00:00:00.000Z'),
          canceledAt: null,
          entry: { direction: 'OUT' },
        },
      ]);

    const result = await service.getSummary('tenant-1', {
      from: '2026-01-01',
      to: '2026-12-31',
    });

    expect(result.previstoReceber).toBe(30000);
    expect(result.previstoPagar).toBe(20000);
    expect(result.abertoReceber).toBe(10000);
    expect(result.abertoPagar).toBe(5000);
    expect(result.realizadoReceber).toBe(21000);
    expect(result.realizadoPagar).toBe(15000);
    expect(result.saldoPeriodo).toBe(6000);
    expect(result.inadimplenciaReceber).toBe(10000);
    expect(result.breakdownByStatus['IN:OVERDUE']).toEqual({
      count: 1,
      amountCents: 10000,
    });
    expect(result.breakdownByStatus['OUT:OPEN']).toEqual({
      count: 1,
      amountCents: 5000,
    });
    expect(prismaMock.financeInstallment.findMany).toHaveBeenCalledTimes(2);
  });

  it('getAging deve distribuir buckets e ignorar quitadas/canceladas', async () => {
    const now = Date.now();
    const daysAgo = (days: number) => new Date(now - days * 86400000);
    const daysAhead = (days: number) => new Date(now + days * 86400000);

    prismaMock.financeInstallment.findMany.mockResolvedValueOnce([
      {
        id: 'i-current',
        amountCents: 1000,
        dueDate: daysAhead(5),
        status: 'OPEN',
        paidAt: null,
        canceledAt: null,
        entry: { id: 'e1', description: 'Atual', client: null, matter: null },
      },
      {
        id: 'i-10',
        amountCents: 2000,
        dueDate: daysAgo(10),
        status: 'OPEN',
        paidAt: null,
        canceledAt: null,
        entry: { id: 'e2', description: '10d', client: null, matter: null },
      },
      {
        id: 'i-45',
        amountCents: 3000,
        dueDate: daysAgo(45),
        status: 'OPEN',
        paidAt: null,
        canceledAt: null,
        entry: { id: 'e3', description: '45d', client: null, matter: null },
      },
      {
        id: 'i-75',
        amountCents: 4000,
        dueDate: daysAgo(75),
        status: 'OPEN',
        paidAt: null,
        canceledAt: null,
        entry: { id: 'e4', description: '75d', client: null, matter: null },
      },
      {
        id: 'i-120',
        amountCents: 5000,
        dueDate: daysAgo(120),
        status: 'OPEN',
        paidAt: null,
        canceledAt: null,
        entry: { id: 'e5', description: '120d', client: null, matter: null },
      },
      {
        id: 'i-settled',
        amountCents: 999,
        dueDate: daysAgo(15),
        status: 'SETTLED',
        paidAt: new Date(),
        canceledAt: null,
        entry: { id: 'e6', description: 'quitada', client: null, matter: null },
      },
      {
        id: 'i-canceled',
        amountCents: 888,
        dueDate: daysAgo(15),
        status: 'CANCELED',
        paidAt: null,
        canceledAt: new Date(),
        entry: {
          id: 'e7',
          description: 'cancelada',
          client: null,
          matter: null,
        },
      },
    ]);

    const result = await service.getAging('tenant-1', {});

    expect(result.buckets.current).toEqual(
      expect.objectContaining({ count: 1, amountCents: 1000 }),
    );
    expect(result.buckets.b0_30).toEqual(
      expect.objectContaining({ count: 1, amountCents: 2000 }),
    );
    expect(result.buckets.b31_60).toEqual(
      expect.objectContaining({ count: 1, amountCents: 3000 }),
    );
    expect(result.buckets.b61_90).toEqual(
      expect.objectContaining({ count: 1, amountCents: 4000 }),
    );
    expect(result.buckets.b90p).toEqual(
      expect.objectContaining({ count: 1, amountCents: 5000 }),
    );
    expect(result.topOverdue.some((item: any) => item.id === 'i-120')).toBe(
      true,
    );
    expect(result.topOverdue.some((item: any) => item.id === 'i-settled')).toBe(
      false,
    );
    expect(
      result.topOverdue.some((item: any) => item.id === 'i-canceled'),
    ).toBe(false);
  });

  it('deve marcar lançamento como PARCIAL quando houver parcelas quitadas e canceladas sem abertas', () => {
    const status = (service as any).deriveEntryStatus([
      {
        status: 'SETTLED',
        dueDate: new Date('2099-01-01T00:00:00.000Z'),
        paidAt: new Date(),
        canceledAt: null,
      },
      {
        status: 'SETTLED',
        dueDate: new Date('2099-02-01T00:00:00.000Z'),
        paidAt: new Date(),
        canceledAt: null,
      },
      {
        status: 'CANCELED',
        dueDate: new Date('2099-03-01T00:00:00.000Z'),
        paidAt: null,
        canceledAt: new Date(),
      },
    ]);

    expect(status).toBe('PARTIAL');
  });
});
