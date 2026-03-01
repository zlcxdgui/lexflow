import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { RolesGuard } from '../auth/roles/roles.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import type { JwtAuthRequest } from '../auth/jwt-auth-request';
import { Permissions } from '../auth/roles/permissions.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  private tenantId(req: JwtAuthRequest) {
    return req.user.tenantId;
  }
  private userId(req: JwtAuthRequest) {
    return req.user.sub;
  }

  @Post()
  @Permissions('team.update')
  create(@Req() req: JwtAuthRequest, @Body() dto: CreateUserDto) {
    return this.users.createInTenant(this.tenantId(req), dto);
  }

  @Get()
  @Permissions('team.read')
  list(@Req() req: JwtAuthRequest) {
    return this.users.listTenantMembers(this.tenantId(req), req.user.role);
  }

  @Get('me')
  me(@Req() req: JwtAuthRequest) {
    return this.users.getMyProfile(this.tenantId(req), this.userId(req));
  }

  @Post('me/password')
  changePassword(
    @Req() req: JwtAuthRequest,
    @Body()
    body: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    },
  ) {
    return this.users.changeMyPassword(
      this.tenantId(req),
      this.userId(req),
      body,
      req.user.sid,
    );
  }

  @Roles('ADMIN')
  @Get('platform-admins')
  listPlatformAdmins() {
    return this.users.listPlatformAdmins();
  }

  @Roles('ADMIN')
  @Post('platform-admins/promote')
  promotePlatformAdmin(
    @Req() req: JwtAuthRequest,
    @Body() body: { email?: string },
  ) {
    return this.users.promotePlatformAdmin(
      this.tenantId(req),
      this.userId(req),
      String(body?.email || ''),
    );
  }

  @Roles('ADMIN')
  @Post('platform-admins/demote')
  demotePlatformAdmin(
    @Req() req: JwtAuthRequest,
    @Body() body: { userId?: string },
  ) {
    return this.users.demotePlatformAdmin(
      this.tenantId(req),
      this.userId(req),
      String(body?.userId || ''),
    );
  }
}
