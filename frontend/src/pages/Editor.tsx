// src/pages/Editor.tsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Graph } from "@antv/x6";
import { Selection } from "@antv/x6-plugin-selection";
import { Toaster } from "react-hot-toast";

import { api } from "../lib/api";
import { useAuth } from "../state/AuthContext";

import { registerShapesOnce } from "../uml/shapes";
import Sidebar from "../uml/ui/Sidebar";
import type { Tool } from "../uml/ui/Sidebar";
import AIAssistant from "../uml/ui/AIAssistant";

import { toSnapshot, fromSnapshot } from "../uml/snapshot";

import type { NodeKind } from "../uml/actions/nodes";
import { CLASS_SIZES } from "../uml/tokens";
import ClassEditorModal from "../uml/ui/ClassEditorModal";
import DiagramControls from "../uml/ui/DiagramControls";

// ===== Estilos para relaciones =====
type EdgeKind = "assoc" | "nav" | "aggr" | "comp" | "dep" | "inherit";

const EDGE_STYLE: Record<
  EdgeKind,
  {
    dashed?: boolean;
    sourceMarker?: any;
    targetMarker?: any;
    stroke?: string;
    strokeWidth?: number;
  }
> = {
  assoc: {
    dashed: false,
    targetMarker: null as any,
    sourceMarker: null as any,
    stroke: "#374151",
    strokeWidth: 1.5,
  },
  nav: {
    dashed: false,
    targetMarker: { name: "block", width: 12, height: 9 },
    stroke: "#374151",
    strokeWidth: 1.5,
  },
  aggr: {
    dashed: false,
    targetMarker: { name: "diamond", width: 14, height: 12, fill: "#ffffff" },
    stroke: "#111827",
    strokeWidth: 1.6,
  },
  comp: {
    dashed: false,
    targetMarker: { name: "diamond", width: 14, height: 12, fill: "#111827" },
    stroke: "#111827",
    strokeWidth: 1.8,
  },
  dep: {
    dashed: true,
    targetMarker: { name: "classic", width: 12, height: 9 },
    stroke: "#6B7280",
    strokeWidth: 1.2,
  },
  inherit: {
    dashed: false,
    targetMarker: { name: "classic", width: 16, height: 10, fill: "none" },
    stroke: "#111827",
    strokeWidth: 1.6,
  },
};

type Side = "top" | "right" | "bottom" | "left";

// ===== Formularios =====
export type ClassFormValues = {
  name: string;
  attributes: string[];
  methods: string[];
};
export type RelationFormValues = {
  name: string;
  multSource: string;
  multTarget: string;
};

/* ============================================================
   === Auto-resize helpers para uml-class (nombre/attrs/methods)
   ============================================================ */
const MONO_FONT =
  "12px JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const NAME_FONT =
  "13px JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const LINE_HEIGHT = 20;
const NAME_HEIGHT = (CLASS_SIZES as any).H_NAME ?? 44;
const MIN_ATTRS_H = 28;
const MIN_METHODS_H = 28;
const HPAD = 16;
const MIN_WIDTH = Math.max(180, (CLASS_SIZES as any).WIDTH ?? 180);

let _measureCtx: CanvasRenderingContext2D | null = null;
function ensureMeasureCtx() {
  if (_measureCtx) return _measureCtx;
  const c = document.createElement("canvas");
  _measureCtx = c.getContext("2d");
  return _measureCtx!;
}
function measureTextWidth(text: string, font: string) {
  const ctx = ensureMeasureCtx();
  ctx.font = font;
  return ctx.measureText(text).width;
}
function computeResizeFromContent(
  name: string,
  attrsArr: string[],
  methodsArr: string[]
) {
  const widths = [
    measureTextWidth(name || "Class", NAME_FONT),
    ...attrsArr.map((s) => measureTextWidth(s, MONO_FONT)),
    ...methodsArr.map((s) => measureTextWidth(s, MONO_FONT)),
  ];
  const width = Math.max(MIN_WIDTH, Math.ceil(Math.max(0, ...widths)) + HPAD);

  const attrsH = Math.max(
    MIN_ATTRS_H,
    (attrsArr.length || 0) * LINE_HEIGHT + 8
  );
  const methodsH = Math.max(
    MIN_METHODS_H,
    (methodsArr.length || 0) * LINE_HEIGHT + 8
  );

  const nameH = NAME_HEIGHT;
  const totalH = nameH + attrsH + methodsH;

  return { width, nameH, attrsH, methodsH, totalH };
}

/* ====================== FIX “dentado” + bucle ======================= */
const TSPAN_OBS = new Map<string, MutationObserver[]>();
const RESIZING = new Set<string>();

function getNodeGroup(node: any): SVGGElement | null {
  const g = document.querySelector(
    `[data-cell-id="${node.id}"]`
  ) as SVGGElement | null;
  return g && document.contains(g) ? g : null;
}

