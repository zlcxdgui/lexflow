import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { nextTenantCode } from '../common/tenant-code';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  private readonly allowedRelacoes = ['CLIENTE', 'FUNCIONARIO'] as const;

  private auditSnapshot(client: {
    id: string;
    code?: number | null;
    type?: string | null;
    name?: string | null;
    cpf?: string | null;
    cnpj?: string | null;
    relacoesComerciais?: string[] | null;
  }) {
    return {
      clientId: client.id,
      clientCode: client.code ?? null,
      type: client.type ?? null,
      name: client.name ?? null,
      cpf: client.cpf ?? null,
      cnpj: client.cnpj ?? null,
      relacoesComerciais: Array.isArray(client.relacoesComerciais)
        ? client.relacoesComerciais
        : [],
    };
  }

  private digits(value?: string | null) {
    if (!value) return null;
    const only = value.replace(/\D+/g, '');
    return only.length ? only : null;
  }

  private normalizeRelacoes(input?: string[] | null) {
    const allowed = new Set<string>(this.allowedRelacoes);
    const raw = Array.isArray(input) ? input : ['CLIENTE'];
    const normalized = Array.from(
      new Set(
        raw
          .map((v) =>
            String(v || '')
              .trim()
              .toUpperCase(),
          )
          .filter((v) => allowed.has(v)),
      ),
    ) as Array<'CLIENTE' | 'FUNCIONARIO'>;

    if (normalized.length === 0) {
      throw new BadRequestException('Selecione ao menos uma relação comercial');
    }
    return normalized;
  }

  private async ensureUniqueCpf(
    tenantId: string,
    cpf: string,
    ignoreId?: string,
  ) {
    const existing = await this.prisma.client.findFirst({
      where: { tenantId, cpf, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
      select: { id: true },
    });
    if (existing)
      throw new BadRequestException('Já existe cliente com este CPF');
  }

  private async ensureUniqueCnpj(
    tenantId: string,
    cnpj: string,
    ignoreId?: string,
  ) {
    const existing = await this.prisma.client.findFirst({
      where: { tenantId, cnpj, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
      select: { id: true },
    });
    if (existing)
      throw new BadRequestException('Já existe cliente com este CNPJ');
  }

  list(tenantId: string) {
    return this.prisma.client.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(tenantId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { tenantId, id },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');
    return client;
  }

  async create(tenantId: string, actorId: string, dto: CreateClientDto) {
    const type = dto.type;
    if (type !== 'PF' && type !== 'PJ')
      throw new BadRequestException('Tipo inválido');

    const cpf = this.digits(dto.cpf);
    const cnpj = this.digits(dto.cnpj);
    const cep = this.digits(dto.cep);
    const relacoesComerciais = this.normalizeRelacoes(dto.relacoesComerciais);

    if (type === 'PF') {
      if (!dto.name?.trim())
        throw new BadRequestException('Nome é obrigatório');
      if (!cpf) throw new BadRequestException('CPF é obrigatório');
    }

    if (type === 'PJ') {
      if (!cnpj) throw new BadRequestException('CNPJ é obrigatório');
      if (!dto.razaoSocial?.trim())
        throw new BadRequestException('Razão social é obrigatória');
      if (dto.contribuinte === 'CONTRIBUINTE_ICMS') {
        if (!dto.inscricaoEstadual?.trim())
          throw new BadRequestException('Inscrição estadual é obrigatória');
        if (!dto.ufInscricaoEstadual?.trim())
          throw new BadRequestException(
            'UF da inscrição estadual é obrigatória',
          );
      }
    }

    if (cpf) await this.ensureUniqueCpf(tenantId, cpf);
    if (cnpj) await this.ensureUniqueCnpj(tenantId, cnpj);

    const createData: Omit<Prisma.ClientUncheckedCreateInput, 'code'> = {
      tenantId,
      type,
      name:
        type === 'PJ'
          ? dto.razaoSocial?.trim() || dto.name?.trim() || ''
          : dto.name.trim(),
      cpf: type === 'PF' ? cpf : null,
      rg: type === 'PF' ? dto.rg?.trim() : null,
      cnpj: type === 'PJ' ? cnpj : null,
      razaoSocial: type === 'PJ' ? dto.razaoSocial?.trim() : null,
      nomeFantasia: type === 'PJ' ? dto.nomeFantasia?.trim() : null,
      contribuinte: type === 'PJ' ? dto.contribuinte : null,
      inscricaoEstadual:
        type === 'PJ' && dto.contribuinte === 'CONTRIBUINTE_ICMS'
          ? dto.inscricaoEstadual?.trim()
          : null,
      ufInscricaoEstadual:
        type === 'PJ' && dto.contribuinte === 'CONTRIBUINTE_ICMS'
          ? dto.ufInscricaoEstadual?.trim()
          : null,
      email: dto.email?.trim().toLowerCase(),
      phone: dto.phone?.trim(),
      cep,
      logradouro: dto.logradouro?.trim(),
      numero: dto.numero?.trim(),
      complemento: dto.complemento?.trim(),
      bairro: dto.bairro?.trim(),
      cidade: dto.cidade?.trim(),
      uf: dto.uf?.trim()?.toUpperCase(),
      relacoesComerciais,
    };

    if (!this.prisma.$transaction) {
      const code = await nextTenantCode(this.prisma as any, tenantId, 'CLIENT');
      const created = await this.prisma.client.create({
        data: {
          ...createData,
          code,
        },
      });
      await this.audit.log(tenantId, 'CLIENT_CREATED', actorId, undefined, {
        ...this.auditSnapshot(created),
      });
      return created;
    }

    return this.prisma.$transaction(async (tx) => {
      const code = await nextTenantCode(tx as any, tenantId, 'CLIENT');
      const created = await tx.client.create({
        data: {
          ...createData,
          code,
        },
      });
      await this.audit.log(tenantId, 'CLIENT_CREATED', actorId, undefined, {
        ...this.auditSnapshot(created),
      });
      return created;
    });
  }

  async update(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateClientDto,
  ) {
    const current = await this.get(tenantId, id);
    const type = dto.type || current.type;
    if (type !== 'PF' && type !== 'PJ')
      throw new BadRequestException('Tipo inválido');

    const cpf = this.digits(dto.cpf ?? current.cpf);
    const cnpj = this.digits(dto.cnpj ?? current.cnpj);
    const cep = this.digits(dto.cep ?? current.cep);
    const relacoesComerciais = this.normalizeRelacoes(
      dto.relacoesComerciais ?? current.relacoesComerciais ?? ['CLIENTE'],
    );

    if (type === 'PF') {
      if (!dto.name?.trim() && !current.name?.trim())
        throw new BadRequestException('Nome é obrigatório');
      if (!cpf) throw new BadRequestException('CPF é obrigatório');
    }

    if (type === 'PJ') {
      const razao = dto.razaoSocial?.trim() || current.razaoSocial?.trim();
      if (!cnpj) throw new BadRequestException('CNPJ é obrigatório');
      if (!razao) throw new BadRequestException('Razão social é obrigatória');
      const contrib = dto.contribuinte ?? current.contribuinte;
      if (contrib === 'CONTRIBUINTE_ICMS') {
        if (
          !dto.inscricaoEstadual?.trim() &&
          !current.inscricaoEstadual?.trim()
        ) {
          throw new BadRequestException('Inscrição estadual é obrigatória');
        }
        if (
          !dto.ufInscricaoEstadual?.trim() &&
          !current.ufInscricaoEstadual?.trim()
        ) {
          throw new BadRequestException(
            'UF da inscrição estadual é obrigatória',
          );
        }
      }
    }

    if (cpf) await this.ensureUniqueCpf(tenantId, cpf, id);
    if (cnpj) await this.ensureUniqueCnpj(tenantId, cnpj, id);

    const updateData: Prisma.ClientUpdateInput = {
      type,
      name:
        type === 'PJ'
          ? dto.razaoSocial?.trim() ||
            current.razaoSocial?.trim() ||
            dto.name?.trim() ||
            current.name?.trim()
          : dto.name?.trim() || current.name?.trim(),
      cpf: type === 'PF' ? cpf : null,
      rg: type === 'PF' ? (dto.rg?.trim() ?? current.rg) : null,
      cnpj: type === 'PJ' ? cnpj : null,
      razaoSocial:
        type === 'PJ' ? (dto.razaoSocial?.trim() ?? current.razaoSocial) : null,
      nomeFantasia:
        type === 'PJ'
          ? (dto.nomeFantasia?.trim() ?? current.nomeFantasia)
          : null,
      contribuinte:
        type === 'PJ' ? (dto.contribuinte ?? current.contribuinte) : null,
      inscricaoEstadual:
        type === 'PJ' &&
        (dto.contribuinte ?? current.contribuinte) === 'CONTRIBUINTE_ICMS'
          ? (dto.inscricaoEstadual?.trim() ?? current.inscricaoEstadual)
          : null,
      ufInscricaoEstadual:
        type === 'PJ' &&
        (dto.contribuinte ?? current.contribuinte) === 'CONTRIBUINTE_ICMS'
          ? (dto.ufInscricaoEstadual?.trim() ?? current.ufInscricaoEstadual)
          : null,
      email: dto.email?.trim().toLowerCase() ?? current.email,
      phone: dto.phone?.trim() ?? current.phone,
      cep,
      logradouro: dto.logradouro?.trim() ?? current.logradouro,
      numero: dto.numero?.trim() ?? current.numero,
      complemento: dto.complemento?.trim() ?? current.complemento,
      bairro: dto.bairro?.trim() ?? current.bairro,
      cidade: dto.cidade?.trim() ?? current.cidade,
      uf: dto.uf?.trim()?.toUpperCase() ?? current.uf,
      relacoesComerciais,
    };

    const updated = await this.prisma.client.update({
      where: { id },
      data: updateData,
    });

    await this.audit.log(tenantId, 'CLIENT_UPDATED', actorId, undefined, {
      before: this.auditSnapshot(current),
      after: this.auditSnapshot(updated),
      fields: {
        type: dto.type !== undefined,
        name: dto.name !== undefined,
        cpf: dto.cpf !== undefined,
        rg: dto.rg !== undefined,
        cnpj: dto.cnpj !== undefined,
        razaoSocial: dto.razaoSocial !== undefined,
        nomeFantasia: dto.nomeFantasia !== undefined,
        contribuinte: dto.contribuinte !== undefined,
        inscricaoEstadual: dto.inscricaoEstadual !== undefined,
        ufInscricaoEstadual: dto.ufInscricaoEstadual !== undefined,
        email: dto.email !== undefined,
        phone: dto.phone !== undefined,
        cep: dto.cep !== undefined,
        logradouro: dto.logradouro !== undefined,
        numero: dto.numero !== undefined,
        complemento: dto.complemento !== undefined,
        bairro: dto.bairro !== undefined,
        cidade: dto.cidade !== undefined,
        uf: dto.uf !== undefined,
        relacoesComerciais: dto.relacoesComerciais !== undefined,
      },
    });

    return updated;
  }

  async remove(tenantId: string, actorId: string, id: string) {
    const current = await this.get(tenantId, id);
    await this.prisma.client.delete({ where: { id } });
    await this.audit.log(tenantId, 'CLIENT_DELETED', actorId, undefined, {
      ...this.auditSnapshot(current),
    });
    return { ok: true };
  }
}
