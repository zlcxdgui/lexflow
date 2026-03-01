import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { TenantsService } from './tenants.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

type PrismaTenantsInviteMock = {
  tenantInvite: {
    findFirst: jest.Mock;
  };
  auditLog: {
    findMany: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
  };
  client: {
    findFirst: jest.Mock;
  };
  tenantMember: {
    findFirst: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('TenantsService - invite flow', () => {
  let service: TenantsService;
  let prismaMock: PrismaTenantsInviteMock;
  let jwtMock: { signAsync: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      tenantInvite: {
        findFirst: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: jest.fn(),
      },
      client: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      tenantMember: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    jwtMock = {
      signAsync: jest.fn().mockResolvedValue('jwt-token-1'),
    };

    service = new TenantsService(
      prismaMock as unknown as PrismaService,
      jwtMock as unknown as JwtService,
      {
        log: jest.fn().mockResolvedValue(undefined),
      } as unknown as AuditService,
      { sendInvite: jest.fn() } as unknown as MailService,
    );
  });

  it('getInviteByToken deve retornar convite pendente com fullName resolvido', async () => {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
    prismaMock.tenantInvite.findFirst.mockResolvedValue({
      id: 'inv-1',
      tenantId: 't1',
      invitedEmail: 'new.user@lexflow.dev',
      role: 'LAWYER',
      status: 'PENDING',
      expiresAt,
      tenant: { id: 't1', name: 'LexFlow Demo' },
    });
    prismaMock.user.findUnique.mockResolvedValue({ name: 'New User' });

    const result = await service.getInviteByToken('token-abc');

    expect(result).toEqual(
      expect.objectContaining({
        email: 'new.user@lexflow.dev',
        fullName: 'New User',
        role: 'LAWYER',
        tenant: { id: 't1', name: 'LexFlow Demo' },
      }),
    );
  });

  it('acceptInvite deve criar usuário/membership e aceitar convite pendente', async () => {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
    prismaMock.tenantInvite.findFirst.mockResolvedValue({
      id: 'inv-2',
      tenantId: 't1',
      invitedEmail: 'invite.user@lexflow.dev',
      inviteEmployeeClientId: 'emp-1',
      role: 'ASSISTANT',
      status: 'PENDING',
      expiresAt,
    });
    prismaMock.user.findUnique.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hash-pwd');

    const txMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'u-new',
          email: 'invite.user@lexflow.dev',
          name: 'invite.user',
        }),
      },
      tenantMember: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'm-new' }),
        update: jest.fn(),
      },
      tenantInvite: {
        update: jest
          .fn()
          .mockResolvedValue({ id: 'inv-2', status: 'ACCEPTED' }),
      },
    };

    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock),
    );

    const result = await service.acceptInvite('token-abc', 'secret123');

    expect(txMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'invite.user@lexflow.dev',
        name: 'invite.user',
        passwordHash: 'hash-pwd',
      }),
    });
    expect(txMock.tenantMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 't1',
        userId: 'u-new',
        employeeClientId: 'emp-1',
        role: 'ASSISTANT',
        isActive: true,
      }),
    });
    expect(jwtMock.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'u-new',
        tenantId: 't1',
        role: 'ASSISTANT',
        email: 'invite.user@lexflow.dev',
        sid: expect.any(String),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        accessToken: 'jwt-token-1',
        tenantId: 't1',
        role: 'ASSISTANT',
        sessionId: expect.any(String),
      }),
    );
  });

  it('acceptInvite deve bloquear senha curta', async () => {
    await expect(service.acceptInvite('token-abc', '123')).rejects.toThrow(
      new BadRequestException(
        'Senha inválida. A senha deve conter ao menos 6 caracteres.',
      ),
    );
  });
});
