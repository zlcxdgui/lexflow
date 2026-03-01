import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MattersService } from './matters.service';

type PrismaMattersMock = {
  matter: {
    findFirst: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
  };
  client: {
    findFirst: jest.Mock;
  };
};

type AuditMock = {
  log: jest.Mock;
};

describe('MattersService', () => {
  let service: MattersService;
  let prismaMock: PrismaMattersMock;
  let auditMock: AuditMock;

  beforeEach(() => {
    prismaMock = {
      matter: {
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      client: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    auditMock = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    service = new MattersService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  it('deve bloquear edição de caso fechado sem reabrir', async () => {
    prismaMock.matter.findFirst.mockResolvedValue({
      id: 'm1',
      tenantId: 't1',
      status: 'CLOSED',
      title: 'Caso fechado',
    });

    await expect(
      service.update('t1', 'u1', 'm1', { title: 'Novo título' }),
    ).rejects.toThrow(
      new BadRequestException(
        'Caso encerrado não pode ser alterado. Reabra o caso primeiro',
      ),
    );
  });

  it('deve exigir motivo ao encerrar caso', async () => {
    prismaMock.matter.findFirst.mockResolvedValue({
      id: 'm2',
      tenantId: 't1',
      status: 'OPEN',
      title: 'Caso aberto',
    });

    await expect(
      service.update('t1', 'u1', 'm2', { status: 'CLOSED' }),
    ).rejects.toThrow(
      new BadRequestException('Motivo é obrigatório para encerrar o caso'),
    );
  });

  it('deve registrar auditoria de mudança de status', async () => {
    prismaMock.matter.findFirst.mockResolvedValue({
      id: 'm3',
      tenantId: 't1',
      status: 'OPEN',
      title: 'Caso aberto',
      clientId: null,
    });

    prismaMock.matter.update.mockResolvedValue({
      id: 'm3',
      tenantId: 't1',
      status: 'CLOSED',
      title: 'Caso aberto',
      clientId: null,
      client: null,
    });

    await service.update('t1', 'u2', 'm3', {
      status: 'CLOSED',
      statusReason: 'Acordo homologado',
    });

    expect(auditMock.log).toHaveBeenCalledWith(
      't1',
      'MATTER_STATUS_CHANGED',
      'u2',
      'm3',
      expect.objectContaining({
        previousStatus: 'OPEN',
        nextStatus: 'CLOSED',
        reason: 'Acordo homologado',
      }),
    );
  });
});
