"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useAuthStore } from "@/lib/store";
import {
  fetchPlatformStatus,
  fetchCloudflareConfig,
  setupTunnel,
  fetchProjects,
  createProject,
  deleteProject,
  fetchAuditLogs,
} from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type CloudflareForm = { apiToken: string; domain: string; subdomain: string };
type ProjectForm = {
  name: string;
  description: string;
  repository_url: string;
};
type Tab = "overview" | "tunnel" | "projects" | "logs";

interface ServiceInfo {
  name: string;
  status: string;
  port?: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, token, username, logout } = useAuthStore();

  const [tab, setTab] = useState<Tab>("overview");
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [hasTunnel, setHasTunnel] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [tunnelError, setTunnelError] = useState("");
  const [tunnelSuccess, setTunnelSuccess] = useState("");
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [projError, setProjError] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);

  const cfForm = useForm<CloudflareForm>();
  const projForm = useForm<ProjectForm>();

  /* ---------- data loaders ---------- */
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { data: ps } = await fetchPlatformStatus();
      setServices(ps.services ?? []);
      setHasTunnel(ps.has_tunnel);
      if (ps.public_url) setPublicUrl(ps.public_url);
    } catch {}
    try {
      const { data: cf } = await fetchCloudflareConfig(token);
      setHasTunnel(true);
      if (cf.subdomain && cf.domain)
        setPublicUrl(`https://${cf.subdomain}.${cf.domain}`);
    } catch {}
    try {
      const { data } = await fetchProjects(token);
      setProjects(data);
    } catch {}
    try {
      const { data } = await fetchAuditLogs(token);
      setLogs(data);
    } catch {}
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/auth/login");
      return;
    }
    load();
  }, [isAuthenticated, router, load]);

  /* ---------- handlers ---------- */
  const handleTunnel = async (d: CloudflareForm) => {
    if (!token) return;
    setTunnelLoading(true);
    setTunnelError("");
    setTunnelSuccess("");
    try {
      const { data } = await setupTunnel(
        token,
        d.apiToken,
        d.domain,
        d.subdomain,
      );
      setTunnelSuccess(`Tunnel live at ${data.public_url} — redirecting…`);
      setPublicUrl(data.public_url);
      setHasTunnel(true);
      setTimeout(() => (window.location.href = data.public_url), 3000);
    } catch (err: any) {
      setTunnelError(err.response?.data?.detail || "Tunnel setup failed");
    } finally {
      setTunnelLoading(false);
    }
  };

  const handleNewProject = async (d: ProjectForm) => {
    if (!token) return;
    setProjError("");
    try {
      await createProject(token, d);
      projForm.reset();
      setShowNewProject(false);
      const { data } = await fetchProjects(token);
      setProjects(data);
    } catch (err: any) {
      setProjError(err.response?.data?.detail || "Failed to create project");
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!token) return;
    await deleteProject(token, id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  if (!isAuthenticated) return null;

  /* ---------- UI ---------- */
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "tunnel", label: "Cloudflare Tunnel" },
    { key: "projects", label: "Projects" },
    { key: "logs", label: "Audit Logs" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ---- NAV ---- */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">D</span>
            </div>
            <span className="font-bold text-xl text-gray-900">DeployX</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:inline">
              {username}
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* ---- ONBOARDING BANNER ---- */}
      {!hasTunnel && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 text-sm text-amber-800">
            <span className="flex-shrink-0 font-semibold">Setup required:</span>
            <span>
              Configure a Cloudflare Tunnel to expose your platform publicly
              over HTTPS.
            </span>
            <button
              onClick={() => setTab("tunnel")}
              className="ml-auto px-3 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 font-medium transition"
            >
              Configure now
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        {/* ---- TABS ---- */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8 w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t.key
                  ? "bg-white shadow text-blue-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ===================== OVERVIEW ===================== */}
        {tab === "overview" && (
          <div className="space-y-8">
            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <Card
                title="Services Running"
                value={String(
                  services.filter((s) => s.status === "healthy").length,
                )}
                color="blue"
              />
              <Card
                title="Projects"
                value={String(projects.length)}
                color="indigo"
              />
              <Card
                title="Tunnel"
                value={hasTunnel ? "Active" : "Not set"}
                color={hasTunnel ? "green" : "amber"}
              />
              <Card
                title="Audit Events"
                value={String(logs.length)}
                color="purple"
              />
            </div>

            {/* Service status */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Service Health
              </h3>
              <div className="divide-y divide-gray-100">
                {services.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between py-3"
                  >
                    <span className="text-sm text-gray-700">{s.name}</span>
                    <span className="flex items-center gap-2 text-sm">
                      {s.port && (
                        <span className="text-gray-400">:{s.port}</span>
                      )}
                      <StatusDot ok={s.status === "healthy"} />
                      <span
                        className={
                          s.status === "healthy"
                            ? "text-green-700"
                            : "text-amber-600"
                        }
                      >
                        {s.status}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Public URL */}
            {publicUrl && (
              <section className="bg-green-50 border border-green-200 rounded-2xl p-6">
                <h3 className="font-semibold text-green-900 mb-1">
                  Public URL
                </h3>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-green-700 underline break-all"
                >
                  {publicUrl}
                </a>
              </section>
            )}
          </div>
        )}

        {/* ===================== TUNNEL ===================== */}
        {tab === "tunnel" && (
          <section className="max-w-2xl space-y-6">
            {hasTunnel ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 space-y-2">
                <h3 className="font-semibold text-green-900">
                  Cloudflare Tunnel Active
                </h3>
                <p className="text-sm text-green-700">
                  Traffic is routed securely from{" "}
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-medium"
                  >
                    {publicUrl}
                  </a>{" "}
                  through Cloudflare → Traefik → Frontend.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Configure Cloudflare Tunnel
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  Provide a Cloudflare API token with Tunnel and DNS edit
                  permissions, your root domain, and the desired subdomain.
                  DeployX will automatically create the tunnel, add a DNS
                  record, and route traffic through Traefik to your frontend.
                </p>

                <form
                  onSubmit={cfForm.handleSubmit(handleTunnel)}
                  className="space-y-5"
                >
                  {tunnelError && <Alert variant="error">{tunnelError}</Alert>}
                  {tunnelSuccess && (
                    <Alert variant="success">{tunnelSuccess}</Alert>
                  )}

                  <Field label="Cloudflare API Token">
                    <input
                      {...cfForm.register("apiToken", { required: "Required" })}
                      type="password"
                      placeholder="ey…"
                      className="input"
                    />
                  </Field>

                  <Field label="Root Domain">
                    <input
                      {...cfForm.register("domain", { required: "Required" })}
                      placeholder="example.com"
                      className="input"
                    />
                  </Field>

                  <Field label="Subdomain">
                    <input
                      {...cfForm.register("subdomain", {
                        required: "Required",
                      })}
                      placeholder="deployx"
                      className="input"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Will be accessible at subdomain.example.com
                    </p>
                  </Field>

                  <button
                    type="submit"
                    disabled={tunnelLoading}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition disabled:opacity-50"
                  >
                    {tunnelLoading
                      ? "Setting up tunnel…"
                      : "Create Tunnel & DNS Record"}
                  </button>
                </form>
              </div>
            )}
          </section>
        )}

        {/* ===================== PROJECTS ===================== */}
        {tab === "projects" && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Projects</h2>
              <button
                onClick={() => setShowNewProject((v) => !v)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
              >
                {showNewProject ? "Cancel" : "+ New Project"}
              </button>
            </div>

            {showNewProject && (
              <form
                onSubmit={projForm.handleSubmit(handleNewProject)}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4"
              >
                {projError && <Alert variant="error">{projError}</Alert>}
                <Field label="Project Name">
                  <input
                    {...projForm.register("name", { required: true })}
                    className="input"
                    placeholder="my-app"
                  />
                </Field>
                <Field label="Description">
                  <input
                    {...projForm.register("description")}
                    className="input"
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Repository URL">
                  <input
                    {...projForm.register("repository_url")}
                    className="input"
                    placeholder="https://github.com/user/repo"
                  />
                </Field>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                >
                  Create
                </button>
              </form>
            )}

            {projects.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">
                No projects yet.
              </div>
            ) : (
              <div className="grid gap-4">
                {projects.map((p: any) => (
                  <div
                    key={p.id}
                    className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-semibold text-gray-900">{p.name}</h4>
                      {p.description && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {p.description}
                        </p>
                      )}
                      <span
                        className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full ${p.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteProject(p.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ===================== AUDIT LOGS ===================== */}
        {tab === "logs" && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Audit Logs</h2>
            {logs.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-16">
                No logs yet.
              </p>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">
                        Action
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">
                        Resource
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logs.map((l: any) => (
                      <tr key={l.id}>
                        <td className="px-4 py-3 text-gray-800">{l.action}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {l.resource_type ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {new Date(l.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */
function Card({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: string;
}) {
  const bg: Record<string, string> = {
    blue: "bg-blue-50",
    indigo: "bg-indigo-50",
    green: "bg-green-50",
    amber: "bg-amber-50",
    purple: "bg-purple-50",
  };
  const fg: Record<string, string> = {
    blue: "text-blue-700",
    indigo: "text-indigo-700",
    green: "text-green-700",
    amber: "text-amber-700",
    purple: "text-purple-700",
  };
  return (
    <div className={`rounded-2xl p-5 ${bg[color] ?? "bg-gray-50"}`}>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${fg[color] ?? "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-green-500" : "bg-amber-400"}`}
    />
  );
}

function Alert({
  variant,
  children,
}: {
  variant: "error" | "success";
  children: React.ReactNode;
}) {
  const cls =
    variant === "error"
      ? "bg-red-50 border-red-200 text-red-700"
      : "bg-green-50 border-green-200 text-green-700";
  return (
    <div className={`rounded-lg border p-3 text-sm ${cls}`}>{children}</div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
