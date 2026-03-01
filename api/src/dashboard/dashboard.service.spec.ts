import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';
import { AuditService } from '../audit/audit.service';

type PrismaDashboardMock = {
  matter: {
    count: jest.Mock;
  };
  deadline: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
  task: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
  notification: {
    findMany: jest.Mock;
    count: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('DashboardService', () => {
  let service: DashboardService;
  let prismaMock: PrismaDashboardMock;
  let auditMock: { log: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      matter: {
        count: jest.fn(),
      },
      deadline: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      task: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      notification: {
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(),
    };
    auditMock = { log: jest.fn().mockResolvedValue(null) };

    service = new DashboardService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  it('deve usar fallback de 14 dias quando input for inválido', async () => {
    prismaMock.matter.count.mockResolvedValue(1);
    prismaMock.$transaction.mockResolvedValue([[], [], 2, 3]);

    const result = await service.getDashboard('tenant-1', Number.NaN);

    expect(result.rangeDays).toBe(14);
    expect(result.counts).toEqual({
      openMatters: 1,
      openTasks: 2,
      pendingDeadlines: 3,
    });
  });

  it('deve limitar range em 60 dias', async () => {
    prismaMock.matter.count.mockResolvedValue(5);
    prismaMock.$transaction.mockResolvedValue([[], [], 10, 20]);

    const result = await service.getDashboard('tenant-1', 200);

    expect(result.rangeDays).toBe(60);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('deve ocultar tarefas e prazos quando hideData=true', async () => {
    prismaMock.matter.count.mockResolvedValue(4);

    const result = await service.getDashboard('tenant-1', 14, {
      hideData: true,
    });

    expect(result.counts).toEqual({
      openMatters: 4,
      openTasks: 0,
      pendingDeadlines: 0,
    });
    expect(result.openTasks).toEqual([]);
    expect(result.upcomingDeadlines).toEqual([]);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