function computeBaseX(
  group: SVGGElement,
  selector: "attrs" | "methods"
): number {
  const rectEl = group.querySelector(
    `[selector="${selector}-rect"]`
  ) as SVGGraphicsElement | null;
  if (rectEl) {
    try {
      const x = rectEl.getBBox().x + 6;
      if (Number.isFinite(x)) return x;
    } catch {}
  }
  const textEl = group.querySelector(
    `[selector="${selector}"], [magnet-id="${selector}"]`
  ) as SVGTextElement | null;
  if (textEl) {
    const firstT = textEl.querySelector(
      "tspan"
    ) as SVGTextContentElement | null;
    const x0 = firstT?.getAttribute("x");
    if (x0 != null && x0 !== "" && !Number.isNaN(parseFloat(x0)))
      return parseFloat(x0);
    const tx = textEl.getAttribute("x");
    if (tx != null && tx !== "" && !Number.isNaN(parseFloat(tx)))
      return parseFloat(tx);
    try {
      const bx = textEl.getBBox().x;
      if (Number.isFinite(bx)) return bx;
    } catch {}
  }
  return 0;
}

function fixTspans(node: any, selector: "attrs" | "methods") {
  const group = getNodeGroup(node);
  if (!group) return;
  const textEl = group.querySelector(
    `[selector="${selector}"], [magnet-id="${selector}"]`
  ) as SVGTextElement | null;
  if (!textEl) return;
  const tspans = Array.from(
    textEl.querySelectorAll("tspan")
  ) as SVGTextContentElement[];
  if (tspans.length === 0) return;
  const baseX = computeBaseX(group, selector);
  textEl.setAttribute("text-anchor", "start");
  textEl.setAttribute("xml:space", "preserve");
  const safeBaseX = Number.isFinite(baseX) ? baseX : 0;
  const baseXStr = String(safeBaseX);
  for (const t of tspans) {
    t.removeAttribute("textLength");
    t.setAttribute("dx", "0");
    t.setAttribute("x", baseXStr);
  }
}
function observeTspans(node: any, selector: "attrs" | "methods") {
  const group = getNodeGroup(node);
  if (!group) return;
  const textEl = group.querySelector(
    `[selector="${selector}"], [magnet-id="${selector}"]`
  ) as SVGTextElement | null;
  if (!textEl) return;
  fixTspans(node, selector);
  const obs = new MutationObserver(() => fixTspans(node, selector));
  obs.observe(textEl, { childList: true, subtree: true, attributes: true });
  const arr = TSPAN_OBS.get(node.id) ?? [];
  arr.push(obs);
  TSPAN_OBS.set(node.id, arr);
}
function detachNodeObservers(nodeId: string) {
  const arr = TSPAN_OBS.get(nodeId);
  if (arr) {
    arr.forEach((o) => o.disconnect());
    TSPAN_OBS.delete(nodeId);
  }
}
function clearAnchorAttrs(node: any, sel: "name" | "attrs" | "methods") {
  const keys = ["x", "y", "dx", "dy"];
  for (const k of keys) {
    node.removeAttrByPath?.(`${sel}/${k}`);
    node.setAttrByPath?.(`${sel}/${k}`, undefined as any);
  }
}
function pinTextsToSegments(node: any) {
  if (!node || node.shape !== "uml-class") return;
  clearAnchorAttrs(node, "name");
  clearAnchorAttrs(node, "attrs");
  clearAnchorAttrs(node, "methods");
  const w = node.getSize()?.width ?? 180;
  const wrapWidth = Math.max(40, w - 12);
  node.setAttrs?.(
    {
      name: {
        ref: "name-rect",
        refX: 0.5,
        refY: 0.5,
        textAnchor: "middle",
        textVerticalAnchor: "middle",
        fontWeight: 600,
        textWrap: {
          width: wrapWidth,
          ellipsis: true,
          align: "left",
          lineHeight: 16,
        },
      },
      attrs: {
        ref: "attrs-rect",
        refX: 6,
        refY: 8,
        textAnchor: "start",
        textVerticalAnchor: "top",
        textWrap: {
          width: wrapWidth,
          breakWord: true,
          ellipsis: false,
          align: "left",
          lineHeight: 18,
        },
      },
      methods: {
        ref: "methods-rect",
        refX: 6,
        refY: 8,
        textAnchor: "start",
        textVerticalAnchor: "top",
        textWrap: {
          width: wrapWidth,
          breakWord: true,
          ellipsis: false,
          align: "left",
          lineHeight: 18,
        },
      },
    },
    { silent: true }
  );
  detachNodeObservers(node.id);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      observeTspans(node, "attrs");
      observeTspans(node, "methods");
    });
  });
}
function resizeUmlClass(node: any) {
  if (!node || node.shape !== "uml-class") return;
  if (RESIZING.has(node.id)) return;
  RESIZING.add(node.id);
  try {
    const data = node.getData?.() ?? {};
    const name = data?.name ?? node.attr?.("name/text") ?? "Class";
    const attrsArr = (data?.attributes ?? [])
      .map((s: string) => s.trim())
      .filter(Boolean);
    const methodsArr = (data?.methods ?? [])
      .map((s: string) => s.trim())
      .filter(Boolean);
    const { width, nameH, attrsH, methodsH, totalH } = computeResizeFromContent(
      String(name),
      attrsArr,
      methodsArr
    );
    node.setSize({ width, height: totalH }, { silent: true });
    node.setAttrs?.(
      {
        "name-rect": { height: nameH },
        "attrs-rect": { y: nameH, height: attrsH },
        "methods-rect": { y: nameH + attrsH, height: methodsH },
      },
      { silent: true }
    );
    pinTextsToSegments(node);
  } finally {
    RESIZING.delete(node.id);
  }
}

