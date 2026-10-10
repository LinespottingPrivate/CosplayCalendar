import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Car, ChevronLeft, ChevronRight, MapPin, Plane, Train } from "lucide-react";
import { cities } from "@/data/cities";
import { CATEGORIES, conventions, REGIONS, type Convention } from "@/data/conventions";
import { askCoach, translatePack } from "@/lib/coach";
import { dictionary, englishPack, LOCALES, t, type Dict } from "@/lib/i18n";
import {
  planTrip,
  scoreEvent,
  type Division,
  type PastResult,
  type Placement,
  type TravelMode,
} from "@/lib/model";

const STORE = "cosplay-calendar-v1";

const CAST = [
  { src: "/cast/cape.jpg", name: "Vesper" },
  { src: "/cast/knight.jpg", name: "Cinder" },
  { src: "/cast/fox.jpg", name: "Lumen" },
  { src: "/cast/mage.jpg", name: "Nox" },
];

const PLACEMENTS: Placement[] = ["none", "finalist", "third", "second", "first"];

type When = "upcoming" | "past" | "all";
type SortKey = "soonest" | "closest" | "bestValue" | "highestPrize" | "winChance";
type Tab = "calendar" | "planner" | "odds" | "studio" | "metrics";

type Persisted = {
  locale: string;
  cityId: string;
  lat: number | null;
  lng: number | null;
  mode: TravelMode;
  budget: number;
  maxHours: number;
  minPrize: number;
  category: string;
  region: string;
  division: Division;
  craft: number;
  stage: number;
  perDiem: number;
  results: PastResult[];
  apiKey: string;
  hosted: boolean;
  spinSpeed: number;
  when: When;
  sort: SortKey;
  query: string;
  overlays: Record<string, Dict>;
};

const DEFAULTS: Persisted = {
  locale: "en",
  cityId: "",
  lat: null,
  lng: null,
  mode: "auto",
  budget: 2500,
  maxHours: 30,
  minPrize: 0,
  category: "all",
  region: "all",
  division: "journeyman",
  craft: 62,
  stage: 58,
  perDiem: 48,
  results: [],
  apiKey: "",
  hosted: false,
  spinSpeed: 18,
  when: "upcoming",
  sort: "soonest",
  query: "",
  overlays: {},
};

function todayISO() {
  const d = new Date();
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return z.toISOString().slice(0, 10);
}

function dayISO(d: Date) {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - lead + i));
}

function intlLocale(id: string) {
  if (id === "zh") return "zh-CN";
  if (id === "no") return "nb";
  return id;
}

