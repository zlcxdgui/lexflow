import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { InvitesController } from './invites.controller';
import { MailService } from '../mail/mail.service';
import { GovernanceRateLimitGuard } from './governance-rate-limit.guard';
import { BillingModule } from '../billing/billing.module';

function parseJwtExpiresInSeconds(
  input: string | undefined,
  fallbackSeconds: number,
) {
  if (!input || typeof input !== 'string') return fallbackSeconds;

  const raw = input.trim().toLowerCase();

  if (/^\d+$/.test(raw)) return parseInt(raw, 10);

  const match = raw.match(/^(\d+)\s*([smhd])$/);
  if (!match) return fallbackSeconds;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      return fallbackSeconds;
  }
}

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev_secret_change_me',
      signOptions: {
        expiresIn: parseJwtExpiresInSeconds(
          process.env.JWT_EXPIRES_IN,
          60 * 60 * 24 * 7,
        ),
      },
    }),
    AuditModule,
    BillingModule,
  ],
  controllers: [TenantsController, InvitesController],
  providers: [TenantsService, MailService, GovernanceRateLimitGuard],
})
export class TenantsModule {}
