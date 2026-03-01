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
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import type { JwtAuthRequest } from '../auth/jwt-auth-request';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Permissions } from '../auth/roles/permissions.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  private tenantId(req: JwtAuthRequest) {
    return req.user.tenantId;
  }

  @Get()
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('client.read')
  list(@Req() req: JwtAuthRequest) {
    return this.clients.list(this.tenantId(req));
  }

  @Get(':id')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('client.read')
  get(@Req() req: JwtAuthRequest, @Param('id') id: string) {
    return this.clients.get(this.tenantId(req), id);
  }

  @Post()
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('client.create')
  create(@Req() req: JwtAuthRequest, @Body() dto: CreateClientDto) {
    return this.clients.create(this.tenantId(req), req.user.sub, dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('client.edit')
  update(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clients.update(this.tenantId(req), req.user.sub, id, dto);
  }

  @Delete(':id')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('client.delete')
  remove(@Req() req: JwtAuthRequest, @Param('id') id: string) {
    return this.clients.remove(this.tenantId(req), req.user.sub, id);
  }
}
