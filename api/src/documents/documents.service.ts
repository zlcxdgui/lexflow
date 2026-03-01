import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { createReadStream, existsSync, unlinkSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { extension as mimeExtension, lookup as mimeLookup } from 'mime-types';
import { AuditService } from '../audit/audit.service';

function sha256File(path: string) {
  const buf = readFileSync(path);
  return createHash('sha256').update(buf).digest('hex');
}

function inferMime(originalName: string, fallback: string) {
  const guessed = mimeLookup(originalName);
  if (typeof guessed === 'string' && guessed.length > 0) return guessed;
  return fallback || 'application/octet-stream';
}

function fixMojibakeName(name: string) {
  const value = String(name || '');
  if (!value) return value;
  if (!/[ÃÂ]/.test(value)) return value;
  try {
    const decoded = Buffer.from(value, 'latin1').toString('utf8');
    if (!decoded || decoded.includes('�')) return value;
    return decoded;
  } catch {
    return value;
  }
}

function sanitizeDocName(name: string) {
  return name
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeFolder(value?: string | null) {
  const text = String(value || '').trim();
  return text || 'Geral';
}

function normalizeTags(tags?: unknown) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)
    .slice(0, 20);
}

const documentListSelect = {
  id: true,
  tenantId: true,
  matterId: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  checksumSha256: true,
  folder: true,
  tags: true,
  createdAt: true,
  uploadedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.DocumentSelect;

type DocumentListRow = Prisma.DocumentGetPayload<{
  select: typeof documentListSelect;
}>;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async getMetaByMatter(tenantId: string, matterId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: { tenantId, matterId, action: 'DOCUMENT_META_UPDATED' },
      orderBy: { createdAt: 'asc' },
      select: { metaJson: true },
    });

    const map = new Map<string, { folder: string; tags: string[] }>();
    for (const row of logs) {
      if (!row.metaJson) continue;
      try {
        const meta = JSON.parse(row.metaJson) as {
          documentId?: string;
          folder?: string;
          tags?: string[];
        };
        const docId = String(meta.documentId || '').trim();
        if (!docId) continue;
        map.set(docId, {
          folder: normalizeFolder(meta.folder),
          tags: normalizeTags(meta.tags),
        });
      } catch {
        // ignore malformed audit rows
      }
    }
    return map;
  }

  async listByMatter(tenantId: string, matterId: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { tenantId, id: matterId },
    });
    if (!matter) throw new NotFoundException('Caso não encontrado');

    const docs = await this.prisma.document.findMany({
      where: { tenantId, matterId },
      orderBy: { createdAt: 'desc' },
      select: documentListSelect,
    });
    const metaMap = await this.getMetaByMatter(tenantId, matterId);
    return docs.map((doc: DocumentListRow) => {
      const meta = metaMap.get(doc.id);
      return {
        ...doc,
        folder: normalizeFolder(doc.folder || meta?.folder),
        tags: normalizeTags(doc.tags ?? meta?.tags),
      };
    });
  }

  async createForMatter(
    tenantId: string,
    matterId: string,
    uploadedByUserId: string,
    file?: Express.Multer.File,
  ) {
    const matter = await this.prisma.matter.findFirst({
      where: { tenantId, id: matterId },
    });
    if (!matter) throw new NotFoundException('Caso não encontrado');

    if (!file) throw new BadRequestException('Arquivo é obrigatório');
    if (!file.path || !existsSync(file.path))
      throw new BadRequestException('Falha ao salvar arquivo no disco');

    const normalizedOriginalName = fixMojibakeName(file.originalname);
    const mimeType = inferMime(normalizedOriginalName, file.mimetype);
    const checksumSha256 = sha256File(file.path);

    const created = await this.prisma.document.create({
      data: {
        tenantId,
        matterId,
        uploadedByUserId,
        originalName: normalizedOriginalName,
        mimeType,
        sizeBytes: file.size,
        storagePath: file.path,
        checksumSha256,
      },
      select: {
        id: true,
        tenantId: true,
        matterId: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        checksumSha256: true,
        createdAt: true,
      },
    });

    await this.audit.log(
      tenantId,
      'DOCUMENT_UPLOADED',
      uploadedByUserId,
      matterId,
      {
        documentId: created.id,
        originalName: created.originalName,
        sizeBytes: created.sizeBytes,
        mimeType: created.mimeType,
        checksumSha256: created.checksumSha256,
      },
    );

    return created;
  }

  async getForDownload(tenantId: string, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { tenantId, id },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    if (!existsSync(doc.storagePath))
      throw new NotFoundException('Arquivo não encontrado no disco');

    return { doc, stream: createReadStream(doc.storagePath) };
  }

  async remove(tenantId: string, id: string, userId?: string) {
    const doc = await this.prisma.document.findFirst({
      where: { tenantId, id },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado');

    await this.prisma.document.delete({ where: { id } });

    try {
      if (existsSync(doc.storagePath)) unlinkSync(doc.storagePath);
    } catch {
      // ok
    }

    await this.audit.log(tenantId, 'DOCUMENT_DELETED', userId, doc.matterId, {
      documentId: doc.id,
      originalName: doc.originalName,
      sizeBytes: doc.sizeBytes,
      mimeType: doc.mimeType,
      checksumSha256: doc.checksumSha256,
    });

    return { ok: true };
  }

  async rename(
    tenantId: string,
    id: string,
    originalName: string,
    userId?: string,
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { tenantId, id },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado');

    const cleaned = sanitizeDocName(originalName || '');
    if (!cleaned)
      throw new BadRequestException('Nome do arquivo é obrigatório');
    if (cleaned.length > 180)
      throw new BadRequestException('Nome do arquivo muito longo');

    let nextName = cleaned;
    if (!/\.[a-z0-9]+$/i.test(cleaned)) {
      const extFromName = (doc.originalName.split('.').pop() || '').trim();
      const extFromMime = mimeExtension(doc.mimeType) || '';
      const ext = extFromName || extFromMime;
      if (ext) nextName = `${cleaned}.${ext}`;
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: { originalName: nextName },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        matterId: true,
      },
    });

    await this.audit.log(tenantId, 'DOCUMENT_RENAMED', userId, doc.matterId, {
      documentId: doc.id,
      previousOriginalName: doc.originalName,
      nextOriginalName: nextName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
    });

    return updated;
  }

  async updateMeta(
    tenantId: string,
    id: string,
    folder: string | undefined,
    tags: string[] | undefined,
    userId?: string,
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { tenantId, id },
      select: { id: true, matterId: true },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado');

    const nextFolder = normalizeFolder(folder);
    const nextTags = normalizeTags(tags);

    await this.prisma.document.update({
      where: { id: doc.id },
      data: { folder: nextFolder, tags: nextTags },
    });

    await this.audit.log(
      tenantId,
      'DOCUMENT_META_UPDATED',
      userId,
      doc.matterId,
      {
        documentId: doc.id,
        folder: nextFolder,
        tags: nextTags,
      },
    );

    return { id: doc.id, folder: nextFolder, tags: nextTags };
  }
}
