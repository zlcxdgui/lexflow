import { Module } from '@nestjs/common';
import { MattersController } from './matters.controller';
import { MattersService } from './matters.service';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [AuditModule, BillingModule],
  controllers: [MattersController],
  providers: [MattersService],
})
export class MattersModule {}
