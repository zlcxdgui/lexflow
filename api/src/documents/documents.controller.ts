import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import { extname, resolve } from 'path';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { AuditService } from '../audit/audit.service';
import { Roles } from '../auth/roles/roles.decorator';
import { Permissions } from '../auth/roles/permissions.decorator';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import type { JwtAuthRequest } from '../auth/jwt-auth-request';

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

function sanitizeName(name: string) {
  return name.replace(/[^\w.-]+/g, '_');
}

const uploadRoot = resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
mkdirSync(uploadRoot, { recursive: true });

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class DocumentsController {
  constructor(
    private readonly docs: DocumentsService,
    private readonly audit: AuditService,
  ) {}

  private tenantId(req: JwtAuthRequest) {
    return req.user.tenantId;
  }
  private userId(req: JwtAuthRequest) {
    return req.user.sub;
  }

  @Get('matters/:matterId/documents')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('document.read')
  list(@Req() req: JwtAuthRequest, @Param('matterId') matterId: string) {
    return this.docs.listByMatter(this.tenantId(req), matterId);
  }

  @Post('matters/:matterId/documents')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('document.upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadRoot,
        filename: (_req, file, cb) => {
          file.originalname = fixMojibakeName(file.originalname);
          const safe = sanitizeName(file.originalname);
          const ext = extname(safe);
          const base = safe.replace(ext, '');
          cb(null, `${base}_${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    }),
  )
  upload(
    @Req() req: JwtAuthRequest,
    @Param('matterId') matterId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.docs.createForMatter(
      this.tenantId(req),
      matterId,
      this.userId(req),
      file,
    );
  }

  @Get('documents/:id/download')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('document.read')
  async download(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const tenantId = this.tenantId(req);
    const userId = this.userId(req);

    const { doc, stream } = await this.docs.getForDownload(tenantId, id);

    await this.audit.log(
      tenantId,
      'DOCUMENT_DOWNLOADED',
      userId,
      doc.matterId,
      {
        documentId: doc.id,
        originalName: doc.originalName,
        sizeBytes: doc.sizeBytes,
        mimeType: doc.mimeType,
        checksumSha256: doc.checksumSha256,
      },
    );

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(doc.originalName)}"`,
    );

    stream.pipe(res);
  }

  @Get('documents/:id/view')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('document.read')
  async view(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const tenantId = this.tenantId(req);
    const userId = this.userId(req);

    const { doc, stream } = await this.docs.getForDownload(tenantId, id);

    await this.audit.log(tenantId, 'DOCUMENT_VIEWED', userId, doc.matterId, {
      documentId: doc.id,
      originalName: doc.originalName,
      sizeBytes: doc.sizeBytes,
      mimeType: doc.mimeType,
      checksumSha256: doc.checksumSha256,
    });

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(doc.originalName)}"`,
    );

    stream.pipe(res);
  }

  @Delete('documents/:id')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('document.delete')
  remove(@Req() req: JwtAuthRequest, @Param('id') id: string) {
    return this.docs.remove(this.tenantId(req), id, this.userId(req));
  }

  @Patch('documents/:id')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('document.edit')
  rename(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body() body: { originalName?: string; folder?: string; tags?: string[] },
  ) {
    const tenantId = this.tenantId(req);
    const userId = this.userId(req);

    const hasName = typeof body?.originalName === 'string';
    const hasMeta = body?.folder !== undefined || body?.tags !== undefined;

    if (hasName && hasMeta) {
      return Promise.all([
        this.docs.rename(
          tenantId,
          id,
          String(body?.originalName || ''),
          userId,
        ),
        this.docs.updateMeta(tenantId, id, body.folder, body.tags, userId),
      ]).then(([renamed, meta]) => ({ ...renamed, ...meta }));
    }

    if (hasName) {
      return this.docs.rename(
        tenantId,
        id,
        String(body?.originalName || ''),
        userId,
      );
    }

    return this.docs.updateMeta(tenantId, id, body?.folder, body?.tags, userId);
  }
}
