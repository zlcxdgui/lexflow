import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { TenantsService } from './tenants.service';
import { BillingService } from '../billing/billing.service';

type PrismaTenantsMock = {
  user: {
    findUnique: jest.Mock;
  };
  client: {
    findFirst: jest.Mock;
  };
  tenantMember: {
    findFirst: jest.Mock;
  };
  tenantInvite: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
  tenant: {
    findUnique: jest.Mock;
  };
};

describe('TenantsService', () => {
  let service: TenantsService;
  let prismaMock: PrismaTenantsMock;
  let auditMock: { log: jest.Mock };
  let mailMock: { sendInvite: jest.Mock };
  let billingMock: { assertCanCreateUser: jest.Mock };

  const tenantId = 'tenant-1';
  const ownerId = 'owner-1';

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      client: {
        findFirst: jest.fn().mockResolvedValue({ id: 'employee-1' }),
      },
      tenantMember: {
        findFirst: jest.fn(),
      },
      tenantInvite: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'invite-1',
          expiresAt: new Date('2026-12-31T12:00:00.000Z'),
        }),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ name: 'LexFlow Demo' }),
      },
    };

    auditMock = { log: jest.fn().mockResolvedValue(undefined) };
    mailMock = {
      sendInvite: jest.fn().mockResolvedValue({ provider: 'brevo' }),
    };
    billingMock = {
      assertCanCreateUser: jest.fn().mockResolvedValue(undefined),
    };

    service = new TenantsService(
      prismaMock as unknown as PrismaService,
      { signAsync: jest.fn() } as unknown as JwtService,
      auditMock as unknown as AuditService,
      mailMock as unknown as MailService,
      billingMock as unknown as BillingService,
    );
  });

  function mockOwnerWithExisting(existing: null | { isActive: boolean }) {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.tenantMember.findFirst.mockImplementation(
      ({
        where,
      }: {
        where: {
          userId?: string;
          user?: { email?: string };
          employeeClientId?: string;
        };
      }) => {
        if (where.userId === ownerId) {
          return Promise.resolve({ role: 'OWNER' });
        }
        if (where.user?.email) {
          return Promise.resolve(existing);
        }
        if (where.employeeClientId) {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      },
    );
    prismaMock.tenantInvite.findFirst.mockImplementation(
      ({
        where,
      }: {
        where: { invitedEmail?: string; inviteEmployeeClientId?: string };
      }) => {
        if (where.invitedEmail) return Promise.resolve(null);
        if (where.inviteEmployeeClientId) return Promise.resolve(null);
        return Promise.resolve(null);
      },
    );
  }

  function mockAdminWithExisting(existing: null | { isActive: boolean }) {
    prismaMock.user.findUnique.mockResolvedValue({ isPlatformAdmin: true });
    prismaMock.tenantMember.findFirst.mockImplementation(
      ({
        where,
      }: {
        where: {
          userId?: string;
          user?: { email?: string };
          employeeClientId?: string;
        };
      }) => {
        if (where.user?.email) {
          return Promise.resolve(existing);
        }
        if (where.employeeClientId) {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      },
    );
    prismaMock.tenantInvite.findFirst.mockImplementation(
      ({
        where,
      }: {
        where: { invitedEmail?: string; inviteEmployeeClientId?: string };
      }) => {
        if (where.invitedEmail) return Promise.resolve(null);
        if (where.inviteEmployeeClientId) return Promise.resolve(null);
        return Promise.resolve(null);
      },
    );
  }

  it('deve bloquear convite com role OWNER', async () => {
    mockOwnerWithExisting(null);

    await expect(
      service.addMember(
        tenantId,
        ownerId,
        'novo@lexflow.dev',
        'OWNER',
        'Novo',
        'employee-1',
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Convite de sócio deve ser feito promovendo um membro já ativo',
      ),
    );
  });

  it('deve bloquear quando usuário já está ativo no escritório', async () => {
    mockOwnerWithExisting({ isActive: true });

    await expect(
      service.addMember(
        tenantId,
        ownerId,
        'ativo@lexflow.dev',
        'LAWYER',
        'Ativo',
        'employee-1',
      ),
    ).rejects.toThrow(
      new BadRequestException('Usuário já existe no escritório'),
    );
  });

  it('deve bloquear quando usuário já existe inativo (usar reativar)', async () => {
    mockOwnerWithExisting({ isActive: false });

    await expect(
      service.addMember(
        tenantId,
        ownerId,
        'inativo@lexflow.dev',
        'ASSISTANT',
        'Inativo',
        'employee-1',
      ),
    ).rejects.toThrow(
      new BadRequestException('Usuário já existe no escritório, use Reativar'),
    );
  });

  it('deve criar convite e enviar e-mail com sucesso', async () => {
    mockOwnerWithExisting(null);

    const result = await service.addMember(
      tenantId,
      ownerId,
      'novo@lexflow.dev',
      'LAWYER',
      'Pessoa Convite',
      'employee-1',
    );

    expect(prismaMock.tenantInvite.create).toHaveBeenCalledTimes(1);
    expect(mailMock.sendInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'novo@lexflow.dev',
        fullName: 'Pessoa Convite',
        role: 'LAWYER',
      }),
    );
    expect(auditMock.log).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        kind: 'INVITE_CREATED',
        invitedEmail: 'novo@lexflow.dev',
      }),
    );
  });

  it('deve permitir ADMIN convidar com role OWNER', async () => {
    mockAdminWithExisting(null);

    const result = await service.addMember(
      tenantId,
      ownerId,
      'socio@lexflow.dev',
      'OWNER',
      'Sócio Novo',
      'employee-1',
    );

    expect(prismaMock.tenantInvite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'OWNER',
          invitedEmail: 'socio@lexflow.dev',
          inviteEmployeeClientId: 'employee-1',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        kind: 'INVITE_CREATED',
        invitedEmail: 'socio@lexflow.dev',
      }),
    );
  });
});
