import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        ownerId,
        // el owner también queda en la tabla de miembros con rol OWNER
        members: {
          create: {
            userId: ownerId,
            role: 'OWNER',
          },
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // devolvemos con role OWNER para el frontend
    return { ...project, role: 'OWNER' as const };
  }

  async listForUser(userId: string) {
    // Trae proyectos donde es owner o es miembro
    const projects = await this.prisma.project.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: {
        id: true,
        name: true,
        description: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        // Trae solo mi membership para conocer mi rol
        members: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // map a forma consumible por el Dashboard
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      role: p.ownerId === userId ? 'OWNER' : (p.members[0]?.role ?? 'VIEWER'),
    }));
  }

  async getForUser(userId: string, projectId: string) {
    const p = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        description: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        members: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
      },
    });

    if (!p) throw new NotFoundException('Proyecto no encontrado');

    const isMember = p.ownerId === userId || p.members.length > 0;
    if (!isMember) throw new ForbiddenException('Sin acceso a este proyecto');

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      role: p.ownerId === userId ? 'OWNER' : (p.members[0]?.role ?? 'VIEWER'),
    };
  }
}
