const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Envelope<T> = {
  data?: T;
  error?: { code: string; message: string };
};

async function load(path: string) {
  try {
    const response = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    const body = (await response.json()) as Envelope<unknown>;
    return { ok: response.ok, body };
  } catch {
    return { ok: false, body: { error: { code: "COMMON.DEPENDENCY_UNAVAILABLE", message: "API unreachable" } } };
  }
}

export default async function HealthPage() {
  const [live, ready] = await Promise.all([
    load("/api/v1/health"),
    load("/api/v1/ready"),
  ]);

  return (
    <main className="space-y-6">
      <h1 className="text-3xl font-semibold">Platform health</h1>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium">Liveness</h2>
        <pre className="mt-2 overflow-x-auto text-sm text-slate-700">
          {JSON.stringify(live.body, null, 2)}
        </pre>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium">Readiness</h2>
        <p className="text-sm text-slate-500">{ready.ok ? "dependencies reachable" : "degraded or unreachable"}</p>
        <pre className="mt-2 overflow-x-auto text-sm text-slate-700">
          {JSON.stringify(ready.body, null, 2)}
        </pre>
      </section>
    </main>
  );
}
