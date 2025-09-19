import { Module } from '@nestjs/common';
import { DiagramsService } from './diagrams.service';
import { DiagramsController } from './diagrams.controller';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [DiagramsController],
  providers: [DiagramsService, PrismaService],
})
export class DiagramsModule {}
