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

  const color = ms === null ? "#9aa0a6" : ms < 100 ? "#22c55e" : ms < 300 ? "#eab308" : "#ef4444";

  return (
    <div
      className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
      style={{ background: "var(--rd-surface)", color: "var(--rd-muted)" }}
      title="Round-trip latency to the proxy edge"
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span style={{ color }}>{ms === null ? "--" : `${ms} ms`}</span>
    </div>
  );
}

export function SingaporeClock() {
  const [now, setNow] = useState<string>("");
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
    <div
      className="rounded-full px-3 py-1 text-xs font-medium"
      style={{ background: "var(--rd-surface)", color: "var(--rd-muted)" }}
    >
      SGT {now}
    </div>
  );
}
