// src/uml/ui/DiagramControls.tsx
import { useEffect, useRef, useState } from "react";
import type { Graph } from "@antv/x6";
import { MiniMap } from "@antv/x6-plugin-minimap";
import { Export } from "@antv/x6-plugin-export";
import type { Tool } from "./Sidebar";
import { IconCenter, IconCursor, IconZoomIn, IconZoomOut } from "../icons";
import { Save, Share2 } from "lucide-react";
import toast from "react-hot-toast";

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
  const [sharing, setSharing] = useState(false);

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
    
    try {
      // Verificar que hay contenido
      const nodes = graph.getNodes();
      if (nodes.length === 0) {
        toast.error("No hay contenido para exportar");
        return;
      }
      
      // Guardar el estado actual
      const currentZoom = graph.zoom();
      const currentTranslate = graph.translate();
      
      try {
        // Ajustar la vista para mostrar todo el contenido
        graph.zoomToFit({ padding: 20 });
        
        // Esperar para el renderizado
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Método alternativo: capturar el canvas directamente
        const container = graph.container as HTMLElement;
        const canvas = container.querySelector('canvas') as HTMLCanvasElement;
        
        if (canvas) {
          // Crear un canvas temporal con las dimensiones deseadas
          const tempCanvas = document.createElement('canvas');
          const ctx = tempCanvas.getContext('2d');
          
          if (ctx) {
            // Dimensiones del PNG
            tempCanvas.width = 1200;
            tempCanvas.height = 800;
            
            // Fondo blanco
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Dibujar el canvas original escalado
            ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
            
            // Convertir a PNG y descargar
            tempCanvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `${exportName}.png`;
                link.href = url;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                toast.success("PNG exportado correctamente ✅");
              } else {
                toast.error("Error al generar el PNG");
              }
            }, 'image/png', 1);
          } else {
            toast.error("Error al crear el contexto del canvas");
          }
        } else {
          // Fallback: usar el método original de X6
          if (!graph.getPlugin('export')) {
            graph.use(new Export());
          }
          
          graph.toPNG((dataURL: string) => {
            const link = document.createElement('a');
            link.download = `${exportName}.png`;
            link.href = dataURL;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast.success("PNG exportado correctamente ✅");
          }, {
            width: 1200,
            height: 800,
            backgroundColor: '#ffffff',
            quality: 1
          });
        }
      } finally {
        // Restaurar el estado original
        graph.zoom(currentZoom);
        graph.translate(currentTranslate.tx, currentTranslate.ty);
      }
    } catch (error) {
      console.error("Error al exportar PNG:", error);
      toast.error("Error al exportar el diagrama");
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    try {
      await onSave();
      toast.success("Diagrama guardado correctamente");
    } catch (e) {
      console.error("Error al guardar", e);
      toast.error("Error al guardar");
    }
  };

  const handleShare = async () => {
    // No deshabilitamos el botón; solo prevenimos doble-click rápido.
    if (sharing) return;

    if (!onGetShareLink) {
      toast.error("No hay handler para obtener el enlace de compartir.");
      return;
    }
    try {
      setSharing(true);
      const url = await onGetShareLink();
      if (typeof url === "string" && url.length > 0) {
        // Intento con Clipboard API
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Enlace copiado al portapapeles 🔗");
        } catch {
          // Fallback: prompt
          window.prompt("Copia el enlace:", url);
          toast.success("Enlace generado. Cópialo desde el cuadro.");
        }
      } else {
        toast.error("No se pudo generar el enlace de compartir.");
      }
    } catch (err) {
      console.error("Compartir enlace error:", err);
      toast.error("Error al generar el enlace de compartir.");
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
    </>
  );
}
