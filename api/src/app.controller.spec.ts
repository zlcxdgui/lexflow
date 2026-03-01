import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { MetricsService } from './observability/metrics.service';
import { RolesGuard } from './auth/roles/roles.guard';
import { JwtAuthGuard } from './auth/jwt/jwt.guard';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: MetricsService,
          useValue: { snapshot: jest.fn().mockReturnValue({}) },
        },
        {
          provide: RolesGuard,
          useValue: { canActivate: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: JwtAuthGuard,
          useValue: { canActivate: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: PrismaService,
          useValue: { tenantMember: { findFirst: jest.fn() } },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return api online payload', () => {
      expect(appController.hello()).toEqual({
        ok: true,
        message: 'API online',
      });
    });
  });
});
