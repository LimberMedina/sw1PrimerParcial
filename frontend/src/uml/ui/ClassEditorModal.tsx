// src/uml/ui/ClassEditorModal.tsx
import React, { useEffect, useState } from "react";

export type ClassFormValues = {
  name: string;
  attributes: string[]; // 1 por línea
  methods: string[]; // 1 por línea
};

export type RelationFormValues = {
  name: string;
  multSource: string; // multiplicidad en el extremo de origen (p. ej., "1..*", "0..1")
  multTarget: string; // multiplicidad en el extremo de destino
};

type Props = {
  open: boolean;
  mode?: "class" | "edge";
  initialValues: ClassFormValues | RelationFormValues;
  size?: "md" | "lg" | "xl"; // "lg" ~ media pantalla
  onClose: () => void;
  onSubmit: (values: ClassFormValues | RelationFormValues) => void;
};

const sizeToMaxWidth: Record<NonNullable<Props["size"]>, string> = {
  md: "max-w-2xl",
  lg: "max-w-3xl", // media pantalla aprox
  xl: "max-w-5xl",
};

export default function ClassEditorModal({
  open,
  mode = "class",
  initialValues,
  size = "lg",
  onClose,
  onSubmit,
}: Props) {
  // ---- Estado para CLASE ----
  const [name, setName] = useState(
    mode === "class"
      ? (initialValues as ClassFormValues).name
      : (initialValues as RelationFormValues).name
  );
  const [attrsText, setAttrsText] = useState(
    mode === "class"
      ? (initialValues as ClassFormValues).attributes.join("\n")
      : ""
  );
  const [methodsText, setMethodsText] = useState(
    mode === "class"
      ? (initialValues as ClassFormValues).methods.join("\n")
      : ""
  );

  // ---- Estado para RELACIÓN ----
  const [relName, setRelName] = useState(
    mode === "edge" ? (initialValues as RelationFormValues).name : ""
  );
  const [multSource, setMultSource] = useState(
    mode === "edge" ? (initialValues as RelationFormValues).multSource : ""
  );
  const [multTarget, setMultTarget] = useState(
    mode === "edge" ? (initialValues as RelationFormValues).multTarget : ""
  );

  // Si cambian los initialValues desde afuera, sincronizar
  useEffect(() => {
    if (mode === "class") {
      const iv = initialValues as ClassFormValues;
      setName(iv.name);
      setAttrsText(iv.attributes.join("\n"));
      setMethodsText(iv.methods.join("\n"));
    } else {
      const iv = initialValues as RelationFormValues;
      setRelName(iv.name ?? "");
      setMultSource(iv.multSource ?? "");
      setMultTarget(iv.multTarget ?? "");
    }
  }, [initialValues, mode]);

  if (!open) return null;

  function toLines(s: string): string[] {
    return s
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (mode === "class") {
      onSubmit({
        name: (name || "").trim() || "Class",
        attributes: toLines(attrsText),
        methods: toLines(methodsText),
      } as ClassFormValues);
      return;
    }

    // mode === "edge"
    onSubmit({
      name: (relName || "").trim(),
      multSource: (multSource || "").trim(),
      multTarget: (multTarget || "").trim(),
    } as RelationFormValues);
  }

  function stop(e: React.MouseEvent) {
    e.stopPropagation();
  }

  const isClass = mode === "class";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className={`w-full ${sizeToMaxWidth[size]} h-[70vh] rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden`}
        onClick={stop}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-900">
            {isClass ? "Editar clase" : "Editar relación"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          className="h-[calc(70vh-48px-64px)] overflow-auto px-5 py-4"
        >
          {isClass ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nombre de la clase
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-400"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="p. ej. Usuario"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Atributos (uno por línea)
                </label>
                <textarea
                  className="mt-1 h-36 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-400"
                  value={attrsText}
                  onChange={(e) => setAttrsText(e.target.value)}
                  placeholder={`id: int\nnombre: string\nemail: string`}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Se mostrarán en el bloque de atributos de la clase.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Métodos (uno por línea)
                </label>
                <textarea
                  className="mt-1 h-36 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-400"
                  value={methodsText}
                  onChange={(e) => setMethodsText(e.target.value)}
                  placeholder={`login(email, pass): bool\ncambiarClave(nueva: string): void`}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Se mostrarán en el bloque de métodos de la clase.
                </p>
              </div>
            </div>
          ) : (
            // ===== Formulario de RELACIÓN =====
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nombre de la relación
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-400"
                  value={relName}
                  onChange={(e) => setRelName(e.target.value)}
                  placeholder="p. ej. perteneceA"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Se mostrará encima y al centro de la línea.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Multiplicidad (origen)
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-400"
                    value={multSource}
                    onChange={(e) => setMultSource(e.target.value)}
                    placeholder="p. ej. 1..*, 0..1, 1..1"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Aparecerá debajo del extremo de origen.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Multiplicidad (destino)
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-400"
                    value={multTarget}
                    onChange={(e) => setMultTarget(e.target.value)}
                    placeholder="p. ej. 1..*, 0..1, 1..1"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Aparecerá debajo del extremo de destino.
                  </p>
                </div>
              </div>

              <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-600">
                Sugerencias: <code>1..1</code>, <code>0..1</code>,{" "}
                <code>1..*</code>, <code>0..*</code>, <code>*</code>.
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-800"
            >
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
