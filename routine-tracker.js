import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { CalendarDays, RefreshCcw, Upload, Download } from "lucide-react";

const API_BASE = "/api"; // Same repl, proxy via Express
const CLIENT_KEY = typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_CLIENT_KEY ? (process as any).env.NEXT_PUBLIC_CLIENT_KEY : undefined;

async function saveDayToNotion(date: string, checks: Record<Routine, boolean>) {
  try {
    const res = await fetch(`${API_BASE}/saveDay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(CLIENT_KEY ? { "x-client-key": CLIENT_KEY } : {}),
      },
      body: JSON.stringify({ date, checks }),
    });
    if (!res.ok) throw new Error(await res.text());
  } catch (e) {
    console.warn("Notion save failed:", e);
  }
}

async function loadDaysFromNotion(): Promise<DayEntry[] | null> {
  try {
    const res = await fetch(`${API_BASE}/loadDays`, {
      headers: { ...(CLIENT_KEY ? { "x-client-key": CLIENT_KEY } : {}) },
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return json.days as DayEntry[];
  } catch (e) {
    console.warn("Notion load failed:", e);
    return null;
  }
}

// ======= Helpers =======
function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date) {
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  return nd;
}

function daysBetween(a: Date, b: Date) {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// ======= Types =======
const DEFAULT_ROUTINES = ["Träning", "Mat", "Vatten", "Sömn", "Arbete"] as const;

type Routine = (typeof DEFAULT_ROUTINES)[number];

type DayEntry = {
  date: string; // YYYY-MM-DD
  checks: Record<Routine, boolean>;
};

type Store = {
  routines: Routine[];
  days: DayEntry[]; // always unique by date, sorted asc
  version: number;
};

const STORAGE_KEY = "routine-tracker-v2";

// ======= Storage =======
function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("no store");
    const parsed: Store = JSON.parse(raw);
    // basic validation
    if (!Array.isArray(parsed.days) || !Array.isArray(parsed.routines)) {
      throw new Error("bad store");
    }
    return parsed;
  } catch {
    const today = formatDate(new Date());
    const emptyChecks: Record<Routine, boolean> = DEFAULT_ROUTINES.reduce(
      (acc, r) => ((acc[r] = false), acc),
      {} as Record<Routine, boolean>
    );
    return { routines: [...DEFAULT_ROUTINES], days: [{ date: today, checks: emptyChecks }], version: 1 };
  }
}

function saveStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// ======= Component =======
export default function RoutineTrackerApp() {
  const [store, setStore] = useState<Store>(() => loadStore());

  useEffect(() => {
    (async () => {
        const remote = await loadDaysFromNotion();
        if (remote && remote.length) {
            setStore((prev) => ({ ...prev, days: remote }));
        }
    })();
}, []);

  const routines = store.routines as Routine[];
  const todayStr = formatDate(new Date());

  // Ensure today exists; if not, create a fresh entry (this handles day rollover)
  useEffect(() => {
    setStore((prev) => {
      const exists = prev.days.find((d) => d.date === todayStr);
      if (exists) return prev;
      const emptyChecks: Record<Routine, boolean> = routines.reduce(
        (acc, r) => ((acc[r] = false), acc),
        {} as Record<Routine, boolean>
      );
      const next = { ...prev, days: [...prev.days, { date: todayStr, checks: emptyChecks }] };
      saveStore(next);
      return next;
    });
    // check every minute in case the tab stays open past midnight
    const id = setInterval(() => {
      const now = formatDate(new Date());
      if (!store.days.find((d) => d.date === now)) {
        setStore((prev) => {
          const emptyChecks: Record<Routine, boolean> = routines.reduce(
            (acc, r) => ((acc[r] = false), acc),
            {} as Record<Routine, boolean>
          );
          const next = { ...prev, days: [...prev.days, { date: now, checks: emptyChecks }] };
          saveStore(next);
          return next;
        });
      }
    }, 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayStr]);

  // Persist changes
  useEffect(() => {
    saveStore(store);
  }, [store]);

  const todayEntry = store.days.find((d) => d.date === todayStr)!;

  function setCheck(r: Routine, val: boolean) {
    setStore((prev) => {
      const nextDays = prev.days.map((d) =>
        d.date === todayStr ? { ...d, checks: { ...d.checks, [r]: val } } : d
      );
      const next = { ...prev, days: nextDays };
  
      // Fire-and-forget save for today only
      const today = nextDays.find((d) => d.date === todayStr)!;
      saveDayToNotion(today.date, today.checks);
  
      return next;
    });
  }

  function resetToday() {
    setStore((prev) => {
      const nextDays = prev.days.map((d) =>
        d.date === todayStr
          ? { ...d, checks: Object.fromEntries(routines.map((r) => [r, false])) as Record<Routine, boolean> }
          : d
      );
      return { ...prev, days: nextDays };
    });
  }

  function clearAll() {
    if (!confirm("Återställ allt? Detta raderar all historik.")) return;
    const today = formatDate(new Date());
    const emptyChecks: Record<Routine, boolean> = routines.reduce(
      (acc, r) => ((acc[r] = false), acc),
      {} as Record<Routine, boolean>
    );
    const fresh: Store = { routines: [...DEFAULT_ROUTINES], days: [{ date: today, checks: emptyChecks }], version: 1 };
    setStore(fresh);
  }

  // ======= Stats =======
  const perDayStats = useMemo(() => {
    // For each day, compute completed count and success (> half of routines)
    return store.days
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((d) => {
        const completed = Object.values(d.checks).filter(Boolean).length;
        const success = completed > routines.length / 2;
        return { date: d.date, completed, success };
      });
  }, [store.days, routines.length]);

  const cumulativeSeries = useMemo(() => {
    let score = 0;
    return perDayStats.map((d) => {
      score += d.success ? 1 : -1;
      return { date: d.date, score };
    });
  }, [perDayStats]);

  // ======= Heatmap (last 52 weeks) =======
  const heatmapData = useMemo(() => {
    const today = startOfDay(new Date());
    const start = new Date(today);
    start.setDate(start.getDate() - 7 * 52 + 1);
    const cells: { date: string; completed: number }[] = [];
    const dayIndex = new Map(store.days.map((d) => [d.date, d] as const));
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const key = formatDate(d);
      const entry = dayIndex.get(key);
      const completed = entry ? Object.values(entry.checks).filter(Boolean).length : 0;
      cells.push({ date: key, completed });
    }
    return cells;
  }, [store.days]);

  function colorFor(n: number) {
    // 0..5 mapped to neutral -> brand
    switch (n) {
      case 0:
        return "bg-neutral-300";
      case 1:
        return "bg-red-400";
      case 2:
        return "bg-amber-400";
      case 3:
        return "bg-green-400";
      case 4:
        return "bg-blue-400";
      default:
        return "bg-indigo-500";
    }
  }

  // Group heatmap cells into weeks (columns) by ISO week logic (Mon-Sun)
  const heatmapWeeks = useMemo(() => {
    const weeks: { date: string; completed: number }[][] = [];
    let bucket: { date: string; completed: number }[] = [];
    for (const c of heatmapData) {
      const dt = new Date(c.date + "T00:00:00");
      const day = (dt.getDay() + 6) % 7; // 0 = Monday, 6 = Sunday
      if (day === 0 && bucket.length) {
        weeks.push(bucket);
        bucket = [];
      }
      bucket.push(c);
    }
    if (bucket.length) weeks.push(bucket);
    return weeks;
  }, [heatmapData]);

  // ======= Export/Import =======
  function exportJSON() {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `routine-tracker-${todayStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data.days || !data.routines) throw new Error("Bad file");
        setStore(data);
      } catch (err) {
        alert("Kunde inte läsa filen.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-slate-50 text-slate-900 p-6">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Daglig rutin-tracker</h1>
            <p className="text-sm text-slate-600 flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {todayStr}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={resetToday} title="Nollställ dagens rutor"><RefreshCcw className="h-4 w-4 mr-2"/>Nollställ idag</Button>
            <Button variant="outline" onClick={exportJSON} title="Exportera data"><Download className="h-4 w-4 mr-2"/>Exportera</Button>
            <label className="inline-flex items-center">
              <input type="file" accept="application/json" className="hidden" onChange={importJSON} id="import-json" />
              <Button variant="outline" onClick={() => document.getElementById("import-json")?.click()} title="Importera data">
                <Upload className="h-4 w-4 mr-2"/>Importera
              </Button>
            </label>
            <Button variant="destructive" onClick={clearAll}>Rensa allt</Button>
          </div>
        </header>

        {/* Today's checklist */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Idag</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {routines.map((r) => (
                <label key={r} className="flex items-center gap-3 rounded-2xl border p-3 hover:shadow-sm transition">
                  <Checkbox
                    checked={todayEntry.checks[r]}
                    onCheckedChange={(v) => setCheck(r, Boolean(v))}
                    className="h-5 w-5"
                  />
                  <span className="text-sm font-medium">{r}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Markera vad du har gjort idag. Dagar räknas som <span className="font-semibold">upp</span> i diagrammet om du klarar fler än hälften av rutinerna.
            </p>
          </CardContent>
        </Card>

        {/* Heatmap */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-end justify-between mb-3">
              <h2 className="text-xl font-semibold">Heatmap — 52 veckor</h2>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>0</span>
                <span className={`h-3 w-3 rounded ${colorFor(0)}`}></span>
                <span className={`h-3 w-3 rounded ${colorFor(1)}`}></span>
                <span className={`h-3 w-3 rounded ${colorFor(2)}`}></span>
                <span className={`h-3 w-3 rounded ${colorFor(3)}`}></span>
                <span className={`h-3 w-3 rounded ${colorFor(4)}`}></span>
                <span>5</span>
              </div>
            </div>
            <div className="overflow-auto">
              <div className="flex gap-1">
                {heatmapWeeks.map((week, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    {Array.from({ length: 7 }).map((_, dayIdx) => {
                      const cell = week[dayIdx];
                      const classes = `h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 rounded ${cell ? colorFor(Math.min(cell.completed, 5)) : "bg-neutral-200"}`;
                      return (
                        <div key={dayIdx} className={classes} title={cell ? `${cell.date}: ${cell.completed} av ${routines.length}` : ""} />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Up/Down Diagram */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Diagram — kumulativt upp/ner</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeSeries} margin={{ left: 8, right: 8, top: 16, bottom: 8 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 12 }} width={30} />
                  <Tooltip formatter={(v, n, p) => [v as number, "Score"]} labelFormatter={(l) => `Dag: ${l}`} />
                  <ReferenceLine y={0} strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="score" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Varje dag: +1 om du klarat fler än hälften, annars −1. Linjen visar din samlade utveckling över tid.
            </p>
          </CardContent>
        </Card>

        {/* History table (compact) */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Historik (senaste 14 dagar)</h2>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600">
                    <th className="py-2 pr-2">Datum</th>
                    {routines.map((r) => (
                      <th key={r} className="py-2 pr-2 font-normal">{r}</th>
                    ))}
                    <th className="py-2 pr-2">Klarade</th>
                    <th className="py-2 pr-2">Upp/Ner</th>
                  </tr>
                </thead>
                <tbody>
                  {perDayStats.slice(-14).map((d) => (
                    <tr key={d.date} className="border-t">
                      <td className="py-2 pr-2 font-medium">{d.date}</td>
                      {routines.map((r) => {
                        const entry = store.days.find((x) => x.date === d.date)!;
                        return (
                          <td key={r} className="py-2 pr-2">
                            {entry.checks[r] ? "✓" : "–"}
                          </td>
                        );
                      })}
                      <td className="py-2 pr-2">{d.completed}/{routines.length}</td>
                      <td className={`py-2 pr-2 ${d.success ? "text-green-600" : "text-red-600"}`}>
                        {d.success ? "+1" : "−1"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <footer className="text-xs text-slate-500 py-4">
          <p>
            Tips: Låt fliken vara öppen – appen skapar automatiskt en ny rad för en ny dag efter midnatt. Data sparas i din webbläsare (localStorage).
          </p>
        </footer>
      </div>
    </div>
  );
}