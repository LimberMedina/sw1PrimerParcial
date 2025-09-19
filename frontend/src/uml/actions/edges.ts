import { Graph } from "@antv/x6";

export type EdgeShape = "assoc" | "nav" | "inherit" | "dep" | "comp" | "aggr";

const COLORS = {
  indigo: "#6366f1",
  grayText: "#475569",
  black: "#000000",
  white: "#ffffff",
};

// Para evitar dependencias de tipos que cambian entre versiones de X6
type EdgeProps = any;

function cardinalityLabel(text: string, distance: number) {
  return {
    position: { distance }, // 0..1 relativo al largo de la arista
    attrs: {
      label: {
        text,
        fill: COLORS.grayText,
        fontFamily:
          "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: 11,
      },
    },
  };
}

/** Devuelve el "estilo" que queremos aplicar al edge resultante */
function buildEdgeConfig(kind: EdgeShape): EdgeProps {
  const base: EdgeProps = {
    connector: { name: "rounded" },
    router: { name: "manhattan" },
    attrs: {
      line: {
        stroke: COLORS.indigo,
        strokeWidth: 1.5,
        targetMarker: { name: "none" },
      },
    },
    labels: [] as any[],
  };

  switch (kind) {
    case "assoc":
      return {
        ...base,
        labels: [cardinalityLabel("1", 0.1), cardinalityLabel("1", 0.9)],
      };

    case "nav":
      return {
        ...base,
        attrs: {
          line: {
            ...base.attrs.line,
            targetMarker: { name: "block", width: 10, height: 10 }, // flecha sólida
          },
        },
        labels: [cardinalityLabel("1", 0.1), cardinalityLabel("1", 0.9)],
      };

    case "inherit":
      return {
        ...base,
        attrs: {
          line: {
            stroke: COLORS.black,
            strokeWidth: 1,
            targetMarker: {
              name: "block",
              width: 18,
              height: 12,
              fill: COLORS.white, // hueco
              stroke: COLORS.black,
            },
          },
        },
      };

    case "dep":
      return {
        ...base,
        attrs: {
          line: {
            stroke: COLORS.black,
            strokeWidth: 1,
            strokeDasharray: "5 5",
            targetMarker: {
              name: "block",
              width: 18,
              height: 12,
              fill: COLORS.white,
              stroke: COLORS.black,
            },
          },
        },
      };

    case "comp":
      return {
        ...base,
        attrs: {
          line: {
            stroke: COLORS.black,
            strokeWidth: 1,
            targetMarker: {
              name: "path",
              d: "M 0 0 L 8 6 L 0 12 L -8 6 z", // rombo sólido
              fill: COLORS.black,
              stroke: COLORS.black,
            },
          },
        },
      };

    case "aggr":
      return {
        ...base,
        attrs: {
          line: {
            stroke: COLORS.black,
            strokeWidth: 1,
            targetMarker: {
              name: "path",
              d: "M 0 0 L 8 6 L 0 12 L -8 6 z", // rombo hueco
              fill: COLORS.white,
              stroke: COLORS.black,
            },
          },
        },
      };
  }
}

/** Aplica el estilo al edge ya creado/conectado */
function applyEdgeStyle(edge: any, cfg: EdgeProps) {
  if (!edge) return;

  // Conector y router
  if (cfg.connector) edge.setConnector(cfg.connector);
  if (cfg.router) edge.setRouter(cfg.router);

  // Atributos de línea (stroke, markers, dash, etc.)
  if (cfg.attrs?.line) {
    edge.setAttrs({ line: cfg.attrs.line });
  }

  // Labels (cardinalidades)
  if (Array.isArray(cfg.labels)) {
    edge.setLabels(cfg.labels);
  }
}

/**
 * Modo “crear relación” compatible con X6 sin `graph.setConnecting`.
 * - El usuario dibuja una arista normal.
 * - Al conectarse, forzamos el estilo según `kind`.
 * - Salimos del modo (y llamamos onFinish).
 */
export function startEdgeMode(
  graph: Graph,
  kind: EdgeShape,
  onFinish?: () => void
) {
  if (!graph) return;

  const cfg = buildEdgeConfig(kind);

  const finish = () => {
    graph.off("blank:click", onBlankClick);
    graph.off("edge:connected", onConnected);
    if (onFinish) onFinish();
  };

  const onBlankClick = () => finish();

  const onConnected = ({ edge }: { edge: any }) => {
    applyEdgeStyle(edge, cfg);
    finish();
  };

  // Nos suscribimos una sola vez para el siguiente edge que el usuario conecte
  graph.on("edge:connected", onConnected);
  graph.on("blank:click", onBlankClick);
}
