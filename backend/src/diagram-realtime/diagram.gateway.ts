// src/diagram-realtime/diagram.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';

// ⬇️ tipos como type-only
import type { Server, Socket } from 'socket.io';
import { ShareService } from '../share/share.service';
import { PrismaService } from '../common/prisma.service';
import { RealtimeService } from './realtime.service';
import { JwtService } from '@nestjs/jwt';

// ⬇️ importa los DTOs como type-only
import type {
  Patch,
  JoinPayload,
  RequestEditPayload,
  ApproveEditPayload,
} from './dto/events';

@WebSocketGateway({ cors: true, namespace: '/diagram' })
export class DiagramGateway {
  @WebSocketServer() server!: Server; // ⬅️ usa la type de arriba

  constructor(
    private share: ShareService,
    private prisma: PrismaService,
    private realtime: RealtimeService,
    private jwt: JwtService,
  ) {}

  private async parseUserIdFromToken(token?: string): Promise<string | null> {
    if (!token) return null;
    try {
      const payload: any = this.jwt.verify(token); // asume misma secret del REST
      return payload?.id || payload?.sub || null;
    } catch {
      return null;
    }
  }

  // join a sala por proyecto
  @SubscribeMessage('join')
  async handleJoin(
    @MessageBody() data: JoinPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { projectId, shareToken, authToken } = data;
    // asegura estado en memoria
    const snapshot =
      this.realtime.getRoom(projectId)?.snapshot ||
      (await this.realtime.loadInitial(projectId));

    const userId = await this.parseUserIdFromToken(authToken);
    let role: 'VIEWER' | 'EDITOR' | 'OWNER' = 'VIEWER';

    if (userId) {
      // dueño o miembro?
      const p = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          ownerId: true,
          members: { where: { userId }, select: { role: true } },
        },
      });
      if (p?.ownerId === userId) role = 'OWNER';
      else if (p?.members?.length) role = 'EDITOR'; // simplificado: si es miembro, puede editar
    } else if (shareToken) {
      // invitado via link → viewer
      const r = await this.share.validateShareToken(projectId, shareToken);
      if (!r) {
        client.emit('joinDenied', { reason: 'invalid_share_link' });
        return;
      }
      role = 'VIEWER';
    } else {
      client.emit('joinDenied', { reason: 'unauthorized' });
      return;
    }

    // une a sala y envía snapshot + rol
    client.join(projectId);
    client.data = { projectId, userId, role };
    client.emit('joined', { snapshot, role });

    // presencia simple
    this.server.to(projectId).emit('presence', { userId, role, event: 'join' });
  }

  // parches de edición (solo editor/owner)
  @SubscribeMessage('patch')
  async handlePatch(
    @MessageBody() data: { projectId: string; patch: Patch },
    @ConnectedSocket() client: Socket,
  ) {
    const { projectId, patch } = data;
    if (client.data?.projectId !== projectId) return;
    const role = client.data?.role;
    if (role !== 'EDITOR' && role !== 'OWNER') {
      client.emit('editDenied', {
        reason: client.data?.userId ? 'no_permission' : 'login_required',
      });
      return;
    }

    // encola patch → autosave backend
    this.realtime.queuePatch(projectId, patch);
    // reenvía a otros
    client.to(projectId).emit('remotePatch', patch);
  }

  // pedir acceso de edición (solo si logueado y NO miembro)
  @SubscribeMessage('requestEdit')
  async requestEdit(
    @MessageBody() data: RequestEditPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { projectId, message } = data;
    const userId = client.data?.userId;
    if (!userId) {
      client.emit('editDenied', { reason: 'login_required' });
      return;
    }
    // ya es miembro?
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (member) {
      client.emit('editGranted', { role: member.role });
      client.data.role = 'EDITOR';
      return;
    }

    // crea o asegura solicitud pendiente
    const req = await this.prisma.editRequest.upsert({
      where: { projectId_requesterId: { projectId, requesterId: userId } },
      update: { status: 'PENDING', message: message ?? null },
      create: { projectId, requesterId: userId, message: message ?? null },
    });

    // notifica al owner
    const owner = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (owner?.ownerId) {
      // avisa en una "sala" del owner (por simplicidad usa ID)
      this.server.to(`user:${owner.ownerId}`).emit('editRequest', {
        projectId,
        requesterId: userId,
        requestId: req.id,
        message: req.message,
      });
    }
    client.emit('requestQueued');
  }

  // owner aprueba via socket
  @SubscribeMessage('approveEdit')
  async approve(
    @MessageBody() data: ApproveEditPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { projectId, userId, role = 'EDITOR' } = data;
    // verificar que quien envía sea owner del proyecto
    const me = client.data?.userId;
    if (!me) return;
    const p = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!p || p.ownerId !== me) return;

    // agrega como miembro
    await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: { role: role === 'EDITOR' ? 'EDITOR' : 'VIEWER' },
      create: {
        projectId,
        userId,
        role: role === 'EDITOR' ? 'EDITOR' : 'VIEWER',
      },
    });
    // marca solicitud aprobada
    await this.prisma.editRequest.updateMany({
      where: { projectId, requesterId: userId, status: 'PENDING' },
      data: { status: 'APPROVED' },
    });

    // notifica a todos en la sala
    this.server.to(projectId).emit('memberUpdated', { userId, role });
  }

  // registro simple de sockets por usuario para notificar owner
  handleConnection(client: Socket) {
    // si el cliente trae authToken en handshake, lo registramos
    const token =
      client.handshake.auth?.token || client.handshake.headers['x-auth-token'];
    this.parseUserIdFromToken(token).then((userId) => {
      if (userId) {
        client.join(`user:${userId}`);
      }
    });
  }

  handleDisconnect(client: Socket) {
    const projectId = client.data?.projectId;
    const userId = client.data?.userId;
    if (projectId) {
      this.server.to(projectId).emit('presence', { userId, event: 'leave' });
    }
  }
}
