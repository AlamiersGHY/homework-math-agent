const statusItems = [
  "Next.js App Router scaffold",
  "FastAPI backend contract ready",
  "SSE chat stream planned through fetch",
  "OCR and Plot features reserved for MVP"
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-10">
      <section className="mx-auto flex max-w-4xl flex-col gap-8">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            Math Agent Scaffold
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-neutral-950">
            数学分析学习 Agent 的前端工程骨架已就绪
          </h1>
          <p className="max-w-2xl text-base leading-7 text-neutral-700">
            当前页面用于验证 Next.js、TypeScript 和 Tailwind 基础工程。完整聊天、OCR
            和可视化体验将在后续实现阶段接入。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {statusItems.map((item) => (
            <div
              className="border border-neutral-200 bg-white p-4 shadow-sm"
              key={item}
            >
              <p className="text-sm font-medium text-neutral-900">{item}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
