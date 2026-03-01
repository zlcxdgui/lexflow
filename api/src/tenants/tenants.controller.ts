import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Permissions } from '../auth/roles/permissions.decorator';
import { TenantsService } from './tenants.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import type { JwtAuthRequest } from '../auth/jwt-auth-request';
import { GovernanceRateLimitGuard } from './governance-rate-limit.guard';

@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  private userId(req: JwtAuthRequest) {
    return req.user.sub;
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Permissions('team.update')
  @Get()
  listAll(@Req() req: JwtAuthRequest) {
    return this.tenants.listAllTenants(this.userId(req));
  }

  @Get('mine')
  listMine(@Req() req: JwtAuthRequest) {
    return this.tenants.listMyTenants(this.userId(req));
  }

  @UseGuards(RolesGuard, GovernanceRateLimitGuard)
  @Roles('ADMIN')
  @Permissions('team.update')
  @Post()
  create(
    @Req() req: JwtAuthRequest,
    @Body() body: { name: string; timezone?: string },
  ) {
    return this.tenants.createTenant(
      this.userId(req),
      body.name,
      body.timezone,
    );
  }

  @UseGuards(RolesGuard, GovernanceRateLimitGuard)
  @Roles('ADMIN')
  @Permissions('team.update')
  @Patch(':tenantId')
  rename(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
    @Body() body: { name?: string; timezone?: string },
  ) {
    return this.tenants.renameTenant(
      this.userId(req),
      tenantId,
      body.name,
      body.timezone,
    );
  }

  @UseGuards(RolesGuard, GovernanceRateLimitGuard)
  @Roles('ADMIN')
  @Permissions('team.update')
  @Patch(':tenantId/status')
  setStatus(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.tenants.setTenantStatus(
      this.userId(req),
      tenantId,
      body.isActive,
    );
  }

  @UseGuards(RolesGuard, GovernanceRateLimitGuard)
  @Roles('ADMIN')
  @Permissions('team.update')
  @Post('switch')
  switch(@Req() req: JwtAuthRequest, @Body() body: { tenantId: string }) {
    return this.tenants.switchTenant(this.userId(req), body.tenantId);
  }

  @UseGuards(RolesGuard)
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('team.read')
  @Get(':tenantId/members')
  listMembers(@Req() req: JwtAuthRequest, @Param('tenantId') tenantId: string) {
    return this.tenants.listMembers(tenantId, this.userId(req));
  }

  @UseGuards(RolesGuard)
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('team.read')
  @Get(':tenantId/access-groups')
  listAccessGroups(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
  ) {
    return this.tenants.listAccessGroups(tenantId, this.userId(req));
  }

  @UseGuards(RolesGuard)
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('team.update')
  @Post(':tenantId/access-groups')
  createAccessGroup(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
    @Body()
    dto: {
      name?: string;
      key?: string | null;
      isActive?: boolean;
      permissions?: string[];
    },
  ) {
    return this.tenants.createAccessGroup(tenantId, this.userId(req), dto);
  }

  @UseGuards(RolesGuard)
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('team.update')
  @Patch(':tenantId/access-groups/:groupId')
  updateAccessGroup(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
    @Param('groupId') groupId: string,
    @Body() dto: { name?: string; isActive?: boolean; permissions?: string[] },
  ) {
    return this.tenants.updateAccessGroup(
      tenantId,
      this.userId(req),
      groupId,
      dto,
    );
  }

  @UseGuards(RolesGuard)
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('team.update')
  @Delete(':tenantId/access-groups/:groupId')
  deleteAccessGroup(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.tenants.deleteAccessGroup(tenantId, this.userId(req), groupId);
  }

  @UseGuards(RolesGuard)
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('team.read')
  @Get(':tenantId/invites/pending')
  listPendingInvites(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
  ) {
    return this.tenants.listPendingInvites(tenantId, this.userId(req));
  }

  @UseGuards(RolesGuard)
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('team.update')
  @Post(':tenantId/invites/:inviteId/resend')
  resendPendingInvite(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.tenants.resendPendingInvite(
      tenantId,
      this.userId(req),
      inviteId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('team.update')
  @Delete(':tenantId/invites/:inviteId')
  cancelPendingInvite(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.tenants.cancelPendingInvite(
      tenantId,
      this.userId(req),
      inviteId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('team.update')
  @Post(':tenantId/members')
  addMember(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.tenants.addMember(
      tenantId,
      this.userId(req),
      dto.email,
      dto.role,
      dto.fullName,
      dto.employeeClientId,
      dto.settings,
    );
  }

  @UseGuards(RolesGuard)
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('team.read')
  @Get(':tenantId/members/:memberId')
  getMember(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.tenants.getMember(tenantId, this.userId(req), memberId);
  }

  @UseGuards(RolesGuard)
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('team.update')
  @Patch(':tenantId/members/:memberId')
  updateMember(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.tenants.updateMember(tenantId, this.userId(req), memberId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('team.update')
  @Patch(':tenantId/members/:memberId/profile')
  updateMemberProfile(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
    @Body() dto: { name?: string; email?: string; employeeClientId?: string },
  ) {
    return this.tenants.updateMemberProfile(
      tenantId,
      this.userId(req),
      memberId,
      dto,
    );
  }

  @UseGuards(RolesGuard)
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('team.update')
  @Patch(':tenantId/members/:memberId/settings')
  updateMemberSettings(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
    @Body()
    dto: {
      supervisor?: boolean;
      receivesReleaseCenterNotifications?: boolean;
      blockAccessAfter?: string | null;
      passwordRotateDays?: number | null;
      language?: string;
      timezone?: string;
      modulePermissions?: string[];
      groupPermissions?: string[];
      accessScheduleEnabled?: boolean;
      accessSchedule?: Array<{ day: number; start: string; end: string }>;
    },
  ) {
    return this.tenants.updateMemberSettings(
      tenantId,
      this.userId(req),
      memberId,
      dto,
    );
  }

  @UseGuards(RolesGuard)
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('team.update')
  @Post(':tenantId/members/:memberId/resend-activation')
  resendActivation(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.tenants.resendActivation(tenantId, this.userId(req), memberId);
  }

  @UseGuards(RolesGuard)
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('team.update')
  @Post(':tenantId/members/:memberId/unlock')
  unlockMember(
    @Req() req: JwtAuthRequest,
    @Param('tenantId') tenantId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.tenants.unlockMember(tenantId, this.userId(req), memberId);
  }
}
