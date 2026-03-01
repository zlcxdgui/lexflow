import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [AuditModule, BillingModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
