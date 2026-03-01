import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import type { JwtAuthRequest } from '../auth/jwt-auth-request';
import { Permissions } from '../auth/roles/permissions.decorator';
import { CalculatorsService } from './calculators.service';
import type { Response } from 'express';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calculators')
export class CalculatorsController {
  constructor(private readonly calculators: CalculatorsService) {}

  @Get('holidays')
  @Permissions('calculator.read')
  listHolidays(
    @Req() _req: JwtAuthRequest,
    @Query('year') yearRaw?: string,
    @Query('uf') uf?: string,
    @Query('city') city?: string,
  ) {
    const year = Number(yearRaw || new Date().getFullYear());
    return this.calculators.getHolidays(year, uf, city);
  }

  @Post('child-support/pdf')
  @Permissions('calculator.read')
  async childSupportPdf(
    @Req() _req: JwtAuthRequest,
    @Body() body: Record<string, unknown>,
    @Res() res: Response,
  ) {
    const pdf = await this.calculators.buildChildSupportPdf(body);
    const fileName = `memoria-pensao-${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdf);
  }
}
