import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TenantsService } from './tenants.service';

@Controller('invites')
export class InvitesController {
  constructor(private readonly tenants: TenantsService) {}

  @Get(':token')
  getInvite(@Param('token') token: string) {
    return this.tenants.getInviteByToken(token);
  }

  @Post('accept')
  acceptInvite(@Body() body: { token: string; password: string }) {
    return this.tenants.acceptInvite(body?.token, body?.password);
  }
}