/* =================== Etiquetas de relaciones ==================== */
function applyEdgeLabels(edge: any) {
  const data = edge.getData?.() ?? {};
  const name: string = data?.name ?? "";
  const multSource: string = data?.multSource ?? "";
  const multTarget: string = data?.multTarget ?? "";

  const baseFont = {
    fontSize: 12,
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    fill: "#111827",
  };

  const { src, dst } = computeSafeEndpointFractions(edge);

  const labels: any[] = [];

  if (multSource) {
    labels.push({
      position: { distance: src, offset: 12 },
      attrs: { label: { ...baseFont, text: multSource } },
    });
  }

  if (name) {
    labels.push({
      position: 0.5,
      offset: -10,
      attrs: { label: { ...baseFont, text: name } },
    });
  }

  if (multTarget) {
    labels.push({
      position: { distance: dst, offset: 12 },
      attrs: { label: { ...baseFont, text: multTarget } },
    });
  }

  edge.setLabels(labels);
}

function getEdgePoints(edge: any): {
  pts: { x: number; y: number }[];
  total: number;
  firstLen: number;
  lastLen: number;
} {
  const p0 = edge.getSourcePoint();
  const pN = edge.getTargetPoint();
  const vs = edge.getVertices() as { x: number; y: number }[];
  const pts = [p0, ...vs, pN].filter(Boolean);

  const segLen = (a: any, b: any) => Math.hypot(b.x - a.x, b.y - a.y);
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += segLen(pts[i], pts[i + 1]);

  const firstLen = pts.length >= 2 ? segLen(pts[0], pts[1]) : 0;
  const lastLen =
    pts.length >= 2 ? segLen(pts[pts.length - 2], pts[pts.length - 1]) : 0;
  return { pts, total, firstLen, lastLen };
}

function computeSafeEndpointFractions(edge: any) {
  const { total, firstLen, lastLen } = getEdgePoints(edge);
  if (!Number.isFinite(total) || total <= 0) {
    return { src: 0.06, dst: 0.94 };
  }
  const PX_AWAY = 12;
  const CAP = 0.18;
  const src = Math.max(
    0.02,
    Math.min(CAP, Math.max(0, Math.min(firstLen - 2, PX_AWAY)) / total)
  );
  const dstOff = Math.max(
    0.02,
    Math.min(CAP, Math.max(0, Math.min(lastLen - 2, PX_AWAY)) / total)
  );
  const dst = 1 - dstOff;
  return { src, dst };
}

