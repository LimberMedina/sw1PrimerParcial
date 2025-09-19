// src/uml/ui/DiagramControls.tsx
import { useEffect, useRef, useState } from "react";
import type { Graph } from "@antv/x6";
import { MiniMap } from "@antv/x6-plugin-minimap";
import { Export } from "@antv/x6-plugin-export";
import type { Tool } from "./Sidebar";
import { IconCenter, IconCursor, IconZoomIn, IconZoomOut } from "../icons";
import { Save, Share2 } from "lucide-react";

type Props = {
  graph: Graph | null;
  tool: Tool;
  onToolClick: (t: Tool) => void;
  onSave?: () => Promise<void>;
  disabled?: boolean; // seguirá aplicando a zoom/export/guardar, NO a compartir
  exportName?: string;
  /** Debe devolver el enlace completo (p. ej., https://app.com/project/123?share=TOKEN) */
  onGetShareLink?: () => Promise<string>;
  /** Ya no condiciona el botón de compartir; mantenido por compatibilidad */
  canShare?: boolean;
};

export default function DiagramControls({
  graph,
  tool,
  onToolClick,
  onSave,
  disabled = false,
  exportName = "diagram",
  onGetShareLink,
}: Props) {
  const minimapRef = useRef<HTMLDivElement | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [sharing, setSharing] = useState(false);

  // Toast helper
  const showToast = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Plugins
  useEffect(() => {
    if (!graph) return;
    if (!(graph as any).__exportInstalled) {
      graph.use(new Export());
      (graph as any).__exportInstalled = true;
    }
  }, [graph]);

  useEffect(() => {
    if (!graph || !minimapRef.current) return;
    if (!(graph as any).__minimapInstalled) {
      graph.use(
        new MiniMap({
          container: minimapRef.current,
          width: 200,
          height: 140,
          padding: 8,
        })
      );
      (graph as any).__minimapInstalled = true;
    }
  }, [graph]);

  // Controles
  const zoomIn = () => graph?.zoom(0.1);
  const zoomOut = () => graph?.zoom(-0.1);
  const center = () => graph?.centerContent();
  const exportPNG = async () => {
    if (!graph) return;
    await graph.exportPNG(`${exportName}.png`);
    showToast("PNG exportado correctamente ✅");
  };

  const handleSave = async () => {
    if (!onSave) return;
    try {
      await onSave();
      showToast("Diagrama guardado correctamente", "success");
    } catch (e) {
      console.error("Error al guardar", e);
      showToast("Error al guardar", "error");
    }
  };

  const handleShare = async () => {
    // No deshabilitamos el botón; solo prevenimos doble-click rápido.
    if (sharing) return;

    if (!onGetShareLink) {
      showToast("No hay handler para obtener el enlace de compartir.", "error");
      return;
    }
    try {
      setSharing(true);
      const url = await onGetShareLink();
      if (typeof url === "string" && url.length > 0) {
        // Intento con Clipboard API
        try {
          await navigator.clipboard.writeText(url);
          showToast("Enlace copiado al portapapeles 🔗", "success");
        } catch {
          // Fallback: prompt
          window.prompt("Copia el enlace:", url);
          showToast("Enlace generado. Cópialo desde el cuadro.", "success");
        }
      } else {
        showToast("No se pudo generar el enlace de compartir.", "error");
      }
    } catch (err) {
      console.error("Compartir enlace error:", err);
      showToast("Error al generar el enlace de compartir.", "error");
    } finally {
      setSharing(false);
    }
  };

  // Solo para los demás botones (zoom/export/guardar)
  const toolbarDisabled = disabled || !graph;

  return (
    <>
      {/* Barra superior */}
      <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-2xl border border-gray-200 bg-white/90 px-2 py-1 shadow backdrop-blur">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToolClick("cursor")}
            disabled={toolbarDisabled}
            className={
              "rounded-xl px-3 py-2 text-sm " +
              (tool === "cursor"
                ? "bg-gray-100 text-gray-900"
                : "text-gray-700 hover:bg-gray-50") +
              (toolbarDisabled ? " opacity-50 cursor-not-allowed" : "")
            }
            title="Cursor"
          >
            <IconCursor className="mr-1 inline h-4 w-4" />
            Cursor
          </button>

          <span className="mx-1 h-6 w-px bg-gray-200" />

          <button
            onClick={zoomOut}
            disabled={toolbarDisabled}
            title="Zoom out"
            className={
              "rounded-xl px-2 py-2 text-gray-700 hover:bg-gray-50" +
              (toolbarDisabled ? " opacity-50 cursor-not-allowed" : "")
            }
          >
            <IconZoomOut className="h-5 w-5" />
          </button>
          <button
            onClick={zoomIn}
            disabled={toolbarDisabled}
            title="Zoom in"
            className={
              "rounded-xl px-2 py-2 text-gray-700 hover:bg-gray-50" +
              (toolbarDisabled ? " opacity-50 cursor-not-allowed" : "")
            }
          >
            <IconZoomIn className="h-5 w-5" />
          </button>
          <button
            onClick={center}
            disabled={toolbarDisabled}
            title="Center"
            className={
              "rounded-xl px-2 py-2 text-gray-700 hover:bg-gray-50" +
              (toolbarDisabled ? " opacity-50 cursor-not-allowed" : "")
            }
          >
            <IconCenter className="h-5 w-5" />
          </button>

          {/* Guardar */}
          <button
            onClick={handleSave}
            disabled={toolbarDisabled}
            title="Guardar diagrama"
            className={
              "rounded-xl px-2 py-2 text-gray-700 hover:bg-gray-50" +
              (toolbarDisabled ? " opacity-50 cursor-not-allowed" : "")
            }
          >
            <Save className="h-5 w-5" />
          </button>

          <span className="mx-1 h-6 w-px bg-gray-200" />

          {/* Export PNG */}
          <button
            onClick={exportPNG}
            disabled={toolbarDisabled}
            title="Export PNG"
            className={
              "rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50" +
              (toolbarDisabled ? " opacity-50 cursor-not-allowed" : "")
            }
          >
            Export PNG
          </button>

          {/* Compartir (SIEMPRE habilitado) */}
          <span className="mx-1 h-6 w-px bg-gray-200" />
          <button
            onClick={handleShare}
            title="Compartir enlace del proyecto"
            className={
              "rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            }
          >
            <Share2 className="h-5 w-5" />
            {sharing ? "Generando..." : "Compartir"}
          </button>
        </div>
      </div>

      {/* Minimap */}
      <div
        ref={minimapRef}
        className="pointer-events-auto absolute bottom-4 right-4 z-10 rounded-xl border border-gray-200 bg-white/90 p-2 shadow"
      />

      {/* Toast */}
      {toast && (
        <div
          className={
            "fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 shadow-lg text-white transition-all duration-300 " +
            (toast.type === "success" ? "bg-green-600" : "bg-red-600")
          }
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