function money(locale: string, n: number) {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function pct(locale: string, n: number) {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(n);
}

function Slider(props: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  suffix?: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="flex items-center justify-between gap-3 text-muted">
        <span>{props.label}</span>
        <span className="text-fg">
          {props.value}
          {props.suffix ?? ""}
        </span>
      </span>
      <input
        className="cc-range"
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function CosplayApp() {
  const [p, setP] = useState<Persisted>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("calendar");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [locError, setLocError] = useState("");
  const [note, setNote] = useState("");
  const [reply, setReply] = useState("");
  const [coachError, setCoachError] = useState("");
  const [busy, setBusy] = useState<"ask" | "translate" | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftPlace, setDraftPlace] = useState<Placement>("finalist");
  const [chartsOn, setChartsOn] = useState(false);
  const [facing, setFacing] = useState(CAST[0].name);
  const [reduced, setReduced] = useState(false);
  const ring = useRef<HTMLDivElement>(null);
  const angle = useRef(0);
  const drag = useRef<{ x: number; a: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Persisted>;
        setP({ ...DEFAULTS, ...saved, overlays: saved.overlays ?? {} });
      } else {
        const lang = navigator.language.slice(0, 2).toLowerCase();
        if (LOCALES.some((l) => l.id === lang)) {
          setP((s) => ({ ...s, locale: lang }));
        }
      }
    } catch {
      /* keep defaults */
    }
    setReady(true);
    setChartsOn(true);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORE, JSON.stringify(p));
    document.documentElement.lang = p.locale;
    document.documentElement.dir = p.locale === "ar" ? "rtl" : "ltr";
  }, [p, ready]);

  useEffect(() => {
    if (reduced || p.spinSpeed <= 0 || tab !== "calendar") return;
    let frame = 0;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (!drag.current) {
        const dt = Math.min(0.05, (now - last) / 1000);
        angle.current = (angle.current + p.spinSpeed * dt) % 360;
        ring.current?.style.setProperty("--spin", `${angle.current}deg`);
        if (frame++ % 10 === 0) {
          const idx = ((Math.round(angle.current / 90) % 4) + 4) % 4;
          setFacing(CAST[idx].name);
        }
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [p.spinSpeed, reduced, tab]);

  const dict = dictionary(p.locale, p.overlays[p.locale]);
  const label = (key: string) => t(dict, key);
  const today = todayISO();
  const origin = p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null;

  const ranked = useMemo(() => {
    const q = p.query.trim().toLowerCase();
    const rows = conventions.map((event) => {
      const trip = origin ? planTrip(origin, event, p.mode, p.perDiem) : null;
      const score = scoreEvent({
        craft: p.craft,
        stage: p.stage,
        results: p.results,
        division: p.division,
        heat: event.heat,
        grandPrize: event.contestPrizeUsd,
      });
      const net = trip ? score.expected - trip.total : null;
      return { event, trip, score, net };
    });
    const filtered = rows.filter(({ event, trip }) => {
      if (p.when === "upcoming" && event.end < today) return false;
      if (p.when === "past" && event.end >= today) return false;
      if (p.region !== "all" && event.region !== p.region) return false;
      if (p.category !== "all" && !event.categories.includes(p.category as Convention["categories"][number])) {
        return false;
      }
      if ((event.contestPrizeUsd ?? 0) < p.minPrize) return false;
      if (q) {
        const blob = `${event.name} ${event.city} ${event.country}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (origin && trip) {
        if (trip.total > p.budget) return false;
        if (trip.hours > p.maxHours) return false;
      }
      return true;
    });
    filtered.sort((a, b) => {
      if (p.sort === "closest") return (a.trip?.km ?? 1e12) - (b.trip?.km ?? 1e12);
      if (p.sort === "bestValue") return (b.net ?? -1e15) - (a.net ?? -1e15);
      if (p.sort === "highestPrize") return (b.event.contestPrizeUsd ?? -1) - (a.event.contestPrizeUsd ?? -1);
      if (p.sort === "winChance") return b.score.pFirst - a.score.pFirst;
      return a.event.start.localeCompare(b.event.start);
    });
    return filtered;
  }, [origin, p, today]);

  const bestId = ranked.reduce<{ id: string; net: number } | null>((best, row) => {
    if (row.net == null) return best;
    if (!best || row.net > best.net) return { id: row.event.id, net: row.net };
    return best;
  }, null)?.id;

  const selected = ranked.find((r) => r.event.id === selectedId) ?? ranked[0] ?? null;

  function patch(partial: Partial<Persisted>) {
    setP((s) => ({ ...s, ...partial }));
  }

  function openEvent(id: string) {
    setSelectedId(id);
    setTab("planner");
  }

  async function onAsk() {
    if (!selected) return;
    setBusy("ask");
    setCoachError("");
    try {
      const res = await askCoach({
        data: {
          prompt: note,
          locale: p.locale,
          hosted: p.hosted,
          userKey: p.apiKey,
          context: JSON.stringify({
            show: {
              name: selected.event.name,
              city: selected.event.city,
              dates: `${selected.event.start} to ${selected.event.end}`,
              venue: selected.event.venue,
              notes: selected.event.notes,
              purseUsd: selected.event.contestPrizeUsd,
              purseStatus: selected.event.contestPrizeUsd ? "see notes for published vs estimate" : "not published",
            },
            trip: selected.trip,
            model: {
              pFirst: selected.score.pFirst,
              pTop3: selected.score.pTop,
              expectedUsd: selected.score.expected,
              field: selected.score.field,
              note: "planning model, not a judge",
            },
          }),
        },
      });
      if (res.ok) setReply(res.text);
      else setCoachError(res.error);
    } catch (err) {
      setCoachError(err instanceof Error ? err.message : "Coach failed");
    } finally {
      setBusy(null);
    }
  }

  async function onTranslate() {
    setBusy("translate");
    setCoachError("");
    try {
      const res = await translatePack({
        data: {
          locale: p.locale,
          hosted: p.hosted,
          userKey: p.apiKey,
          pack: englishPack(),
        },
      });
      if (res.ok) patch({ overlays: { ...p.overlays, [p.locale]: res.pack } });
      else setCoachError(res.error);
    } catch (err) {
      setCoachError(err instanceof Error ? err.message : "Translate failed");
    } finally {
      setBusy(null);
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      setLocError(label("locateFail"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocError("");
        patch({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          cityId: "",
        });
      },
      () => setLocError(label("locateFail")),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  function loadSample(kind: Division) {
    const samples: Record<Division, { craft: number; stage: number; cityId: string; results: PastResult[] }> = {
      novice: {
        craft: 48,
        stage: 44,
        cityId: "stockholm",
        results: [
          { id: "n1", label: "MCM London", placement: "none" },
          { id: "n2", label: "Comic Con Stockholm", placement: "finalist" },
        ],
      },
      journeyman: {
        craft: 70,
        stage: 66,
        cityId: "dusseldorf",
        results: [
          { id: "j1", label: "MCM London", placement: "none" },
          { id: "j2", label: "Lucca Comics", placement: "third" },
          { id: "j3", label: "DoKomi", placement: "second" },
        ],
      },
      master: {
        craft: 86,
        stage: 80,
        cityId: "los-angeles",
        results: [
          { id: "m1", label: "Katsucon", placement: "second" },
          { id: "m2", label: "Anime Expo", placement: "first" },
          { id: "m3", label: "San Diego Comic-Con", placement: "finalist" },
          { id: "m4", label: "Dragon Con", placement: "third" },
        ],
      },
    };
    const sample = samples[kind];
    const city = cities.find((c) => c.id === sample.cityId);
    patch({
      division: kind,
      craft: sample.craft,
      stage: sample.stage,
      results: sample.results,
      cityId: city?.id ?? "",
      lat: city?.lat ?? null,
      lng: city?.lng ?? null,
    });
  }

  const cells = monthCells(cursor.y, cursor.m);
  const monthTitle = new Intl.DateTimeFormat(intlLocale(p.locale), {
    month: "long",
    year: "numeric",
  }).format(new Date(cursor.y, cursor.m, 1));
  const cityName =
    cities.find((c) => c.id === p.cityId)?.name ?? (origin ? label("pinned") : "");

  const tabs: Tab[] = ["calendar", "planner", "odds", "studio", "metrics"];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <div className="marquee" aria-hidden="true" />
      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.28em] text-gold uppercase">Cosplay</p>
          <h1 className="playbill text-5xl leading-none text-fg sm:text-6xl">
            <span className="italic">Calendar</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">{label("tagline")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="grid gap-1 text-xs text-muted">
            {label("language")}
            <select
              className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm text-fg"
              value={p.locale}
              onChange={(e) => patch({ locale: e.target.value })}
            >
              {LOCALES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          {p.locale !== "en" ? (
            <button
              type="button"
              className="mt-5 min-h-11 rounded-lg border border-line px-3 text-sm text-fg transition-transform duration-150 active:scale-[0.96] disabled:opacity-50"
              disabled={busy !== null || (!p.apiKey && !p.hosted)}
              onClick={onTranslate}
            >
              {busy === "translate" ? label("asking") : label("translate")}
            </button>
          ) : null}
        </div>
      </header>

      <section className="stage mt-6 rounded-lg border border-line">
        <img className="hero-still" src="/cast/cape.jpg" alt="" />
        <video className="hero-video" autoPlay muted loop playsInline poster="/cast/cape.jpg">
          <source src="/cast/runway.mp4" type="video/mp4" />
        </video>
        <div className="stage-shade" />
        {CAST.map((c, i) => (
          <div key={c.name} className={`flyer flyer-${"abcd"[i]}`}>
            <img src={c.src} alt="" />
          </div>
        ))}
        <div className="relative z-10 flex h-full items-end justify-between gap-3 p-4">
          <div className="max-w-xs rounded-lg bg-bg px-3 py-2">
            <p className="text-xs tracking-[0.22em] text-gold uppercase">{label("flyers")}</p>
            <p className="playbill text-3xl text-fg">{facing}</p>
            <Slider
              label={label("spinSpeed")}
              min={0}
              max={40}
              value={p.spinSpeed}
              onChange={(n) => patch({ spinSpeed: n })}
            />
          </div>
          <div
            className="spin-stage w-40 shrink-0"
            tabIndex={0}
            aria-label={label("spin")}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              angle.current += e.key === "ArrowRight" ? 15 : -15;
              ring.current?.style.setProperty("--spin", `${angle.current}deg`);
            }}
            onPointerDown={(e) => {
              drag.current = { x: e.clientX, a: angle.current };
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              angle.current = drag.current.a + (e.clientX - drag.current.x) * 0.45;
              ring.current?.style.setProperty("--spin", `${angle.current}deg`);
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
          >
            <div className="spin-ring" ref={ring}>
              {CAST.map((c, i) => (
                <article key={c.name} className="spin-card" style={{ ["--i" as string]: i }}>
                  <img src={c.src} alt={c.name} />
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mt-4 grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-xs text-muted">
          {label("where")}
          <select
            className="min-h-11 rounded-lg border border-line bg-bg px-3 text-sm text-fg"
            value={p.cityId}
            onChange={(e) => {
              const city = cities.find((c) => c.id === e.target.value);
              if (!city) {
                patch({ cityId: "", lat: null, lng: null });
                return;
              }
              patch({ cityId: city.id, lat: city.lat, lng: city.lng });
            }}
          >
            <option value="">{label("where")}</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-gold px-3 text-sm text-bg transition-transform duration-150 active:scale-[0.96]"
            onClick={locate}
          >
            <MapPin size={16} aria-hidden="true" />
            {label("useMyLocation")}
          </button>
        </div>
        <label className="grid gap-1 text-xs text-muted">
          {label("travelMode")}
          <select
            className="min-h-11 rounded-lg border border-line bg-bg px-3 text-sm text-fg"
            value={p.mode}
            onChange={(e) => patch({ mode: e.target.value as TravelMode })}
          >
            <option value="auto">{label("auto")}</option>
            <option value="flight">{label("flight")}</option>
            <option value="rail">{label("rail")}</option>
            <option value="drive">{label("drive")}</option>
          </select>
        </label>
        <p className="self-end text-sm text-fg">
          {cityName || label("needPlace")}
          {locError ? <span className="mt-1 block text-gold">{locError}</span> : null}
        </p>
        <label className="grid gap-1 text-xs text-muted sm:col-span-2">
          {label("search")}
          <input
            className="min-h-11 rounded-lg border border-line bg-bg px-3 text-sm text-fg"
            value={p.query}
            onChange={(e) => patch({ query: e.target.value })}
          />
        </label>
        <label className="grid gap-1 text-xs text-muted">
          {label("region")}
          <select
            className="min-h-11 rounded-lg border border-line bg-bg px-3 text-sm text-fg"
            value={p.region}
            onChange={(e) => patch({ region: e.target.value })}
          >
            <option value="all">{label("all")}</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {label(`reg_${r}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted">
          {label("category")}
          <select
            className="min-h-11 rounded-lg border border-line bg-bg px-3 text-sm text-fg"
            value={p.category}
            onChange={(e) => patch({ category: e.target.value })}
          >
            <option value="all">{label("all")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {label(`cat_${c}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:col-span-2 lg:col-span-4 sm:grid-cols-3">
          <Slider label={label("budget")} min={200} max={8000} step={50} value={p.budget} suffix=" USD" onChange={(n) => patch({ budget: n })} />
          <Slider label={label("maxHours")} min={2} max={40} value={p.maxHours} suffix=" h" onChange={(n) => patch({ maxHours: n })} />
          <Slider label={label("minPrize")} min={0} max={5000} step={100} value={p.minPrize} suffix=" USD" onChange={(n) => patch({ minPrize: n })} />
        </div>
      </section>

      <nav className="mt-4 flex gap-2 overflow-x-auto" aria-label={label("filters")}>
        {tabs.map((id) => (
          <button
            key={id}
            type="button"
            className={`min-h-11 shrink-0 rounded-lg px-4 text-sm transition-transform duration-150 active:scale-[0.96] ${
              tab === id ? "bg-gold text-bg" : "bg-surface text-fg"
            }`}
            onClick={() => setTab(id)}
          >
            {label(id)}
          </button>
        ))}
      </nav>

      {tab === "calendar" ? (
        <section className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="grid content-start gap-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line"
                aria-label="Previous month"
                onClick={() =>
                  setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))
                }
              >
                <ChevronLeft size={18} />
              </button>
              <h2 className="playbill text-2xl capitalize">{monthTitle}</h2>
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line"
                aria-label="Next month"
                onClick={() =>
                  setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))
                }
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i}>
                  {new Intl.DateTimeFormat(intlLocale(p.locale), { weekday: "narrow" }).format(
                    new Date(2026, 0, 5 + i),
                  )}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day) => {
                const iso = dayISO(day);
                const inMonth = day.getMonth() === cursor.m;
                const hits = ranked.filter((r) => r.event.start <= iso && r.event.end >= iso);
                const live = iso === today;
                return (
                  <button
                    key={iso}
                    type="button"
                    className={`min-h-11 rounded-md px-1 py-1 text-left text-xs ${
                      inMonth ? "bg-surface text-fg" : "bg-bg text-muted"
                    } ${live ? "ring-1 ring-gold" : ""}`}
                    onClick={() => {
                      if (hits[0]) openEvent(hits[0].event.id);
                      else setCursor({ y: day.getFullYear(), m: day.getMonth() });
                    }}
                  >
                    <span>{day.getDate()}</span>
                    {hits[0] ? <span className="mt-1 block truncate text-gold">{hits[0].event.city}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <ul className="grid content-start gap-2">
            <li className="flex flex-wrap gap-2 text-xs text-muted">
              {(["upcoming", "past", "all"] as When[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`min-h-11 rounded-lg px-3 ${p.when === w ? "bg-gold text-bg" : "bg-surface text-fg"}`}
                  onClick={() => patch({ when: w })}
                >
                  {label(w === "all" ? "all" : w)}
                </button>
              ))}
              <label className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-surface px-3 text-sm text-fg">
                {label("filters")}
                <select
                  className="bg-transparent text-fg"
                  value={p.sort}
                  onChange={(e) => patch({ sort: e.target.value as SortKey })}
                >
                  {(["soonest", "closest", "bestValue", "highestPrize", "winChance"] as SortKey[]).map((s) => (
                    <option key={s} value={s}>
                      {label(`sort_${s}`)}
                    </option>
                  ))}
                </select>
              </label>
            </li>
            {ranked.length === 0 ? <li className="text-muted">{label("noEvents")}</li> : null}
            {ranked.map((row) => {
              const live = row.event.start <= today && row.event.end >= today;
              return (
                <li key={row.event.id}>
                  <button
                    type="button"
                    className="grid w-full gap-1 rounded-lg border border-line bg-surface p-4 text-left transition-transform duration-150 active:scale-[0.96] sm:grid-cols-[1fr_auto]"
                    onClick={() => openEvent(row.event.id)}
                  >
                    <span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-base text-fg">{row.event.name}</span>
                        {live ? <span className="text-xs text-gold">{label("live")}</span> : null}
                        {bestId === row.event.id ? (
                          <span className="text-xs text-gold">{label("bestNet")}</span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-sm text-muted">
                        {row.event.city}, {row.event.country} · {row.event.start} – {row.event.end}
                      </span>
                    </span>
                    <span className="text-sm text-fg">
                      {label("winChance")} {pct(p.locale, row.score.pFirst)}
                      <span className="mt-1 block text-muted">
                        {row.event.contestPrizeUsd == null
                          ? label("unpublished")
                          : money(p.locale, row.event.contestPrizeUsd)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {tab === "planner" ? (
        <section className="mt-4 grid gap-4">
          {!selected ? <p className="text-muted">{label("needShow")}</p> : null}
          {selected ? (
            <article className="grid gap-4 rounded-lg border border-line bg-surface p-5">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="playbill text-4xl">{selected.event.name}</h2>
                  <p className="text-sm text-muted">
                    {selected.event.venue ? `${selected.event.venue}, ` : ""}
                    {selected.event.city}, {selected.event.country}
                  </p>
                  <p className="text-sm text-fg">
                    {selected.event.start} – {selected.event.end}
                  </p>
                </div>
                <a
                  className="inline-flex min-h-11 items-center rounded-lg bg-gold px-4 text-sm text-bg"
                  href={selected.event.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  {label("openEvent")}
                </a>
              </header>
              {!selected.trip ? <p className="text-muted">{label("needPlace")}</p> : null}
              {selected.trip ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat
                    icon={
                      selected.trip.mode === "flight" ? (
                        <Plane size={16} />
                      ) : selected.trip.mode === "rail" ? (
                        <Train size={16} />
                      ) : (
                        <Car size={16} />
                      )
                    }
                    label={label(selected.trip.mode)}
                    value={`${selected.trip.km} km · ${selected.trip.hours} h ${label("oneway")}`}
                  />
                  <Stat label={label("leaveBy")} value={new Intl.DateTimeFormat(intlLocale(p.locale), { dateStyle: "medium", timeStyle: "short" }).format(selected.trip.leaveBy)} />
                  <Stat label={label("nights")} value={`${selected.trip.nights}`} />
                  <Stat label={label("tripCost")} value={money(p.locale, selected.trip.total)} />
                  <Stat label={label("badge")} value={money(p.locale, selected.trip.badge)} />
                  <Stat label={label("hotel")} value={money(p.locale, selected.trip.hotel)} />
                  <Stat label={label("food")} value={money(p.locale, selected.trip.food)} />
                  <Stat label={label("round")} value={money(p.locale, selected.trip.travelUsd)} />
                </div>
              ) : null}
              <p className="text-sm leading-relaxed text-muted">{selected.event.notes}</p>
            </article>
          ) : null}
        </section>
      ) : null}

      {tab === "odds" ? (
        <section className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-4 rounded-lg border border-line bg-surface p-4">
            <Slider label={label("craft")} min={0} max={100} value={p.craft} onChange={(n) => patch({ craft: n })} />
            <Slider label={label("stage")} min={0} max={100} value={p.stage} onChange={(n) => patch({ stage: n })} />
            <Slider label={label("perDiem")} min={15} max={120} value={p.perDiem} suffix=" USD" onChange={(n) => patch({ perDiem: n })} />
            <label className="grid gap-1 text-xs text-muted">
              {label("division")}
              <select
                className="min-h-11 rounded-lg border border-line bg-bg px-3 text-sm text-fg"
                value={p.division}
                onChange={(e) => patch({ division: e.target.value as Division })}
              >
                <option value="novice">{label("novice")}</option>
                <option value="journeyman">{label("journeyman")}</option>
                <option value="master">{label("master")}</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              {(["novice", "journeyman", "master"] as Division[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  className="min-h-11 rounded-lg border border-line px-3 text-sm"
                  onClick={() => loadSample(d)}
                >
                  {label(d)}
                </button>
              ))}
              <button type="button" className="min-h-11 rounded-lg border border-line px-3 text-sm" onClick={() => patch({ results: [] })}>
                {label("clear")}
              </button>
            </div>
            <form
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draftLabel.trim()) return;
                patch({
                  results: [
                    ...p.results,
                    { id: `${Date.now()}`, label: draftLabel.trim(), placement: draftPlace },
                  ],
                });
                setDraftLabel("");
              }}
            >
              <label className="grid gap-1 text-xs text-muted">
                {label("history")}
                <input
                  className="min-h-11 rounded-lg border border-line bg-bg px-3 text-sm text-fg"
                  value={draftLabel}
                  onChange={(e) => setDraftLabel(e.target.value)}
                />
              </label>
              <div className="flex gap-2">
                <select
                  className="min-h-11 flex-1 rounded-lg border border-line bg-bg px-3 text-sm text-fg"
                  value={draftPlace}
                  onChange={(e) => setDraftPlace(e.target.value as Placement)}
                >
                  {PLACEMENTS.map((place) => (
                    <option key={place} value={place}>
                      {label(place)}
                    </option>
                  ))}
                </select>
                <button type="submit" className="min-h-11 rounded-lg bg-gold px-4 text-sm text-bg">
                  {label("addResult")}
                </button>
              </div>
            </form>
            <ul className="grid gap-1 text-sm">
              {p.results.map((r) => (
                <li key={r.id} className="flex justify-between gap-2 text-muted">
                  <span className="text-fg">{r.label}</span>
                  <span>{label(r.placement)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">{label("model")}</p>
          </div>
          <div className="grid gap-3">
            {selected ? (
              <article className="rounded-lg border border-line bg-surface p-5">
                <h2 className="playbill text-3xl">{selected.event.name}</h2>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <Stat label={label("winChance")} value={pct(p.locale, selected.score.pFirst)} />
                  <Stat label={label("top3")} value={pct(p.locale, selected.score.pTop)} />
                  <Stat label={label("expectedPrize")} value={money(p.locale, selected.score.expected)} />
                  <Stat label={label("field")} value={`${selected.score.field}`} />
                  <Stat
                    label={label("optimal")}
                    value={
                      selected.event.contestPrizeUsd == null
                        ? label("unpublished")
                        : money(p.locale, selected.event.contestPrizeUsd)
                    }
                  />
                  <Stat
                    label={label("net")}
                    value={selected.net == null ? "—" : money(p.locale, selected.net)}
                  />
                </dl>
              </article>
            ) : (
              <p className="text-muted">{label("noEvents")}</p>
            )}
            <ol className="grid gap-2">
              {ranked.slice(0, 8).map((row) => (
                <li key={row.event.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 text-left text-sm"
                    onClick={() => setSelectedId(row.event.id)}
                  >
                    <span className="text-fg">{row.event.name}</span>
                    <span className="text-gold">{pct(p.locale, row.score.pFirst)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {tab === "studio" ? (
        <section className="mt-4 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid gap-3 rounded-lg border border-line bg-surface p-4">
            <label className="grid gap-1 text-xs text-muted">
              {label("yourKey")}
              <input
                className="min-h-11 rounded-lg border border-line bg-bg px-3 text-sm text-fg"
                type="password"
                autoComplete="off"
                value={p.apiKey}
                onChange={(e) => patch({ apiKey: e.target.value })}
              />
            </label>
            <p className="text-xs text-muted">{label("keyHint")}</p>
            <a className="text-sm text-gold" href="https://console.x.ai" target="_blank" rel="noreferrer">
              console.x.ai
            </a>
            <label className="flex min-h-11 items-center gap-3 text-sm text-fg">
              <input
                type="checkbox"
                checked={p.hosted}
                onChange={(e) => patch({ hosted: e.target.checked })}
              />
              {label("hosted")}
            </label>
            <p className="text-xs text-muted">{label("noCharge")}</p>
            <div className="rounded-lg bg-bg p-3 text-sm text-muted">
              <p className="text-fg">{label("cloudflare")}</p>
              <p className="mt-2 leading-relaxed">{label("cloudflareBody")}</p>
            </div>
          </div>
          <div className="grid gap-3">
            <p className="text-sm text-muted">{label("coachHint")}</p>
            <textarea
              className="min-h-40 rounded-lg border border-line bg-surface p-4 text-sm text-fg"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              type="button"
              className="min-h-11 justify-self-start rounded-lg bg-gold px-5 text-sm text-bg disabled:opacity-50"
              disabled={busy !== null || !note.trim() || (!p.apiKey && !p.hosted)}
              onClick={onAsk}
            >
              {busy === "ask" ? label("asking") : label("askCoach")}
            </button>
            {!p.apiKey && !p.hosted ? <p className="text-sm text-gold">{label("needKey")}</p> : null}
            {coachError ? <p className="text-sm text-gold">{coachError}</p> : null}
            {reply ? (
              <article className="whitespace-pre-wrap rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-fg">
                {reply}
              </article>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "metrics" ? (
        <section className="mt-4 grid gap-4">
          {!origin ? <p className="text-muted">{label("needPlace")}</p> : null}
          {chartsOn && ranked.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title={label("net")}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={ranked.slice(0, 8).map((r) => ({ name: r.event.city, net: Math.round(r.net ?? 0) }))}>
                    <XAxis dataKey="name" tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
                    <YAxis tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", color: "var(--color-fg)" }} />
                    <Bar dataKey="net" fill="var(--color-gold)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title={label("winChance")}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={ranked.slice(0, 8).map((r) => ({ name: r.event.city, win: Math.round(r.score.pFirst * 100) }))}>
                    <XAxis dataKey="name" tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
                    <YAxis tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", color: "var(--color-fg)" }} />
                    <Bar dataKey="win" fill="var(--color-fg)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          ) : null}
          {selected?.trip ? (
            <ChartCard title={`${selected.event.name} · ${label("tripCost")}`}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  layout="vertical"
                  data={[
                    { name: label("badge"), usd: selected.trip.badge },
                    { name: label("hotel"), usd: selected.trip.hotel },
                    { name: label("round"), usd: selected.trip.travelUsd },
                    { name: label("food"), usd: selected.trip.food },
                  ]}
                >
                  <XAxis type="number" tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fill: "var(--color-muted)", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", color: "var(--color-fg)" }} />
                  <Bar dataKey="usd" fill="var(--color-gold)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : null}
        </section>
      ) : null}

      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-muted">{label("disclaimer")}</p>
    </main>
  );
}

function Stat(props: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-lg bg-bg p-3">
      <div className="flex items-center gap-2 text-xs text-muted">
        {props.icon}
        <span>{props.label}</span>
      </div>
      <p className="mt-1 text-sm text-fg">{props.value}</p>
    </div>
  );
}

function ChartCard(props: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-3 text-sm text-muted">{props.title}</h2>
      {props.children}
    </article>
  );
}
