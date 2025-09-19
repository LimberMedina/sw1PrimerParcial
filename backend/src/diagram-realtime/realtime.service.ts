// src/diagram-realtime/realtime.service.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client'; // 👈 solo tipos de Prisma
import { PrismaService } from '../common/prisma.service'; // 👈 inyecta tu service
import debounce from 'lodash.debounce';

// 1) Tipo fuerte del snapshot que usa el frontend
export type DiagramSnapshot = {
  nodes: any[];
  edges: any[];
  updatedAt: string; // ISO
};

// 2) Default por si no hay nada en DB
const EMPTY_SNAPSHOT: DiagramSnapshot = {
  nodes: [],
  edges: [],
  updatedAt: new Date().toISOString(),
};

// 3) Type guards/utilidades para normalizar desde Prisma.JsonValue
function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function toSnapshot(
  value: Prisma.JsonValue | null | undefined,
): DiagramSnapshot {
  if (value == null) return { ...EMPTY_SNAPSHOT };

  // Si viene como string, intenta parsear
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (isRecord(parsed)) {
        return coerceSnapshot(parsed);
      }
    } catch {
      /* ignore */
    }
    return { ...EMPTY_SNAPSHOT };
  }

  // Si viene como objeto JSON (JsonObject)
  if (isRecord(value)) {
    return coerceSnapshot(value);
  }

  // Cualquier otro caso (número, boolean, array...)
  return { ...EMPTY_SNAPSHOT };
}

function coerceSnapshot(obj: Record<string, unknown>): DiagramSnapshot {
  const nodes = Array.isArray((obj as any).nodes) ? (obj as any).nodes : [];
  const edges = Array.isArray((obj as any).edges) ? (obj as any).edges : [];
  const updatedAt =
    typeof (obj as any).updatedAt === 'string' && (obj as any).updatedAt
      ? (obj as any).updatedAt
      : new Date().toISOString();
  return { nodes, edges, updatedAt };
}

// 4) Room state tipado
type RoomState = {
  snapshot: DiagramSnapshot;
  pendingPatches: any[];
  debouncedSave: () => void;
};

@Injectable()
export class RealtimeService {
  private rooms = new Map<string, RoomState>();

  constructor(private prisma: PrismaService) {} // 👈 AHORA SÍ

  // Cargar o crear snapshot inicial, normalizando tipos
  async loadInitial(projectId: string): Promise<DiagramSnapshot> {
    const diagram = await this.prisma.diagram.findUnique({
      where: { projectId },
      select: { snapshot: true, updatedAt: true },
    });

    if (!diagram) {
      // si no existe, crea registro con snapshot vacío
      const fresh = { ...EMPTY_SNAPSHOT };
      await this.prisma.diagram.create({
        data: {
          projectId,
          snapshot: fresh as unknown as Prisma.InputJsonValue, // para escribir en Json
        },
      });
      return fresh;
    }

    // Normaliza lo que venga de BD (Json | string)
    const snap = toSnapshot(diagram.snapshot);
    return snap;
  }

  getRoom(projectId: string) {
    return this.rooms.get(projectId);
  }

  // Llamado por el gateway cuando el primero hace join
  async ensureRoom(projectId: string) {
    if (this.rooms.has(projectId)) return this.rooms.get(projectId)!;

    const snapshot = await this.loadInitial(projectId);

    const debouncedSave = debounce(async () => {
      const room = this.rooms.get(projectId);
      if (!room) return;
      // Actualiza updatedAt y guarda
      const toSave: DiagramSnapshot = {
        ...room.snapshot,
        updatedAt: new Date().toISOString(),
      };
      await this.prisma.diagram.update({
        where: { projectId },
        data: {
          snapshot: toSave as unknown as Prisma.InputJsonValue,
        },
      });
      // Reemplaza en memoria con el updatedAt nuevo
      room.snapshot = toSave;
    }, 800);

    const state: RoomState = {
      snapshot,
      pendingPatches: [],
      debouncedSave,
    };

    this.rooms.set(projectId, state);
    return state;
  }

  // Encolá parches y gatillá autosave
  queuePatch(projectId: string, patch: any) {
    const room = this.rooms.get(projectId);
    if (!room) return;

    room.pendingPatches.push(patch);
    // TODO: aplicar patch a room.snapshot según tu formato
    room.debouncedSave();
  }
}
