export default function HomePage() {
  return (
    <main className="space-y-4">
      <h1 className="text-3xl font-semibold">Phase 1 platform spine</h1>
      <p className="text-slate-600">
        Modular monolith is running as NestJS API + Next.js web. Authentication and
        ERP modules start in later phases.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-slate-700">
        <li>API docs at /api/docs on port 3001</li>
        <li>Liveness /api/v1/health</li>
        <li>Readiness /api/v1/ready</li>
        <li>Metrics /metrics</li>
      </ul>
    </main>
  );
}
