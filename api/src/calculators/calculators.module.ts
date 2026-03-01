import { Module } from '@nestjs/common';
import { CalculatorsController } from './calculators.controller';
import { CalculatorsService } from './calculators.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CalculatorsController],
  providers: [CalculatorsService],
})
export class CalculatorsModule {}
