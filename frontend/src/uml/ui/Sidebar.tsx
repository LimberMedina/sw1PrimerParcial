import React from "react";
import { IconBack, IconDownload } from "../icons";

export type Tool =
  | "cursor"
  | "class"
  | "interface"
  | "abstract"
  // Relaciones:
  | "assoc" // Asociación
  | "nav" // Asociación directa (flecha)
  | "aggr" // Agregación (rombo vacío)
  | "comp" // Composición (rombo sólido)
  | "dep" // Dependencia (punteada + flecha)
  | "inherit"; // Generalización (triángulo vacío)

type Props = {
  tool: Tool;
  onToolClick: (t: Tool) => void;
  onBack: () => void;
  onSave: () => void;

  // Drag para crear clase
  onClassDragStart?: (e: React.DragEvent) => void;
};

function IconAssociation({ className = "h-4 w-4" }: { className?: string }) {
  // Línea en L
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 18V6M4 6H16" />
    </svg>
  );
}

function IconDirectedAssociation({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  // Línea con flecha al final
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 12H18" />
      <path d="M18 12l-4-3m4 3l-4 3" fill="currentColor" />
    </svg>
  );
}

function IconAggregation({ className = "h-4 w-4" }: { className?: string }) {
  // Rombo vacío
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 12l4-4 4 4-4 4-4-4z" />
      <path d="M14 12H20" />
    </svg>
  );
}

function IconComposition({ className = "h-4 w-4" }: { className?: string }) {
  // Rombo sólido
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 12l4-4 4 4-4 4-4-4z" />
      <path d="M14 12H20" fill="none" />
    </svg>
  );
}

function IconDependency({ className = "h-4 w-4" }: { className?: string }) {
  // Línea punteada + flecha
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 12h10" strokeDasharray="4 3" />
      <path d="M18 12l-4-3m4 3l-4 3" />
    </svg>
  );
}

function IconGeneralization({ className = "h-4 w-4" }: { className?: string }) {
  // Triángulo vacío (hollow)
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18 12l-6-4-6 4 6 4 6-4z" fill="white" />
      <path d="M6 12H4" />
    </svg>
  );
}

export default function Sidebar({
  tool,
  onToolClick,
  onBack,
  onSave,
  onClassDragStart,
}: Props) {
  const relationButtons: Array<{
    key: Tool;
    label: string;
    Icon: React.FC<{ className?: string }>;
  }> = [
    { key: "assoc", label: "Asociación", Icon: IconAssociation },
    { key: "nav", label: "Asociación directa", Icon: IconDirectedAssociation },
    { key: "aggr", label: "Agregación", Icon: IconAggregation },
    { key: "comp", label: "Composición", Icon: IconComposition },
    { key: "dep", label: "Dependencia", Icon: IconDependency },
    { key: "inherit", label: "Generalización", Icon: IconGeneralization },
  ];

  return (
    <aside className="w-80 border-r border-gray-200 bg-white p-6 hidden md:flex md:flex-col">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-xl p-2 text-gray-600 hover:bg-gray-100"
        >
          <IconBack className="h-5 w-5" />
        </button>
        <div>
          <div className="text-xs font-bold text-gray-400">UML</div>
          <div className="text-base font-semibold leading-tight text-gray-900">
            CLASS DIAGRAM
          </div>
          <div className="text-sm font-semibold text-indigo-600">EDITOR</div>
        </div>
      </div>

      <div className="mt-2 flex-1 space-y-6 overflow-y-auto pr-2">
        {/* Elements */}
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <span className="inline-block h-4 w-4 rounded border border-gray-300" />
            Elementos
          </h3>
          <div className="space-y-2">
            {/* Botón 'Clase' con click-to-place y handle interno para drag */}
            <button
              onClick={() => onToolClick("class")}
              aria-pressed={tool === "class"}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-medium ${
                tool === "class"
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
              title="Clic para colocar en el lienzo • Arrastra el handle para soltar en el lienzo"
            >
              <div className="flex items-center justify-between">
                <span>Clase (clic o arrastrar)</span>
                <span
                  role="button"
                  aria-label="Arrastrar Clase"
                  draggable
                  onDragStart={onClassDragStart}
                  className="cursor-grab select-none rounded border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                  title="Arrastra desde aquí"
                >
                  ⋮⋮
                </span>
              </div>
            </button>

            <button
              onClick={() => onToolClick("interface")}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-medium hover:bg-gray-50 ${
                tool === "interface"
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-gray-200"
              }`}
            >
              Interfaz
            </button>
            <button
              onClick={() => onToolClick("abstract")}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-medium hover:bg-gray-50 ${
                tool === "abstract"
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-gray-200"
              }`}
            >
              Clase abstracta
            </button>
          </div>
        </section>

        {/* Relationships */}
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <span className="inline-block h-4 w-4 border-b-2 border-gray-400" />
            Relaciones
          </h3>
          <div className="space-y-2">
            {relationButtons.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => onToolClick(key)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-medium hover:bg-gray-50 ${
                  tool === key
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 text-gray-800"
                }`}
              >
                <span className="flex items-center gap-2">
                  {/* Icono en el mismo color que las clases */}
                  <Icon className="h-4 w-4 text-indigo-600" />
                  <span>{label}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Save / Export */}
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <span className="inline-block h-4 w-4 border-2 border-indigo-400" />
            Code Generation
          </h3>
          <button
            onClick={onSave}
            className="w-full rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700 flex items-center gap-2"
          >
            <IconDownload className="h-4 w-4" /> Generate
          </button>
        </section>
      </div>
    </aside>
  );
}
