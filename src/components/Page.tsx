// Shared frame for long-form pages (About, Help).
export default function Page({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="scroll-thin flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[720px] px-6 pb-24 pt-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">{eyebrow}</p>
        <h1 className="mt-3 text-[40px] font-medium leading-[1.1] tracking-[-0.01em]">{title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-soft">{intro}</p>
        <div className="prose-tuneo mt-10">{children}</div>
      </div>
    </div>
  );
}

export function Cards({ items }: { items: { title: string; body: string }[] }) {
  return (
    <div className="not-prose mt-6 grid gap-3 sm:grid-cols-2">
      {items.map((c) => (
        <div key={c.title} className="rounded-2xl bg-surface p-5">
          <h3 className="text-[15px] font-medium">{c.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.body}</p>
        </div>
      ))}
    </div>
  );
}
