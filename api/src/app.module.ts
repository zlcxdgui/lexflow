import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { MattersModule } from './matters/matters.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { DeadlinesModule } from './deadlines/deadlines.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DocumentsModule } from './documents/documents.module';
import { AuditModule } from './audit/audit.module';
import { RolesModule } from './auth/roles/roles.module';
import { ReportsModule } from './reports/reports.module';
import { TenantsModule } from './tenants/tenants.module';
import { AgendaModule } from './agenda/agenda.module';
import { MetricsService } from './observability/metrics.service';
import { CalculatorsModule } from './calculators/calculators.module';
import { BillingModule } from './billing/billing.module';
import { FinanceModule } from './finance/finance.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    RolesModule,
    ClientsModule,
    MattersModule,
    UsersModule,
    TasksModule,
    DeadlinesModule,
    DashboardModule,
    ReportsModule,
    DocumentsModule,
    AuditModule,
    TenantsModule,
    AgendaModule,
    CalculatorsModule,
    BillingModule,
    FinanceModule,
  ],
  controllers: [AppController],
  providers: [AppService, MetricsService],
})
export class AppModule {}
