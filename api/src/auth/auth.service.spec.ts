import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

type PrismaAuthMock = {
  user: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  authSession: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
    updateMany: jest.Mock;
  };
  tenantMember: {
    findFirst: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('AuthService', () => {
  let service: AuthService;
  let prismaMock: PrismaAuthMock;
  let jwtMock: { signAsync: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      authSession: {
        create: jest.fn().mockResolvedValue({ id: 's1' }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      tenantMember: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    jwtMock = {
      signAsync: jest.fn().mockResolvedValue('token-123'),
    };

    service = new AuthService(
      prismaMock as unknown as PrismaService,
      jwtMock as unknown as JwtService,
    );
  });

  it('deve bloquear signup quando e-mail já existe', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });

    await expect(
      service.signup({
        name: 'Owner',
        email: 'owner@lexflow.dev',
        password: 'secret123',
        tenantName: 'LexFlow',
      }),
    ).rejects.toThrow(new BadRequestException('Email já cadastrado'));
  });

  it('deve criar tenant + usuário + membership OWNER no signup', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hash-123');

    const txMock = {
      tenant: {
        create: jest.fn().mockResolvedValue({ id: 't1', name: 'LexFlow Demo' }),
      },
      user: {
        create: jest.fn().mockResolvedValue({
          id: 'u1',
          name: 'Owner LexFlow',
          email: 'owner@lexflow.dev',
        }),
      },
      tenantMember: {
        create: jest.fn().mockResolvedValue({ id: 'm1' }),
      },
    };

    prismaMock.$transaction.mockImplementation(
      async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock),
    );

    const result = await service.signup({
      name: '  Owner LexFlow ',
      email: ' OWNER@LEXFLOW.DEV ',
      password: 'secret123',
      tenantName: ' LexFlow Demo ',
    });

    expect(txMock.tenant.create).toHaveBeenCalledWith({
      data: { name: 'LexFlow Demo' },
    });
    expect(txMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'owner@lexflow.dev',
        name: 'Owner LexFlow',
        passwordHash: 'hash-123',
      }),
    });
    expect(txMock.tenantMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 't1',
        userId: 'u1',
        role: 'OWNER',
        isActive: true,
      }),
    });
    expect(jwtMock.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'u1',
        tenantId: 't1',
        role: 'OWNER',
        email: 'owner@lexflow.dev',
        sid: expect.any(String),
      }),
    );
    expect(result.accessToken).toBe('token-123');
    expect(result.sessionId).toEqual(expect.any(String));
  });

  it('deve bloquear login com credenciais inválidas', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'x@x.com', password: 'wrong' }),
    ).rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));
  });

  it('deve bloquear login quando senha não confere', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'owner@lexflow.dev',
      passwordHash: 'hash-abc',
      name: 'Owner',
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ email: 'owner@lexflow.dev', password: 'wrong' }),
    ).rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));
  });

  it('deve informar tempo restante quando conta está temporariamente bloqueada', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'owner@lexflow.dev',
      passwordHash: 'hash-abc',
      name: 'Owner',
      failedLoginAttempts: 0,
      lockedUntil: new Date(Date.now() + 2 * 60 * 1000 + 1000),
    });

    await expect(
      service.login({ email: 'owner@lexflow.dev', password: 'secret123' }),
    ).rejects.toThrow(
      /Conta temporariamente bloqueada\. Tente novamente em \d+ minuto\(s\) ou entre em contato com o responsável do escritório\./,
    );
  });

  it('deve bloquear login quando usuário não tem escritório ativo', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'owner@lexflow.dev',
      passwordHash: 'hash-abc',
      name: 'Owner',
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prismaMock.tenantMember.findFirst.mockResolvedValue(null);

    await expect(
      service.login({ email: 'owner@lexflow.dev', password: 'secret123' }),
    ).rejects.toThrow(new UnauthorizedException('Usuário sem escritório'));
  });

  it('deve bloquear login quando usuário está desativado no escritório', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'owner@lexflow.dev',
      passwordHash: 'hash-abc',
      name: 'Owner',
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prismaMock.tenantMember.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'm-inativo' });

    await expect(
      service.login({ email: 'owner@lexflow.dev', password: 'secret123' }),
    ).rejects.toThrow(
      new UnauthorizedException(
        'Usuário desativado no escritório. Entre em contato com o responsável.',
      ),
    );
  });

  it('deve retornar token e contexto no login com sucesso', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'owner@lexflow.dev',
      passwordHash: 'hash-abc',
      name: 'Owner',
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prismaMock.tenantMember.findFirst.mockResolvedValue({
      tenantId: 't1',
      role: 'LAWYER',
    });

    const result = await service.login({
      email: ' OWNER@LEXFLOW.DEV ',
      password: 'secret123',
    });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'owner@lexflow.dev' },
    });
    expect(jwtMock.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'u1',
        tenantId: 't1',
        role: 'LAWYER',
        email: 'owner@lexflow.dev',
        sid: expect.any(String),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        accessToken: 'token-123',
        user: { id: 'u1', name: 'Owner', email: 'owner@lexflow.dev' },
        tenantId: 't1',
        role: 'LAWYER',
        sessionId: expect.any(String),
      }),
    );
  });

  it('deve bloquear login após blockAccessAfter', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'owner@lexflow.dev',
      passwordHash: 'hash-abc',
      name: 'Owner',
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prismaMock.tenantMember.findFirst.mockResolvedValue({
      tenantId: 't1',
      role: 'LAWYER',
      settingsJson: JSON.stringify({ blockAccessAfter: '2026-01-01' }),
    });

    await expect(
      service.login({ email: 'owner@lexflow.dev', password: 'secret123' }),
    ).rejects.toThrow(
      new UnauthorizedException('Acesso bloqueado para este usuário.'),
    );
  });

  it('deve bloquear login com passwordRotateDays expirado', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'owner@lexflow.dev',
      passwordHash: 'hash-abc',
      name: 'Owner',
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: new Date('2025-01-01T00:00:00.000Z'),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prismaMock.tenantMember.findFirst.mockResolvedValue({
      tenantId: 't1',
      role: 'LAWYER',
      settingsJson: JSON.stringify({ passwordRotateDays: 30 }),
    });

    await expect(
      service.login({ email: 'owner@lexflow.dev', password: 'secret123' }),
    ).rejects.toThrow(
      new UnauthorizedException(
        'Senha expirada. Atualize sua senha para continuar.',
      ),
    );
  });

  it('deve bloquear login fora do horário de acesso', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'owner@lexflow.dev',
      passwordHash: 'hash-abc',
      name: 'Owner',
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const dayNotToday = (new Date().getDay() + 1) % 7;
    prismaMock.tenantMember.findFirst.mockResolvedValue({
      tenantId: 't1',
      role: 'LAWYER',
      settingsJson: JSON.stringify({
        timezone: 'America/Manaus',
        accessScheduleEnabled: true,
        accessSchedule: [{ day: dayNotToday, start: '00:00', end: '23:59' }],
      }),
    });

    await expect(
      service.login({ email: 'owner@lexflow.dev', password: 'secret123' }),
    ).rejects.toThrow(
      new UnauthorizedException(
        'Acesso fora do horário permitido para este usuário.',
      ),
    );
  });

  it('não deve bloquear por horário quando accessScheduleEnabled = false', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'owner@lexflow.dev',
      passwordHash: 'hash-abc',
      name: 'Owner',
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const dayNotToday = (new Date().getDay() + 1) % 7;
    prismaMock.tenantMember.findFirst.mockResolvedValue({
      tenantId: 't1',
      role: 'LAWYER',
      settingsJson: JSON.stringify({
        timezone: 'America/Manaus',
        accessScheduleEnabled: false,
        accessSchedule: [{ day: dayNotToday, start: '00:00', end: '23:59' }],
      }),
    });

    const result = await service.login({
      email: 'owner@lexflow.dev',
      password: 'secret123',
    });

    expect(result).toEqual(
      expect.objectContaining({
        accessToken: 'token-123',
      }),
    );
  });
});
