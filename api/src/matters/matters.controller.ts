import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MattersService } from './matters.service';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Permissions } from '../auth/roles/permissions.decorator';
import { CreateMatterDto } from './dto/create-matter.dto';
import { UpdateMatterDto } from './dto/update-matter.dto';
import { CreateMatterUpdateDto } from './dto/create-matter-update.dto';
import { UpdateMatterUpdateDto } from './dto/update-matter-update.dto';
import type { JwtAuthRequest } from '../auth/jwt-auth-request';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('matters')
export class MattersController {
  constructor(private readonly matters: MattersService) {}

  private tenantId(req: JwtAuthRequest) {
    return req.user.tenantId;
  }

  private userId(req: JwtAuthRequest) {
    return req.user.sub;
  }

  // Lista (já deve existir no seu projeto; mantive aqui)
  @Get()
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('matter.read')
  list(@Req() req: JwtAuthRequest) {
    return this.matters.list(this.tenantId(req));
  }

  // ✅ NOVO: buscar 1 caso por id
  @Get(':id')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('matter.read')
  getOne(@Req() req: JwtAuthRequest, @Param('id') id: string) {
    return this.matters.getOne(this.tenantId(req), id);
  }

  // Criar caso (se você já tem, ok; deixei aqui por completude)
  @Post()
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('matter.create')
  create(@Req() req: JwtAuthRequest, @Body() body: CreateMatterDto) {
    return this.matters.create(this.tenantId(req), this.userId(req), body);
  }

  // Atualizar (se você já tem, ok)
  @Patch(':id')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('matter.edit')
  update(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body() body: UpdateMatterDto,
  ) {
    return this.matters.update(this.tenantId(req), this.userId(req), id, body);
  }

  @Get(':id/updates')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('matter.read')
  listUpdates(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? parseInt(limit, 10) : 30;
    return this.matters.listUpdates(this.tenantId(req), id, n);
  }

  @Post(':id/updates')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('matter.edit')
  addUpdate(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body() body: CreateMatterUpdateDto,
  ) {
    return this.matters.addUpdate(
      this.tenantId(req),
      id,
      this.userId(req),
      body,
    );
  }

  @Patch(':id/updates/:updateId')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('matter.edit')
  updateUpdate(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Param('updateId') updateId: string,
    @Body() body: UpdateMatterUpdateDto,
  ) {
    return this.matters.updateUpdate(
      this.tenantId(req),
      id,
      updateId,
      this.userId(req),
      body,
    );
  }

  @Get(':id/updates/:updateId/history')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('matter.read')
  listUpdateHistory(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Param('updateId') updateId: string,
  ) {
    return this.matters.listUpdateHistory(this.tenantId(req), id, updateId);
  }

  @Delete(':id/updates/:updateId')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('matter.delete')
  removeUpdate(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Param('updateId') updateId: string,
  ) {
    return this.matters.removeUpdate(
      this.tenantId(req),
      id,
      updateId,
      this.userId(req),
    );
  }

  // membros / tasks / deadlines / docs etc ficam nos seus controllers atuais
}
