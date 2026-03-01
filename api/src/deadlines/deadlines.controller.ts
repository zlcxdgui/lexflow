import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { DeadlinesService } from './deadlines.service';
import { CreateDeadlineDto } from './dto/create-deadline.dto';
import { UpdateDeadlineDto } from './dto/update-deadline.dto';
import type { JwtAuthRequest } from '../auth/jwt-auth-request';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Permissions } from '../auth/roles/permissions.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class DeadlinesController {
  constructor(private readonly deadlines: DeadlinesService) {}

  private tenantId(req: JwtAuthRequest) {
    return req.user.tenantId;
  }
  private userId(req: JwtAuthRequest) {
    return req.user.sub;
  }

  private canViewAllAgenda(req: JwtAuthRequest) {
    const permissions = Array.isArray(req.user.permissions)
      ? req.user.permissions
      : [];
    return permissions.includes('agenda.read.all');
  }

  private canViewOwnAgenda(req: JwtAuthRequest) {
    const permissions = Array.isArray(req.user.permissions)
      ? req.user.permissions
      : [];
    return permissions.includes('agenda.read.own');
  }

  private canViewAgendaOnly(req: JwtAuthRequest) {
    const permissions = Array.isArray(req.user.permissions)
      ? req.user.permissions
      : [];
    return permissions.includes('agenda.read');
  }

  @Get('deadlines')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('agenda.read')
  listAgenda(
    @Req() req: JwtAuthRequest,
    @Query('type') type?: string,
    @Query('isDone') isDone?: string,
    @Query('dueFrom') dueFrom?: string,
    @Query('dueTo') dueTo?: string,
  ) {
    const canAll = this.canViewAllAgenda(req);
    const canOwn = this.canViewOwnAgenda(req);
    const canReadOnly = this.canViewAgendaOnly(req);
    if (!canAll && !canOwn && !canReadOnly) {
      throw new ForbiddenException(
        'Sem autorização. Entre em contato com o responsável do escritório.',
      );
    }
    return this.deadlines.listAgenda(this.tenantId(req), {
      type,
      isDone,
      dueFrom,
      dueTo,
      viewerUserId: !canAll && canOwn ? req.user.sub : undefined,
      hideData: !canAll && !canOwn && canReadOnly,
    });
  }

  @Get('matters/:matterId/deadlines')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('deadline.read')
  listByMatter(
    @Req() req: JwtAuthRequest,
    @Param('matterId') matterId: string,
  ) {
    return this.deadlines.listByMatter(this.tenantId(req), matterId);
  }

  @Post('matters/:matterId/deadlines')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('deadline.create')
  createForMatter(
    @Req() req: JwtAuthRequest,
    @Param('matterId') matterId: string,
    @Body() dto: CreateDeadlineDto,
  ) {
    return this.deadlines.createForMatter(
      this.tenantId(req),
      matterId,
      this.userId(req),
      dto,
    );
  }

  @Get('deadlines/upcoming')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('deadline.read')
  upcoming(@Req() req: JwtAuthRequest, @Query('days') days?: string) {
    const n = days ? parseInt(days, 10) : 7;
    return this.deadlines.upcoming(this.tenantId(req), n);
  }

  @Patch('deadlines/:id')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('deadline.edit')
  update(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateDeadlineDto,
  ) {
    return this.deadlines.update(this.tenantId(req), this.userId(req), id, dto);
  }

  @Delete('deadlines/:id')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('deadline.delete')
  remove(@Req() req: JwtAuthRequest, @Param('id') id: string) {
    return this.deadlines.remove(this.tenantId(req), this.userId(req), id);
  }
}
