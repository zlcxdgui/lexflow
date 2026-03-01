import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

type PrismaUsersMock = {
  user: {
    findUnique: jest.Mock;
  };
  tenantMember: {
    findMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('UsersService', () => {
  let service: UsersService;
  let prismaMock: PrismaUsersMock;

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
      },
      tenantMember: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    service = new UsersService(
      prismaMock as unknown as PrismaService,
      { log: jest.fn() } as unknown as AuditService,
      {
        assertCanCreateUser: jest.fn().mockResolvedValue(undefined),
      } as unknown as BillingService,
    );
  });

  it('deve bloquear createInTenant com e-mail já cadastrado', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });

    await expect(
      service.createInTenant('t1', {
        name: 'User',
        email: 'user@lexflow.dev',
        password: 'secret123',
      }),
    ).rejects.toThrow(new BadRequestException('Email já cadastrado'));
  });

  it('deve criar usuário no tenant com role padrão LAWYER', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hash-xyz');

    const txMock = {
      user: {
        create: jest.fn().mockResolvedValue({
          id: 'u1',
          name: 'Lawyer LexFlow',
          email: 'lawyer@lexflow.dev',
        }),
      },
      tenantMember: {
        create: jest.fn().mockResolvedValue({ id: 'm1' }),
      },
    };

    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock),
    );

    const result = await service.createInTenant('t1', {
      name: ' Lawyer LexFlow ',
      email: ' LAWYER@LEXFLOW.DEV ',
      password: 'secret123',
    });

    expect(txMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Lawyer LexFlow',
        email: 'lawyer@lexflow.dev',
        passwordHash: 'hash-xyz',
      }),
    });
    expect(txMock.tenantMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 't1',
        userId: 'u1',
        role: 'LAWYER',
        isActive: true,
      }),
    });
    expect(result).toEqual({
      id: 'u1',
      name: 'Lawyer LexFlow',
      email: 'lawyer@lexflow.dev',
      role: 'LAWYER',
    });
  });

  it('deve listar membros ativos sem admins para não-admin', async () => {
    prismaMock.tenantMember.findMany.mockResolvedValue([
      {
        id: 'm1',
      },
    ]);

    const result = await service.listTenantMembers('t1', 'OWNER');

    expect(prismaMock.tenantMember.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 't1',
        isActive: true,
        user: { is: { isPlatformAdmin: false } },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([{ id: 'm1' }]);
  });

  it('deve bloquear criação de usuário admin por não-admin', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      service.createInTenant('t1', {
        name: 'Admin',
        email: 'admin@lexflow.dev',
        password: 'secret123',
        role: 'ADMIN',
      }),
    ).rejects.toThrow(
      new BadRequestException('Sem permissão para criar usuário admin'),
    );
  });

  it('deve listar membros ativos incluindo admins para admin', async () => {
    prismaMock.tenantMember.findMany.mockResolvedValue([{ id: 'm2' }]);

    const result = await service.listTenantMembers('t1', 'ADMIN');

    expect(prismaMock.tenantMember.findMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([{ id: 'm2' }]);
  });
});
