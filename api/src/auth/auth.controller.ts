import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { LoginRateLimitGuard } from './login-rate-limit.guard';
import { JwtAuthGuard } from './jwt/jwt.guard';
import type { JwtAuthRequest } from './jwt-auth-request';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private getRequestIp(req: Request) {
    const xff = req.headers['x-forwarded-for'];
    if (Array.isArray(xff) && xff.length) {
      return String(xff[0]).split(',')[0].trim();
    }
    if (typeof xff === 'string' && xff.length) {
      return xff.split(',')[0].trim();
    }
    return req.ip;
  }

  private getRequestDeviceKey(req: Request) {
    const raw = req.headers['x-device-id'];
    if (Array.isArray(raw) && raw.length) return String(raw[0]).trim();
    if (typeof raw === 'string') return raw.trim();
    return undefined;
  }

  @Post('signup')
  signup(@Req() req: Request, @Body() dto: SignupDto) {
    const userAgent = Array.isArray(req.headers['user-agent'])
      ? req.headers['user-agent'][0]
      : req.headers['user-agent'];
    return this.auth.signup(dto, {
      ip: this.getRequestIp(req),
      userAgent,
      deviceKey: this.getRequestDeviceKey(req),
    });
  }

  @Post('login')
  @UseGuards(LoginRateLimitGuard)
  login(@Req() req: Request, @Body() dto: LoginDto) {
    const userAgent = Array.isArray(req.headers['user-agent'])
      ? req.headers['user-agent'][0]
      : req.headers['user-agent'];
    return this.auth.login(dto, {
      ip: this.getRequestIp(req),
      userAgent,
      deviceKey: this.getRequestDeviceKey(req),
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('2fa/status')
  twoFactorStatus(@Req() req: JwtAuthRequest) {
    return this.auth.twoFactorStatus(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  setupTwoFactor(@Req() req: JwtAuthRequest) {
    return this.auth.setupTwoFactor(req.user.sub, String(req.user.email || ''));
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  enableTwoFactor(@Req() req: JwtAuthRequest, @Body() body: { code?: string }) {
    return this.auth.enableTwoFactor(req.user.sub, String(body?.code || ''));
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  disableTwoFactor(
    @Req() req: JwtAuthRequest,
    @Body() body: { code?: string },
  ) {
    return this.auth.disableTwoFactor(req.user.sub, String(body?.code || ''));
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  sessions(@Req() req: JwtAuthRequest) {
    return this.auth.listSessions(req.user.sub, req.user.sid);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:sessionId')
  revokeSession(
    @Req() req: JwtAuthRequest,
    @Param('sessionId') sessionId: string,
  ) {
    return this.auth.revokeSession(req.user.sub, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions')
  revokeOtherSessions(@Req() req: JwtAuthRequest) {
    return this.auth.revokeOtherSessions(req.user.sub, req.user.sid);
  }
}
