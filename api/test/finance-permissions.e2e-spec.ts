import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { FinanceController } from '../src/finance/finance.controller';
import { FinanceService } from '../src/finance/finance.service';
import { JwtAuthGuard } from '../src/auth/jwt/jwt.guard';
import { RolesGuard } from '../src/auth/roles/roles.guard';
import { PrismaService } from '../src/prisma/prisma.service';

const guardState: {
  role: 'OWNER' | 'LAWYER' | 'ASSISTANT' | 'ADMIN';
  selectedGroupId?: string;
  groupPermissions?: string[];
} = {
  role: 'OWNER',
};

class FakeJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const role = String(req.headers['x-role'] || 'OWNER').toUpperCase() as
      | 'OWNER'
      | 'LAWYER'
      | 'ASSISTANT'
      | 'ADMIN';
    const groupId = String(req.headers['x-group-id'] || '').trim();
    const permsRaw = String(req.headers['x-group-permissions'] || '').trim();
    guardState.role = role;
    guardState.selectedGroupId = groupId || undefined;
    guardState.groupPermissions = permsRaw
      ? permsRaw
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      : undefined;

    req.user = {
      sub: 'user-1',
      tenantId: 'tenant-1',
      role,
      isAdmin: role === 'ADMIN',
    };
    return true;
  }
}

describe('Finance permissions (e2e)', () => {
  let app: INestApplication<App>;
  let financeServiceMock: Record<string, jest.Mock>;

  beforeAll(async () => {
    financeServiceMock = {
      updateEntry: jest.fn().mockResolvedValue({ ok: true }),
      settleInstallment: jest.fn().mockResolvedValue({ ok: true }),
      cancelInstallment: jest.fn().mockResolvedValue({ ok: true }),
    };

    const prismaMock = {
      tenantMember: {
        findFirst: jest.fn().mockImplementation(async () => {
          if (!guardState.selectedGroupId) return { settingsJson: null };
          return {
            settingsJson: JSON.stringify({
              groupPermissions: [`GROUP:${guardState.selectedGroupId}`],
            }),
          };
        }),
      },
      tenantAccessGroup: {
        findMany: jest.fn().mockImplementation(async () => {
          if (!guardState.selectedGroupId) return [];
          return [{ permissions: guardState.groupPermissions || [] }];
        }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [
        RolesGuard,
        { provide: FinanceService, useValue: financeServiceMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(FakeJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    Object.values(financeServiceMock).forEach((mock) => mock.mockClear());
    guardState.role = 'OWNER';
    guardState.selectedGroupId = undefined;
    guardState.groupPermissions = undefined;
  });

  it('PATCH /finance/entries/:id exige finance.edit', async () => {
    await request(app.getHttpServer())
      .patch('/finance/entries/entry-1')
      .set('x-role', 'OWNER')
      .set('x-group-id', 'g1')
      .set('x-group-permissions', 'finance.read')
      .send({ description: 'Teste' })
      .expect(403);

    await request(app.getHttpServer())
      .patch('/finance/entries/entry-1')
      .set('x-role', 'OWNER')
      .send({ description: 'Teste' })
      .expect(200);

    expect(financeServiceMock.updateEntry).toHaveBeenCalled();
  });

  it('POST /finance/installments/:id/settle exige finance.settle', async () => {
    await request(app.getHttpServer())
      .post('/finance/installments/inst-1/settle')
      .set('x-role', 'OWNER')
      .set('x-group-id', 'g1')
      .set('x-group-permissions', 'finance.read,finance.edit')
      .send({ paidAt: '2026-01-01', paidAmountCents: 1000 })
      .expect(403);

    await request(app.getHttpServer())
      .post('/finance/installments/inst-1/settle')
      .set('x-role', 'OWNER')
      .send({ paidAt: '2026-01-01', paidAmountCents: 1000 })
      .expect(201);

    expect(financeServiceMock.settleInstallment).toHaveBeenCalled();
  });

  it('POST /finance/installments/:id/cancel exige finance.cancel', async () => {
    await request(app.getHttpServer())
      .post('/finance/installments/inst-1/cancel')
      .set('x-role', 'OWNER')
      .set('x-group-id', 'g1')
      .set('x-group-permissions', 'finance.read,finance.edit,finance.settle')
      .send({ reason: 'teste' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/finance/installments/inst-1/cancel')
      .set('x-role', 'OWNER')
      .send({ reason: 'teste' })
      .expect(201);

    expect(financeServiceMock.cancelInstallment).toHaveBeenCalled();
  });
});
