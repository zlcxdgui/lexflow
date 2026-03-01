import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt/jwt.strategy';
import { LoginRateLimitGuard } from './login-rate-limit.guard';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';

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
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev_secret_change_me',
      signOptions: {
        expiresIn: parseJwtExpiresInSeconds(
          process.env.JWT_EXPIRES_IN,
          60 * 60 * 24 * 7,
        ),
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, LoginRateLimitGuard],
  exports: [AuthService],
})
export class AuthModule {}
