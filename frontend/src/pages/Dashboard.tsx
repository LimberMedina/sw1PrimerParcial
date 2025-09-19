import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../state/AuthContext";

// --- Types ---
type Project = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  role?: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER" | string;
};

// --- Small UI helpers ---
function IconPlus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M6 12h12" />
    </svg>
  );
}
function IconFolder(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7h5l2 3h11v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
      />
    </svg>
  );
}
function IconSearch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-4.35-4.35M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"
      />
    </svg>
  );
}
function IconSparkles(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 3l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4zm14 8l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"
      />
    </svg>
  );
}

// --- Create Project Modal ---
function CreateProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (p: Project) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Ponle un nombre al proyecto");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Endpoint sugerido: POST /api/projects { name, description }
      const { data } = await api.post<Project>("/projects", {
        name,
        description,
      });
      onCreated(data);
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || "No se pudo crear";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-xl font-semibold">Nuevo proyecto</h3>
        <p className="mt-1 text-sm text-gray-500">
          Crea un canvas para tu diagrama UML colaborativo.
        </p>

        <form onSubmit={handleCreate} className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Nombre</label>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ej. Sistema de Ventas"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">
              Descripción (opcional)
            </label>
            <textarea
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3}
              placeholder="Breve descripción…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-gray-600 hover:bg-gray-100"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              disabled={loading}
              className="rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white shadow hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? "Creando…" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Project Card ---
function ProjectCard({
  p,
  onOpen,
}: {
  p: Project;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="group relative rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ring-1 ring-transparent transition hover:shadow-md hover:ring-indigo-100">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
            <IconFolder className="h-5 w-5" />
          </div>
          <div>
            <h4 className="line-clamp-1 text-base font-semibold text-gray-900">
              {p.name}
            </h4>
            <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">
              {p.description || "Sin descripción"}
            </p>
          </div>
        </div>
        {p.role && (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
            {p.role}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <span>Creado: {new Date(p.createdAt).toLocaleDateString()}</span>
        <button
          onClick={() => onOpen(p.id)}
          className="rounded-lg px-3 py-1.5 text-indigo-600 hover:bg-indigo-50"
        >
          Abrir
        </button>
      </div>
    </div>
  );
}

// --- Empty State ---
function EmptyProjects({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 p-10 text-center">
      <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
        <IconSparkles className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">Aún no tienes proyectos</h3>
      <p className="mt-1 max-w-md text-sm text-gray-500">
        Crea tu primer proyecto para empezar a diagramar clases UML y colaborar
        en tiempo real.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white shadow hover:bg-indigo-700"
      >
        <IconPlus className="h-4 w-4" />
        Nuevo proyecto
      </button>
    </div>
  );
}

// --- Main Dashboard ---
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    if (!projects) return [] as Project[];
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
    );
  }, [projects, query]);

  async function loadProjects() {
    setError(null);
    try {
      // Endpoint sugerido: GET /api/projects (retorna proyectos del usuario)
      const { data } = await api.get<Project[]>("/projects");
      setProjects(data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "No se pudieron cargar los proyectos";
      setError(msg);
      setProjects([]);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  const openProject = (id: string) => {
    navigate(`/app/projects/${id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-600 p-2 text-white shadow">
              <IconFolder className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">
                Diagramador UML
              </h1>
              <p className="text-xs text-gray-500">
                Bienvenido{user?.name ? `, ${user.name}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-700"
            >
              <IconPlus className="h-4 w-4" />
              Nuevo proyecto
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Quick actions & Search */}
        <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              <IconPlus className="h-4 w-4" />
              Iniciar proyecto
            </button>
            <button className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Importar modelo
            </button>
          </div>

          <div className="relative w-full md:w-80">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full rounded-2xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Buscar proyecto…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </section>

        {/* Projects list */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Tus proyectos
            </h2>
            <button
              onClick={loadProjects}
              className="text-sm text-indigo-600 hover:underline"
            >
              Actualizar
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {projects === null ? (
            // Skeletons
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-2xl bg-white shadow-sm"
                >
                  <div className="h-full w-full rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyProjects onCreate={() => setCreating(true)} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <ProjectCard key={p.id} p={p} onOpen={openProject} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Modal */}
      <CreateProjectModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(p) => {
          setProjects((prev) => (prev ? [p, ...prev] : [p]));
          setCreating(false);
          openProject(p.id);
        }}
      />
    </div>
  );
}
