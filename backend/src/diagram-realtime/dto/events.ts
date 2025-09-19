// src/diagram-realtime/dto/events.ts
export type Patch =
  | { type: 'nodeMoved'; id: string; x: number; y: number }
  | { type: 'nodeAttrs'; id: string; attrs: any }
  | { type: 'edgeAdded'; edge: any }
  | { type: 'edgeRemoved'; id: string }
  | { type: 'full'; snapshot: { nodes: any[]; edges: any[] } };

export type JoinPayload = {
  projectId: string;
  shareToken?: string; // opcional para invitados
  authToken?: string; // si lo pasas por handshake, puedes extraerlo en el gateway
};

export type RequestEditPayload = {
  projectId: string;
  message?: string;
};

export type ApproveEditPayload = {
  projectId: string;
  userId: string;
  role?: 'EDITOR' | 'VIEWER'; // default EDITOR
};
