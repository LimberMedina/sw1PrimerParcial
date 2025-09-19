import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { DiagramsService } from './diagrams.service';
import { UpsertDiagramDto } from './dto/upsert-diagram.dto';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/diagram')
export class DiagramsController {
  constructor(private readonly diagrams: DiagramsService) {}

  @Get()
  async get(@Req() req: any, @Param('projectId') projectId: string) {
    const userId: string = req.user.id;
    return this.diagrams.getOrInitForUser(userId, projectId);
  }

  @Put()
  async put(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() dto: UpsertDiagramDto,
  ) {
    const userId: string = req.user.id;
    return this.diagrams.upsertForUser(userId, projectId, dto);
  }
}
