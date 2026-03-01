import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from './tenants.service';

describe('TenantsService isolation/governance', () => {
  it('bloqueia switch para tenant inativo', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ isPlatformAdmin: true }),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: 't2', isActive: false }),
      },
      tenantMember: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };

    const service = new TenantsService(
      prismaMock as unknown as PrismaService,
      { signAsync: jest.fn() } as unknown as JwtService,
      { log: jest.fn() } as unknown as AuditService,
      { sendInvite: jest.fn() } as unknown as MailService,
    );

    await expect(service.switchTenant('u-admin', 't2')).rejects.toThrow(
      new BadRequestException('Escritório desativado'),
    );
  });

  it('permite switch de admin global sem criar vínculo local no tenant', async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ isPlatformAdmin: true }),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: 't3', isActive: true }),
      },
      tenantMember: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'm1', role: 'OWNER', isActive: false }),
        update: jest.fn().mockResolvedValue({
          role: 'ADMIN',
          user: { email: 'admin@lexflow.dev' },
        }),
        create: jest.fn(),
      },
    };

    const service = new TenantsService(
      prismaMock as unknown as PrismaService,
      {
        signAsync: jest.fn().mockResolvedValue('jwt'),
      } as unknown as JwtService,
      { log: jest.fn() } as unknown as AuditService,
      { sendInvite: jest.fn() } as unknown as MailService,
    );

    const result = await service.switchTenant('u-admin', 't3');
    expect(prismaMock.tenantMember.update).not.toHaveBeenCalled();
    expect(prismaMock.tenantMember.create).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        accessToken: 'jwt',
        tenantId: 't3',
        role: 'ADMIN',
      }),
    );
  });
});
