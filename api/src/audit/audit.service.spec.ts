import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

type PrismaAuditMock = {
  auditLog: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('AuditService', () => {
  let service: AuditService;
  let prismaMock: PrismaAuditMock;

  beforeEach(() => {
    prismaMock = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(),
    };

    prismaMock.$transaction.mockImplementation(async (queries: unknown[]) => {
      if (Array.isArray(queries))
        return Promise.all(queries as Promise<unknown>[]);
      return [];
    });

    service = new AuditService(prismaMock as unknown as PrismaService);
  });

  it('deve salvar meta como JSON em log', async () => {
    prismaMock.auditLog.create.mockResolvedValue({ id: 'a1' });

    await service.log('t1', 'ACTION_TEST', 'u1', 'm1', {
      before: 'OPEN',
      after: 'CLOSED',
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 't1',
        action: 'ACTION_TEST',
        userId: 'u1',
        matterId: 'm1',
        metaJson: JSON.stringify({ before: 'OPEN', after: 'CLOSED' }),
        prevHash: null,
        hash: expect.any(String),
      }),
    });
  });

  it('listTenant deve usar paginação padrão quando limite inválido', async () => {
    await service.listTenant('t1', { limit: Number.NaN });

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        skip: 0,
      }),
    );
  });

  it('listMatter deve limitar take em 100', async () => {
    await service.listMatter('t1', 'm1', { limit: 999 });

    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      }),
    );
  });
});
