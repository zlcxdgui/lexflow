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
import type { JwtAuthRequest } from '../auth/jwt-auth-request';
import { AgendaService, type AgendaFilters } from './agenda.service';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { Permissions } from '../auth/roles/permissions.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('agenda/views')
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  private tenantId(req: JwtAuthRequest) {
    return req.user.tenantId;
  }

  private userId(req: JwtAuthRequest) {
    return req.user.sub;
  }

  @Get()
  @Permissions('agenda.read')
  list(@Req() req: JwtAuthRequest) {
    return this.agenda.listViews(this.tenantId(req), this.userId(req));
  }

  @Post()
  @Permissions('agenda.manage')
  create(
    @Req() req: JwtAuthRequest,
    @Body()
    body: {
      name: string;
      filters: Record<string, unknown>;
      setDefault?: boolean;
    },
  ) {
    return this.agenda.createView(this.tenantId(req), this.userId(req), {
      name: body?.name,
      filters: (body?.filters ?? {}) as AgendaFilters,
      setDefault: Boolean(body?.setDefault),
    });
  }

  @Patch(':id')
  @Permissions('agenda.manage')
  update(
    @Req() req: JwtAuthRequest,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      filters?: Record<string, unknown>;
      setDefault?: boolean;
    },
  ) {
    return this.agenda.updateView(this.tenantId(req), this.userId(req), id, {
      name: body?.name,
      filters: body?.filters as AgendaFilters | undefined,
      setDefault: body?.setDefault,
    });
  }

  @Delete(':id')
  @Roles('OWNER', 'LAWYER', 'ASSISTANT')
  @Permissions('agenda.manage')
  remove(@Req() req: JwtAuthRequest, @Param('id') id: string) {
    return this.agenda.deleteView(this.tenantId(req), this.userId(req), id);
  }
}
