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
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import type { JwtAuthRequest } from '../auth/jwt-auth-request';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Permissions } from '../auth/roles/permissions.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

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

  @Get('tasks')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('agenda.read')
  listAgenda(
    @Req() req: JwtAuthRequest,
    @Query('status') status?: string,
    @Query('assignedToUserId') assignedToUserId?: string,
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
    return this.tasks.listAgenda(this.tenantId(req), {
      status,
      assignedToUserId,
      dueFrom,
      dueTo,
      viewerUserId: !canAll && canOwn ? this.userId(req) : undefined,
      hideData: !canAll && !canOwn && canReadOnly,
    });
  }

  @Post('tasks')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('task.create')
  create(@Req() req: JwtAuthRequest, @Body() dto: CreateTaskDto) {
    return this.tasks.create(this.tenantId(req), this.userId(req), dto);
  }

  // tasks de um caso
  @Get('matters/:matterId/tasks')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('task.read')
  listByMatter(
    @Req() req: JwtAuthRequest,
    @Param('matterId') matterId: string,
  ) {
    return this.tasks.listByMatter(this.tenantId(req), matterId);
  }

  @Post('matters/:matterId/tasks')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('task.create')
  createForMatter(
    @Req() req: JwtAuthRequest,
    @Param('matterId') matterId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.createForMatter(
      this.tenantId(req),
      matterId,
      this.userId(req),
      dto,
    );
  }

  // manipular tarefa por id
  @Patch('tasks/:id')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('task.edit')
  update(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(this.tenantId(req), this.userId(req), id, dto);
  }

  @Delete('tasks/:id')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('task.delete')
  remove(@Req() req: JwtAuthRequest, @Param('id') id: string) {
    return this.tasks.remove(this.tenantId(req), this.userId(req), id);
  }

  @Get('appointments')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('appointment.read')
  listAppointments(
    @Req() req: JwtAuthRequest,
    @Query('status') status?: string,
    @Query('assignedToUserId') assignedToUserId?: string,
    @Query('dueFrom') dueFrom?: string,
    @Query('dueTo') dueTo?: string,
  ) {
    return this.tasks.listAppointments(this.tenantId(req), {
      status,
      assignedToUserId,
      dueFrom,
      dueTo,
    });
  }

  @Post('appointments')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('appointment.create')
  createAppointment(@Req() req: JwtAuthRequest, @Body() dto: CreateTaskDto) {
    return this.tasks.createAppointment(
      this.tenantId(req),
      this.userId(req),
      dto,
    );
  }

  @Patch('appointments/:id')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('appointment.edit')
  updateAppointment(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.updateAppointment(
      this.tenantId(req),
      this.userId(req),
      id,
      dto,
    );
  }

  @Delete('appointments/:id')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('appointment.delete')
  removeAppointment(@Req() req: JwtAuthRequest, @Param('id') id: string) {
    return this.tasks.removeAppointment(
      this.tenantId(req),
      this.userId(req),
      id,
    );
  }
}
