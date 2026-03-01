import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from './tasks.service';
import { AuditService } from '../audit/audit.service';

type PrismaTasksMock = {
  matter: {
    findFirst: jest.Mock;
  };
  tenantMember: {
    findFirst: jest.Mock;
  };
  task: {
    findMany: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

describe('TasksService', () => {
  let service: TasksService;
  let prismaMock: PrismaTasksMock;
  let auditMock: { log: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      matter: {
        findFirst: jest.fn(),
      },
      tenantMember: {
        findFirst: jest.fn(),
      },
      task: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    };
    auditMock = { log: jest.fn().mockResolvedValue(null) };

    service = new TasksService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  it('deve bloquear criação quando caso não existe', async () => {
    prismaMock.matter.findFirst.mockResolvedValue(null);

    await expect(
      service.createForMatter('t1', 'm1', 'u1', {
        title: 'Tarefa X',
      }),
    ).rejects.toThrow(new NotFoundException('Caso não encontrado'));
  });

  it('deve bloquear assignedToUserId fora do tenant', async () => {
    prismaMock.matter.findFirst.mockResolvedValue({ id: 'm1', tenantId: 't1' });
    prismaMock.tenantMember.findFirst.mockResolvedValue(null);

    await expect(
      service.createForMatter('t1', 'm1', 'u1', {
        title: 'Tarefa X',
        assignedToUserId: 'u-invalido',
      }),
    ).rejects.toThrow(
      new BadRequestException('assignedToUserId não pertence ao escritório'),
    );
  });

  it('deve bloquear dueDate inválido na criação', async () => {
    prismaMock.matter.findFirst.mockResolvedValue({ id: 'm1', tenantId: 't1' });

    await expect(
      service.createForMatter('t1', 'm1', 'u1', {
        title: 'Tarefa X',
        dueDate: 'data-invalida',
      }),
    ).rejects.toThrow(
      new BadRequestException('dueDate inválido (use ISO ou YYYY-MM-DD)'),
    );
  });

  it('deve criar tarefa com dados normalizados', async () => {
    prismaMock.matter.findFirst.mockResolvedValue({ id: 'm1', tenantId: 't1' });
    let captured: {
      title?: string;
      priority?: string;
      createdByUserId?: string;
    } | null = null;
    prismaMock.task.create.mockImplementation((payload: unknown) => {
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'data' in payload &&
        typeof payload.data === 'object' &&
        payload.data !== null
      ) {
        const data = payload.data as {
          title?: string;
          priority?: string;
          createdByUserId?: string;
        };
        captured = data;
      }
      return Promise.resolve({ id: 'task-1' });
    });

    await service.createForMatter('t1', 'm1', 'u1', {
      title: '  Revisar contrato  ',
      priority: ' HIGH ',
      dueDate: '2026-02-18',
    });

    expect(captured).toEqual(
      expect.objectContaining({
        title: 'Revisar contrato',
        priority: 'HIGH',
        createdByUserId: 'u1',
      }),
    );
  });

  it('deve remover tarefa existente', async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      id: 'task-1',
      tenantId: 't1',
    });

    const result = await service.remove('t1', 'u1', 'task-1');

    expect(prismaMock.task.delete).toHaveBeenCalledWith({
      where: { id: 'task-1' },
    });
    expect(auditMock.log).toHaveBeenCalledWith(
      't1',
      'TASK_DELETED',
      'u1',
      undefined,
      expect.any(Object),
    );
    expect(result).toEqual({ ok: true });
  });

  it('deve criar tarefa sem caso vinculado', async () => {
    let captured: { matterId?: string | null } | null = null;
    prismaMock.task.create.mockImplementation((payload: unknown) => {
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'data' in payload &&
        typeof payload.data === 'object' &&
        payload.data !== null
      ) {
        const data = payload.data as { matterId?: string | null };
        captured = data;
      }
      return Promise.resolve({ id: 'task-general-1' });
    });

    await service.create('t1', 'u1', {
      title: 'Atendimento de cliente',
      dueDate: '2026-02-18',
    });

    expect(captured).toEqual(
      expect.objectContaining({
        matterId: null,
      }),
    );
  });
});
