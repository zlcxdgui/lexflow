import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { ReportsService } from './reports.service';

type PrismaReportsMock = {
  matter: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
  task: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
  deadline: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
  auditLog: {
    findMany: jest.Mock;
    create: jest.Mock;
  };
  $transaction: jest.Mock;
};

type DashboardMock = {
  getDashboard: jest.Mock;
};

describe('ReportsService', () => {
  let service: ReportsService;
  let prismaMock: PrismaReportsMock;
  let dashboardMock: DashboardMock;

  beforeEach(() => {
    prismaMock = {
      matter: {
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      task: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      deadline: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
      $transaction: jest.fn(async (ops: Array<Promise<unknown>>) =>
        Promise.all(ops),
      ),
    };
    dashboardMock = {
      getDashboard: jest.fn(),
    };

    service = new ReportsService(
      prismaMock as unknown as PrismaService,
      dashboardMock as unknown as DashboardService,
    );
  });

  it('deve limitar range em 90 dias no getData', async () => {
    prismaMock.matter.findMany.mockResolvedValue([]);
    dashboardMock.getDashboard.mockResolvedValue({
      counts: { openMatters: 0, openTasks: 0, pendingDeadlines: 0 },
      upcomingDeadlines: [],
      openTasks: [],
    });

    const data = await service.getData('tenant-1', 365);

    expect(dashboardMock.getDashboard).toHaveBeenCalledWith('tenant-1', 90);
    expect(data.rangeDays).toBe(90);
  });

  it('deve usar 14 dias quando input inválido no getData', async () => {
    prismaMock.matter.findMany.mockResolvedValue([]);
    dashboardMock.getDashboard.mockResolvedValue({
      counts: { openMatters: 0, openTasks: 0, pendingDeadlines: 0 },
      upcomingDeadlines: [],
      openTasks: [],
    });

    const data = await service.getData('tenant-1', Number.NaN);

    expect(dashboardMock.getDashboard).toHaveBeenCalledWith('tenant-1', 14);
    expect(data.rangeDays).toBe(14);
  });

  it('deve gerar PDF com estrutura mínima', () => {
    const doc = service.buildPdf({
      matters: [
        {
          id: 'm1',
          title: 'Caso teste',
          area: 'Cível',
          status: 'OPEN',
          createdAt: new Date('2026-02-10T12:00:00.000Z'),
        },
      ],
      dashboard: {
        counts: {
          openMatters: 1,
          openTasks: 2,
          pendingDeadlines: 3,
        },
        upcomingDeadlines: [
          {
            title: 'Prazo teste',
            dueDate: '2026-02-20T12:00:00.000Z',
            matter: { title: 'Caso teste' },
          },
        ],
        openTasks: [
          {
            title: 'Tarefa teste',
            dueDate: null,
            matter: { title: 'Caso teste' },
          },
        ],
      },
      rangeDays: 14,
      filters: {
        q: '',
        status: '',
        area: '',
        responsible: '',
        deadlineType: '',
      },
      comparison: {
        current: { mattersCreated: 1, tasksCreated: 1, deadlinesCreated: 1 },
        previous: { mattersCreated: 0, tasksCreated: 0, deadlinesCreated: 0 },
      },
      goals: {
        deadlineOnTimeTarget: 95,
        deadlineOnTimeCurrent: 100,
        taskBacklogTarget: 8,
        taskBacklogCurrent: 2,
      },
      indicators: {
        averageMatterAgeDays: 4,
        completionByResponsible: [],
        backlogByResponsible: [],
      },
      alerts: {
        highRiskDeadlines: 0,
        highRiskTasks: 1,
        totalHighRisk: 1,
      },
      historicalSeries: [],
    });

    expect(doc.info.Title).toBe('Relatório LexFlow');
    expect(typeof doc.pipe).toBe('function');
    expect(typeof doc.end).toBe('function');
    doc.end();
  });
});
