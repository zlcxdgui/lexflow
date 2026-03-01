import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { AuditService } from '../audit/audit.service';

type PrismaClientMock = {
  client: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

describe('ClientsService', () => {
  let service: ClientsService;
  let prismaMock: PrismaClientMock;
  let auditMock: { log: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      client: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    auditMock = { log: jest.fn().mockResolvedValue(null) };

    service = new ClientsService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  it('deve bloquear PF sem CPF', async () => {
    const dto: CreateClientDto = {
      type: 'PF',
      name: 'Pessoa Teste',
      cpf: '',
      relacoesComerciais: ['CLIENTE'],
    };

    await expect(service.create('tenant-1', 'user-1', dto)).rejects.toThrow(
      new BadRequestException('CPF é obrigatório'),
    );
  });

  it('deve bloquear relações comerciais vazias', async () => {
    const dto: CreateClientDto = {
      type: 'PF',
      name: 'Pessoa Teste',
      cpf: '123.456.789-01',
      relacoesComerciais: [],
    };

    await expect(service.create('tenant-1', 'user-1', dto)).rejects.toThrow(
      new BadRequestException('Selecione ao menos uma relação comercial'),
    );
  });

  it('deve criar PF normalizando CPF e relações', async () => {
    let capturedCpf: string | undefined;
    let capturedRelacoes: string[] | undefined;
    prismaMock.client.create.mockImplementation((payload: unknown) => {
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'data' in payload &&
        typeof payload.data === 'object' &&
        payload.data !== null
      ) {
        const data = payload.data as {
          cpf?: string;
          relacoesComerciais?: string[];
        };
        capturedCpf = data.cpf;
        capturedRelacoes = data.relacoesComerciais;
      }
      return Promise.resolve({
        id: 'c1',
        tenantId: 'tenant-1',
        type: 'PF',
        name: 'Pessoa Teste',
        cpf: '12345678901',
        relacoesComerciais: ['CLIENTE', 'FUNCIONARIO'],
      });
    });

    const dto: CreateClientDto = {
      type: 'PF',
      name: 'Pessoa Teste',
      cpf: '123.456.789-01',
      rg: '123456',
      relacoesComerciais: ['cliente', 'FUNCIONARIO', 'CLIENTE'],
    };

    await service.create('tenant-1', 'user-1', dto);

    expect(prismaMock.client.create).toHaveBeenCalledTimes(1);
    expect(auditMock.log).toHaveBeenCalledWith(
      'tenant-1',
      'CLIENT_CREATED',
      'user-1',
      undefined,
      expect.objectContaining({
        clientId: 'c1',
        type: 'PF',
        name: 'Pessoa Teste',
      }),
    );
    expect(capturedCpf).toBe('12345678901');
    expect(capturedRelacoes).toEqual(['CLIENTE', 'FUNCIONARIO']);
  });
});
