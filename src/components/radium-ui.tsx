import { useEffect, useState } from "react";

export function PingCounter() {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const measure = async () => {
      const start = performance.now();
      try {
        await fetch("/api/public/ping", { cache: "no-store" });
        if (alive) setMs(Math.round(performance.now() - start));
      } catch {
        if (alive) setMs(null);
      }
    };
    measure();
    const id = setInterval(measure, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const color = ms === null ? "var(--rd-muted)" : ms < 100 ? "var(--rd-accent-alt)" : ms < 300 ? "var(--rd-accent)" : "var(--destructive)";

  return (
    <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em]">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span style={{ color }}>{ms === null ? "OFFLINE" : `${ms} MS`}</span>
    </div>
  );
}

export function SingaporeClock() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString("en-SG", {
          timeZone: "Asia/Singapore",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);
  if (!now) return null;
  return (
    <span className="font-mono text-[11px] tracking-[0.14em]" style={{ color: "var(--rd-muted)" }}>
      SGT {now.toUpperCase()}
    </span>
  );
}

export function RadiumMark({ size = 40 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-sm font-bold"
      style={{
        width: size,
        height: size,
        background: "var(--rd-accent)",
        color: "var(--rd-bg)",
        fontSize: size * 0.5,
      }}
    >
      R
    </span>
  );
}
