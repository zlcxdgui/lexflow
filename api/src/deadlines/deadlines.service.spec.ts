import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeadlinesService } from './deadlines.service';
import { AuditService } from '../audit/audit.service';

type PrismaDeadlinesMock = {
  matter: {
    findFirst: jest.Mock;
  };
  deadline: {
    findMany: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

describe('DeadlinesService', () => {
  let service: DeadlinesService;
  let prismaMock: PrismaDeadlinesMock;
  let auditMock: { log: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      matter: {
        findFirst: jest.fn(),
      },
      deadline: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    };
    auditMock = { log: jest.fn().mockResolvedValue(null) };

    service = new DeadlinesService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  it('deve bloquear criação de prazo para caso inexistente', async () => {
    prismaMock.matter.findFirst.mockResolvedValue(null);

    await expect(
      service.createForMatter('t1', 'm1', 'u1', {
        title: 'Prazo teste',
        dueDate: '2026-02-20',
      }),
    ).rejects.toThrow(new NotFoundException('Caso não encontrado'));
  });

  it('deve bloquear dueDate no passado sem allowPast', async () => {
    prismaMock.matter.findFirst.mockResolvedValue({ id: 'm1', tenantId: 't1' });
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    await expect(
      service.createForMatter('t1', 'm1', 'u1', {
        title: 'Prazo vencido',
        dueDate: yesterday,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'dueDate no passado (use allowPast=true para permitir)',
      ),
    );
  });

  it('deve criar prazo válido', async () => {
    prismaMock.matter.findFirst.mockResolvedValue({ id: 'm1', tenantId: 't1' });
    let captured: { title?: string; type?: string } | null = null;
    prismaMock.deadline.create.mockImplementation((payload: unknown) => {
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'data' in payload &&
        typeof payload.data === 'object' &&
        payload.data !== null
      ) {
        const data = payload.data as { title?: string; type?: string };
        captured = data;
      }
      return Promise.resolve({ id: 'd1' });
    });

    await service.createForMatter('t1', 'm1', 'u1', {
      title: '  Prazo de recurso ',
      dueDate: '2026-03-10',
      type: ' APPEAL ',
    });

    expect(captured).toEqual(
      expect.objectContaining({
        title: 'Prazo de recurso',
        type: 'APPEAL',
      }),
    );
  });

  it('deve bloquear update com dueDate inválido', async () => {
    prismaMock.deadline.findFirst.mockResolvedValue({
      id: 'd1',
      tenantId: 't1',
    });

    await expect(
      service.update('t1', 'u1', 'd1', { dueDate: 'invalida' }),
    ).rejects.toThrow(
      new BadRequestException('dueDate inválido (use ISO ou YYYY-MM-DD)'),
    );
  });

  it('deve remover prazo existente', async () => {
    prismaMock.deadline.findFirst.mockResolvedValue({
      id: 'd1',
      tenantId: 't1',
    });

    const result = await service.remove('t1', 'u1', 'd1');

    expect(prismaMock.deadline.delete).toHaveBeenCalledWith({
      where: { id: 'd1' },
    });
    expect(auditMock.log).toHaveBeenCalledWith(
      't1',
      'DEADLINE_DELETED',
      'u1',
      undefined,
      expect.any(Object),
    );
    expect(result).toEqual({ ok: true });
  });
});
