import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    this.$use(async (params, next) => {
      if (
        params.model === 'AuditLog' &&
        ['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(
          params.action,
        )
      ) {
        throw new Error('AuditLog é imutável e não pode ser alterado');
      }
      return next(params);
    });

    await this.$connect();
  }
}