/* =================== FIN helpers ==================== */

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const shareToken = new URLSearchParams(location.search).get("share");
  const readonly = Boolean(shareToken);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);

  // UI
  const [tool, setTool] = useState<Tool>("cursor");
  const [loading, setLoading] = useState(true);
  const [graphReady, setGraphReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // dueño del proyecto para habilitar "Compartir"
  const [ownerId, setOwnerId] = useState<string | null>(null);

  // Colocar nodo con un click
  const placingNodeKindRef = useRef<NodeKind | null>(null);

  // ====== Modo relación de un solo uso ======
  const oneShotRef = useRef<{
    active: boolean;
    kind: EdgeKind | null;
    sourceCellId: string | null;
  }>({
    active: false,
    kind: null,
    sourceCellId: null,
  });

  // Handler guardado para .on/.off
  const nodeClickHandlerRef = useRef<((args: { node: any }) => void) | null>(
    null
  );

  // ====== Puertos (5 por lado) ======
  type PortMap = Record<Side, string[]>;
  const SIDE_PORTS: PortMap = {
    top: ["t0", "t1", "t2", "t3", "t4"],
    right: ["r0", "r1", "r2", "r3", "r4"],
    bottom: ["b0", "b1", "b2", "b3", "b4"],
    left: ["l0", "l1", "l2", "l3", "l4"],
  };

  const PREFERRED_ORDER = [2, 1, 3, 0, 4];
  const portCursorRef = useRef<Record<string, Record<Side, number>>>({});

  function allocPortPreferMiddle(nodeId: string, side: Side): string {
    const map = portCursorRef.current;
    map[nodeId] ||= { top: 0, right: 0, bottom: 0, left: 0 };
    const cursor = map[nodeId][side] % PREFERRED_ORDER.length;
    const idx = PREFERRED_ORDER[cursor];
    map[nodeId][side] += 1;
    return SIDE_PORTS[side][idx];
  }

  function nearestPort(
    nodeBBox: { x: number; y: number; width: number; height: number },
    side: Side,
    towards: { x: number; y: number }
  ): string {
    const { x, y, width, height } = nodeBBox;
    const N = SIDE_PORTS[side].length;
    if (side === "top" || side === "bottom") {
      const t = (towards.x - x) / Math.max(1, width);
      const idx = Math.min(N - 1, Math.max(0, Math.round(t * (N - 1))));
      return SIDE_PORTS[side][idx];
    } else {
      const t = (towards.y - y) / Math.max(1, height);
      const idx = Math.min(N - 1, Math.max(0, Math.round(t * (N - 1))));
      return SIDE_PORTS[side][idx];
    }
  }

  function pickSide(
    a: { x: number; y: number },
    b: { x: number; y: number }
  ): Side {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? "right" : "left";
    return dy >= 0 ? "bottom" : "top";
  }
  function opposite(side: Side): Side {
    switch (side) {
      case "top":
        return "bottom";
      case "bottom":
        return "top";
      case "left":
        return "right";
      default:
        return "left";
    }
  }

  function reassignEdgePorts(edge: any) {
    const graph = graphRef.current!;
    const src = edge.getSource();
    const tgt = edge.getTarget();
    if (!src?.cell || !tgt?.cell) return;

    const srcNode = graph.getCellById(src.cell)! as any;
    const tgtNode = graph.getCellById(tgt.cell)! as any;

    const sc = srcNode.getBBox().center;
    const tc = tgtNode.getBBox().center;

    const srcSide = pickSide(sc, tc);
    const tgtSide = opposite(srcSide);

    const srcBBox = srcNode.getBBox();
    const tgtBBox = tgtNode.getBBox();

    const srcPort = nearestPort(srcBBox, srcSide, tc);
    const tgtPort = nearestPort(tgtBBox, tgtSide, sc);

    edge.setSource({ cell: srcNode.id, port: srcPort });
    edge.setTarget({ cell: tgtNode.id, port: tgtPort });
    edge.setRouter({ name: "orth", args: { padding: 6 } });
    edge.setConnector({ name: "rounded" });

    applyEdgeLabels(edge);
  }

  // Registrar shapes una sola vez
  useEffect(() => {
    registerShapesOnce();
  }, []);

  // ======== Menú contextual y editor ========
  const [menu, setMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    kind: "node" | "edge" | null;
    id: string | null;
  }>({ visible: false, x: 0, y: 0, kind: null, id: null });

  const [editorOpen, setEditorOpen] = useState(false);

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);

  const [initialClassForm, setInitialClassForm] =
    useState<ClassFormValues | null>(null);
  const [initialRelForm, setInitialRelForm] =
    useState<RelationFormValues | null>(null);

  // ======== Helpers del editor ========
  function readNodeToForm(node: any): ClassFormValues {
    const data = node.getData?.() ?? {};
    const name =
      data?.name ??
      node.getAttrByPath?.("name/text") ??
      node.attr?.("name/text") ??
      "Class";

    const attrsText =
      data?.attributes ??
      node.getAttrByPath?.("attrs/text") ??
      node.attr?.("attrs/text") ??
      "";
    const methodsText =
      data?.methods ??
      node.getAttrByPath?.("methods/text") ??
      node.attr?.("methods/text") ??
      "";

    const toLines = (v: any) =>
      Array.isArray(v)
        ? (v as string[])
        : String(v || "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);

    return {
      name: String(name || "Class"),
      attributes: toLines(attrsText),
      methods: toLines(methodsText),
    };
  }

  const save = async () => {
    if (!graphRef.current) return;
    const snap = toSnapshot(graphRef.current);

    await api.put(`/projects/${id}/diagram`, {
      nodes: snap.nodes,
      edges: snap.edges,
      updatedAt: new Date().toISOString(),
    });
  };

  function writeFormToNode(node: any, form: ClassFormValues) {
    node.setAttrs?.(
      {
        name: { text: form.name },
        attrs: { text: form.attributes.join("\n") },
        methods: { text: form.methods.join("\n") },
      },
      { silent: true }
    );
    const nextData = {
      ...(node.getData?.() ?? {}),
      name: form.name,
      attributes: form.attributes,
      methods: form.methods,
    };
    node.setData?.(nextData, { overwrite: true });
    resizeUmlClass(node);
  }

  function readEdgeToForm(edge: any): RelationFormValues {
    const data = edge.getData?.() ?? {};
    return {
      name: String(data?.name ?? ""),
      multSource: String(data?.multSource ?? ""),
      multTarget: String(data?.multTarget ?? ""),
    };
  }
  function writeFormToEdge(edge: any, form: RelationFormValues) {
    const nextData = {
      ...(edge.getData?.() ?? {}),
      name: form.name,
      multSource: form.multSource,
      multTarget: form.multTarget,
    };
    edge.setData?.(nextData, { overwrite: true });
    applyEdgeLabels(edge);
  }

  // ====== Scheduler para resizes ======
  const pendingResize = useRef<Set<string>>(new Set());
  function scheduleResize(nodeId: string) {
    if (pendingResize.current.has(nodeId)) return;
    pendingResize.current.add(nodeId);
    requestAnimationFrame(() => {
      const graph = graphRef.current;
      const node = graph?.getCellById(nodeId) as any;
      if (node) resizeUmlClass(node);
      pendingResize.current.delete(nodeId);
    });
  }

  // Inicializar Graph
  useEffect(() => {
    if (!containerRef.current) return;

    const graph = new Graph({
      container: containerRef.current,
      background: { color: "#ffffff" },
      grid: {
        visible: true,
        size: 10,
        type: "dot",
        args: { color: "#e5e7eb" },
      },
      panning: true,
      mousewheel: { enabled: true, modifiers: ["ctrl"] },
      connecting: {
        allowBlank: false,
        allowLoop: false,
        snap: true,
        router: { name: "orth", args: { padding: 6 } },
        connector: { name: "rounded" },
        highlight: true,
        validateMagnet({ magnet }) {
          if (readonly) return false;
          const isActive = oneShotRef.current.active;
          if (!isActive) return false;
          return magnet?.getAttribute?.("magnet") !== "passive";
        },
      },
      interacting: readonly ? false : { edgeLabelMovable: true },
    });

    graph.use(
      new Selection({
        enabled: !readonly,
        multiple: !readonly,
        rubberband: !readonly,
        movable: !readonly,
        showNodeSelectionBox: !readonly,
      })
    );

    // Estética: edges arriba
    graph.on("edge:added", ({ edge }) => {
      edge.setZIndex(1000);
      edge.toFront();
      applyEdgeLabels(edge);
    });
    graph.on("edge:connected", ({ edge }) => {
      edge.setZIndex(1000);
      edge.toFront();
      edge.setRouter({ name: "orth", args: { padding: 6 } });
      edge.setConnector({ name: "rounded" });
      applyEdgeLabels(edge);
    });

    graph.on("node:moved", ({ node }) => {
      const edges = graph.getConnectedEdges(node);
      edges.forEach((e) => reassignEdgePorts(e));
      edges.forEach((e) => {
        e.setZIndex(1000);
        e.toFront();
      });
    });

    const changeHandler = ({ node }: { node: any }) => {
      if (node?.shape === "uml-class") scheduleResize(node.id);
    };
    graph.on("node:change:attrs", changeHandler);
    graph.on("node:added", changeHandler);
    graph.on("node:change:size", changeHandler);

    graph.on("cell:removed", ({ cell }) => {
      const idCell = (cell && (cell as any).id) || null;
      if (idCell) detachNodeObservers(idCell);
    });

    // ===== One-shot relation: click en dos nodos =====
    const handleNodeClick = ({ node }: { node: any }) => {
      const cfg = oneShotRef.current;
      if (!cfg.active) return;

      const sourceId = cfg.sourceCellId;

      if (!sourceId) {
        cfg.sourceCellId = node.id;
        graph.cleanSelection();
        graph.select(node);
        return;
      }
      if (node.id === sourceId) {
        cfg.sourceCellId = node.id;
        graph.cleanSelection();
        graph.select(node);
        return;
      }

      const kind = (cfg.kind ?? "assoc") as EdgeKind;
      const style = EDGE_STYLE[kind];

      const baseLine: any = {
        stroke: style.stroke ?? "#6366f1",
        strokeWidth: style.strokeWidth ?? 1.5,
        strokeDasharray: style.dashed ? 4 : undefined,
        sourceMarker: style.sourceMarker ?? null,
        targetMarker: style.targetMarker ?? null,
      };

      const sourceNode = graph.getCellById(sourceId)! as any;
      const targetNode = node as any;

      const sc = sourceNode.getBBox().center;
      const tc = targetNode.getBBox().center;

      const sourceSide = pickSide(sc, tc);
      const targetSide = opposite(sourceSide);

      const sourcePort = allocPortPreferMiddle(sourceId, sourceSide);
      const targetPort = allocPortPreferMiddle(targetNode.id, targetSide);

      const edge = graph.addEdge({
        attrs: { line: baseLine },
        zIndex: 1000,
        router: { name: "orth", args: { padding: 6 } },
        connector: { name: "rounded" },
        source: { cell: sourceId, port: sourcePort },
        target: { cell: targetNode.id, port: targetPort },
        data: { name: "", multSource: "", multTarget: "" },
      });

      if (kind === "assoc") {
        edge.attr("line/sourceMarker", null);
        edge.attr("line/targetMarker", null);
      }

      applyEdgeLabels(edge);

      graph.cleanSelection();
      oneShotRef.current = { active: false, kind: null, sourceCellId: null };
      setTool("cursor");
      graph.off("node:click", handleNodeClick);
    };
    nodeClickHandlerRef.current = handleNodeClick;

    // ===== Menú contextual (clic derecho) =====
    const hideMenu = () =>
      setMenu((m) => ({ ...m, visible: false, kind: null, id: null }));

    if (!readonly) {
      graph.on("node:contextmenu", ({ e, node }) => {
        e.preventDefault();
        graph.cleanSelection();
        graph.select(node);
        setMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          kind: "node",
          id: node.id,
        });
      });
      graph.on("edge:contextmenu", ({ e, edge }) => {
        e.preventDefault();
        graph.cleanSelection();
        graph.select(edge);
        setMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          kind: "edge",
          id: edge.id,
        });
      });

      graph.on("blank:click", hideMenu);
      graph.on("node:click", hideMenu);
      graph.on("edge:click", hideMenu);
    } else {
      // en lectura no mostramos menú
      graph.on("node:contextmenu", (ev) => ev.e.preventDefault());
      graph.on("edge:contextmenu", (ev) => ev.e.preventDefault());
    }

    const onKeyDownForMenu = (ev: KeyboardEvent) => {
      if (ev.key === "Escape")
        setMenu((m) => ({ ...m, visible: false, kind: null, id: null }));
    };
    window.addEventListener("keydown", onKeyDownForMenu);

    // Bloquear menú nativo en el contenedor (si quieres)
    const containerContextMenuHandler = (ev: MouseEvent) => {
      if (!readonly) return; // en edición sí dejamos menú propio
      ev.preventDefault();
    };
    containerRef.current?.addEventListener(
      "contextmenu",
      containerContextMenuHandler
    );

    // Guardar referencias
    graphRef.current = graph;
    setGraphReady(true);

    // Resize responsive
    const resize = () => {
      if (!containerRef.current) return;
      graph.resize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight
      );
    };
    resize();
    window.addEventListener("resize", resize);

    // Click en blanco para colocar nodo si está activo el "placing"
    const handleBlankClick = ({ x, y }: { x: number; y: number }) => {
      if (!placingNodeKindRef.current) return;
      addClassAt(graph, x, y);
      placingNodeKindRef.current = null;
      setTool("cursor");
    };
    graph.on("blank:click", handleBlankClick);

    // ESC para cancelar modo relación
    const onKeyUp = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && oneShotRef.current.active) {
        oneShotRef.current = { active: false, kind: null, sourceCellId: null };
        graph.cleanSelection();
        if (nodeClickHandlerRef.current)
          graph.off("node:click", nodeClickHandlerRef.current);
        setTool("cursor");
      }
    };
    window.addEventListener("keyup", onKeyUp);

    // ====== Drag & Drop desde Sidebar al lienzo ======
    const onDragOver = (ev: DragEvent) => {
      if (readonly) return;
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";
    };
    const onDrop = (ev: DragEvent) => {
      if (readonly) return;
      ev.preventDefault();
      const kind = ev.dataTransfer?.getData("x6");
      if (kind !== "uml-class") return;
      const p = graph.clientToLocal(ev.clientX, ev.clientY);
      addClassAt(graph, p.x, p.y);
    };

    const el = containerRef.current!;
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("keydown", onKeyDownForMenu);
      if (containerRef.current) {
        containerRef.current.removeEventListener(
          "contextmenu",
          containerContextMenuHandler
        );
        containerRef.current.removeEventListener("dragover", onDragOver);
        containerRef.current.removeEventListener("drop", onDrop);
      }
      graph.off("blank:click", handleBlankClick);
      graph.off("blank:click", hideMenu);
      graph.off("node:click", hideMenu);
      graph.off("edge:click", hideMenu);
      graph.off("node:change:attrs", changeHandler);
      graph.off("node:added", changeHandler);
      graph.off("node:change:size", changeHandler);
      if (nodeClickHandlerRef.current)
        graph.off("node:click", nodeClickHandlerRef.current);
      graphRef.current = null;
      nodeClickHandlerRef.current = null;

      TSPAN_OBS.forEach((arr) => arr.forEach((o) => o.disconnect()));
      TSPAN_OBS.clear();

      graph.dispose();
      setGraphReady(false);
    };
  }, [readonly]);

  // Autosave debounced (solo edición)
  useEffect(() => {
    if (!graphRef.current || readonly) return;

    let timer: any = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const snap = toSnapshot(graphRef.current!);
          await api.put(`/projects/${id}/diagram`, {
            nodes: snap.nodes,
            edges: snap.edges,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.error("Autosave falló", e);
        }
      }, 1200);
    };

    const g = graphRef.current;
    const onDirty = () => schedule();

    g.on("node:moved", onDirty);
    g.on("node:change:attrs", onDirty);
    g.on("node:change:size", onDirty);
    g.on("node:added", onDirty);
    g.on("cell:removed", onDirty);
    g.on("edge:connected", onDirty);
    g.on("edge:removed", onDirty);

    return () => {
      if (timer) clearTimeout(timer);
      g.off("node:moved", onDirty);
      g.off("node:change:attrs", onDirty);
      g.off("node:change:size", onDirty);
      g.off("node:added", onDirty);
      g.off("cell:removed", onDirty);
      g.off("edge:connected", onDirty);
      g.off("edge:removed", onDirty);
    };
  }, [id, graphReady, readonly]);

  // Cargar snapshot + ownerId
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // 0) Traer metadatos del proyecto (solo si no es lectura)
        if (!readonly) {
          try {
            const meta = await api.get(`/projects/${id}`);
            if (meta && meta.data && meta.data.ownerId) {
              setOwnerId(meta.data.ownerId);
            }
          } catch {}
        }

        // 1) Traer snapshot del backend (respetando share)
        const { data } = await api.get(`/projects/${id}/diagram`, {
          params: shareToken ? { share: shareToken } : undefined,
        });

        // 2) Pintar en X6
        if (graphRef.current) {
          fromSnapshot(graphRef.current, data);

          // 3) Ajustes post-carga
          graphRef.current.getNodes().forEach((n: any) => {
            if (n.shape === "uml-class")
              requestAnimationFrame(() => resizeUmlClass(n));
          });
          graphRef.current.getEdges().forEach((e: any) => {
            e.setZIndex(1000);
            e.toFront();
            e.setRouter({ name: "orth", args: { padding: 6 } });
            e.setConnector({ name: "rounded" });
            applyEdgeLabels(e);
            reassignEdgePorts(e);
          });
        }
      } catch (e: any) {
        setError(
          (e && e.response && e.response.data && e.response.data.message) ||
            (e && e.message) ||
            "No se pudo cargar el diagrama"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [id, readonly, shareToken]);

  // ===== Helpers =====
  const addClassAt = (graph: Graph, x: number, y: number) => {
    const node = graph.addNode({
      shape: "uml-class",
      x: x - (CLASS_SIZES as any).WIDTH / 2,
      y: y - (CLASS_SIZES as any).HEIGHT / 2,
      width: (CLASS_SIZES as any).WIDTH,
      height: (CLASS_SIZES as any).HEIGHT,
      attrs: {
        name: { text: "Class" },
        attrs: { text: "" },
        methods: { text: "" },
      },
      zIndex: 2,
      data: { name: "Class", attributes: [], methods: [] },
    }) as any;
    resizeUmlClass(node);
  };

  // ===== Acciones de menú contextual =====
  function handleEdit() {
    if (readonly) return;
    if (!menu.visible || !menu.id || !graphRef.current || !menu.kind) return;
    const graph = graphRef.current;

    if (menu.kind === "node") {
      const node = graph.getCellById(menu.id) as any;
      if (!node) return;
      setInitialClassForm(readNodeToForm(node));
      setEditingNodeId(menu.id);
      setEditingEdgeId(null);
      setInitialRelForm(null);
      setEditorOpen(true);
    } else {
      const edge = graph.getCellById(menu.id) as any;
      if (!edge) return;
      setInitialRelForm(readEdgeToForm(edge));
      setEditingEdgeId(menu.id);
      setEditingNodeId(null);
      setInitialClassForm(null);
      setEditorOpen(true);
    }
    setMenu((m) => ({ ...m, visible: false }));
  }

  function handleDelete() {
    if (readonly) return;
    if (!menu.visible || !menu.id || !graphRef.current || !menu.kind) return;
    const graph = graphRef.current;

    if (menu.kind === "node") {
      graph.removeNode(menu.id);
    } else {
      graph.removeEdge(menu.id);
    }
    setMenu((m) => ({ ...m, visible: false, kind: null, id: null }));
  }

  // ===== Handlers de herramientas =====
  const onToolClick = (t: Tool) => {
    const graph = graphRef.current;
    setTool(t);
    if (!graph) return;

    if (readonly) {
      // En modo lectura solo permitimos cursor (ignorar otras herramientas)
      if (t !== "cursor") return;
      placingNodeKindRef.current = null;
      oneShotRef.current = { active: false, kind: null, sourceCellId: null };
      graph.cleanSelection();
      if (nodeClickHandlerRef.current)
        graph.off("node:click", nodeClickHandlerRef.current);
      return;
    }

    if (t === "class" || t === "interface" || t === "abstract") {
      placingNodeKindRef.current = t as NodeKind;
      return;
    }

    if (
      t === "assoc" ||
      t === "nav" ||
      t === "aggr" ||
      t === "comp" ||
      t === "dep" ||
      t === "inherit"
    ) {
      oneShotRef.current = {
        active: true,
        kind: t as EdgeKind,
        sourceCellId: null,
      };
      if (nodeClickHandlerRef.current)
        graph.on("node:click", nodeClickHandlerRef.current);
      return;
    }

    if (t === "cursor") {
      placingNodeKindRef.current = null;
      oneShotRef.current = { active: false, kind: null, sourceCellId: null };
      graph.cleanSelection();
      if (nodeClickHandlerRef.current)
        graph.off("node:click", nodeClickHandlerRef.current);
    }
  };

  const handleClassDragStart = (e: React.DragEvent) => {
    if (readonly) return;
    if (e.dataTransfer) {
      e.dataTransfer.setData("x6", "uml-class");
      e.dataTransfer.setData("text/plain", "uml-class");
      e.dataTransfer.effectAllowed = "copyMove";
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const toolbarDisabled = !graphReady || loading;

  // 🔐 Solo el owner comparte; en público (readonly) no habrá ownerId
  const canShare = !!(!readonly && user && ownerId && user.id === ownerId);

  // Funciones para el asistente de IA
  const handleAddClassFromAI = (className: string, attributes: string[], methods: string[]) => {
    if (!graphRef.current) return;
    
    // Crear un nodo en el centro del canvas
    const centerX = 400;
    const centerY = 300;
    
    const node = graphRef.current.addNode({
      shape: 'uml-class',
      x: centerX,
      y: centerY,
      data: {
        name: className,
        attributes: attributes,
        methods: methods
      }
    });
    
    // Ajustar el tamaño del nodo
    resizeUmlClass(node);
  };

  const handleAddRelationFromAI = (from: string, to: string, type: string) => {
    if (!graphRef.current) return;
    
    const nodes = graphRef.current.getNodes();
    const sourceNode = nodes.find((n: any) => n.getData()?.name === from);
    const targetNode = nodes.find((n: any) => n.getData()?.name === to);
    
    if (sourceNode && targetNode) {
      // Mapear tipos de relación a estilos de X6
      const edgeStyle = EDGE_STYLE[type as EdgeKind] || EDGE_STYLE.assoc;
      
      graphRef.current.addEdge({
        source: sourceNode.id,
        target: targetNode.id,
        data: {
          name: '',
          multSource: '',
          multTarget: ''
        },
        ...edgeStyle
      });
    }
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar: puedes ocultarla en lectura si lo prefieres */}
      <Sidebar
        tool={tool}
        onToolClick={onToolClick}
        onBack={() => navigate("/app")}
        onSave={readonly ? undefined : save}
        graph={graphRef.current}
        onClassDragStart={handleClassDragStart}
      />

      <div className="relative flex-1">
        {/* Contenedor del Graph */}
        <div ref={containerRef} className="absolute inset-0" />

        {/* Banner de solo lectura */}
        {readonly && (
          <div className="absolute top-3 left-3 z-20 rounded bg-amber-50 border border-amber-200 px-3 py-1 text-amber-700 text-sm">
            Vista pública (solo lectura)
          </div>
        )}

        {/* Controles (zoom, cursor, center, export, compartir) + Minimap */}
        <DiagramControls
          graph={graphRef.current}
          tool={tool}
          onToolClick={onToolClick}
          onSave={readonly ? undefined : save}
          disabled={toolbarDisabled}
          exportName={`diagram-${id ?? "unsaved"}`}
          canShare={canShare}
          onGetShareLink={
            canShare && !readonly
              ? async () => {
                  const { data } = await api.post(`/projects/${id}/share`, {
                    role: "VIEWER",
                  });
                  return `${window.location.origin}/project/${id}?share=${data.token}`;
                }
              : async () => window.location.href // visitantes copian la URL actual
          }
        />

        {/* Overlays */}
        {loading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/40">
            <div className="rounded-xl bg-white px-4 py-2 text-sm text-gray-700 shadow">
              Cargando diagrama…
            </div>
          </div>
        )}
        {error && (
          <div className="absolute left-4 top-4 z-20 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 shadow">
            {error}
          </div>
        )}

        {/* Menú contextual */}
        {!readonly && menu.visible && menu.id && (
          <div
            className="fixed z-50 w-44 rounded-lg border border-gray-200 bg-white/95 shadow-xl backdrop-blur"
            style={{ top: menu.y, left: menu.x }}
            onMouseLeave={() =>
              setMenu((m) => ({ ...m, visible: false, kind: null, id: null }))
            }
          >
            <button
              className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
              onClick={handleEdit}
            >
              Editar {menu.kind === "edge" ? "relación" : "clase"}
            </button>
            <button
              className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              onClick={handleDelete}
            >
              Eliminar {menu.kind === "edge" ? "relación" : "clase"}
            </button>
          </div>
        )}

        {/* Modal de edición */}
        {!readonly && editorOpen && (
          <ClassEditorModal
            open={editorOpen}
            mode={editingEdgeId ? "edge" : "class"}
            initialValues={
              editingEdgeId
                ? (initialRelForm as any)
                : (initialClassForm as any)
            }
            size="lg"
            onClose={() => setEditorOpen(false)}
            onSubmit={(values: any) => {
              const graph = graphRef.current!;
              if (editingEdgeId) {
                const edge = graph.getCellById(editingEdgeId) as any;
                if (edge) writeFormToEdge(edge, values as RelationFormValues);
                setEditingEdgeId(null);
              } else if (editingNodeId) {
                const node = graph.getCellById(editingNodeId) as any;
                if (node) writeFormToNode(node, values as ClassFormValues);
                setEditingNodeId(null);
              }
              setEditorOpen(false);
            }}
          />
        )}
      </div>
      
      {/* Asistente de IA */}
      <AIAssistant 
        graph={graphRef.current}
        onAddClass={handleAddClassFromAI}
        onAddRelation={handleAddRelationFromAI}
      />
      
      {/* Toast notifications */}
      <Toaster 
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4ade80',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
}
