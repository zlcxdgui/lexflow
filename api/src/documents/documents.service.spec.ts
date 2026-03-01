import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentsService } from './documents.service';

type PrismaDocumentsMock = {
  matter: {
    findFirst: jest.Mock;
  };
  document: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  auditLog: {
    findMany: jest.Mock;
  };
};

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prismaMock: PrismaDocumentsMock;
  let auditMock: { log: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      matter: {
        findFirst: jest.fn(),
      },
      document: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    auditMock = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    service = new DocumentsService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  it('deve bloquear listagem quando caso não existe', async () => {
    prismaMock.matter.findFirst.mockResolvedValue(null);

    await expect(service.listByMatter('t1', 'm1')).rejects.toThrow(
      new NotFoundException('Caso não encontrado'),
    );
  });

  it('deve bloquear rename com nome vazio', async () => {
    prismaMock.document.findFirst.mockResolvedValue({
      id: 'd1',
      tenantId: 't1',
      matterId: 'm1',
      originalName: 'arquivo.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
    });

    await expect(service.rename('t1', 'd1', '   ', 'u1')).rejects.toThrow(
      new BadRequestException('Nome do arquivo é obrigatório'),
    );
  });

  it('deve renomear mantendo extensão quando não informada', async () => {
    prismaMock.document.findFirst.mockResolvedValue({
      id: 'd1',
      tenantId: 't1',
      matterId: 'm1',
      originalName: 'arquivo.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
    });
    prismaMock.document.update.mockResolvedValue({
      id: 'd1',
      originalName: 'Relatorio final.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      createdAt: new Date('2026-02-10T00:00:00.000Z'),
      matterId: 'm1',
    });

    await service.rename('t1', 'd1', 'Relatorio final', 'u1');

    expect(prismaMock.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd1' },
        data: { originalName: 'Relatorio final.pdf' },
      }),
    );
    expect(auditMock.log).toHaveBeenCalledWith(
      't1',
      'DOCUMENT_RENAMED',
      'u1',
      'm1',
      expect.objectContaining({
        previousOriginalName: 'arquivo.pdf',
        nextOriginalName: 'Relatorio final.pdf',
      }),
    );
  });

  it('deve remover documento existente', async () => {
    prismaMock.document.findFirst.mockResolvedValue({
      id: 'd1',
      tenantId: 't1',
      matterId: 'm1',
      originalName: 'arquivo.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      checksumSha256: 'abc',
      storagePath: 'c:/tmp/inexistente.pdf',
    });

    const result = await service.remove('t1', 'd1', 'u1');

    expect(prismaMock.document.delete).toHaveBeenCalledWith({
      where: { id: 'd1' },
    });
    expect(result).toEqual({ ok: true });
    expect(auditMock.log).toHaveBeenCalledWith(
      't1',
      'DOCUMENT_DELETED',
      'u1',
      'm1',
      expect.objectContaining({ documentId: 'd1' }),
    );
  });
});
