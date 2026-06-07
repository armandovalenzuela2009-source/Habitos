import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus, Check, Minus, Flame, Calendar as CalendarIcon, BarChart3,
  Home, Settings, X, Trash2, Edit3, ChevronLeft, ChevronRight,
  Sun, Moon, Target, TrendingUp, Award, Heart, Briefcase,
  Brain, Dumbbell, BookOpen, Star, CheckCircle2, LayoutGrid, ListTodo, ArrowUpDown,
  CalendarPlus, ArrowLeft, MapPin, Clock, GraduationCap,
  Flag, ListChecks,
} from "lucide-react";

// ----------------------------- Constants ---------------------------------

const CATEGORIES = [
  { id: "salud", name: "Salud", color: "#10b981", icon: "heart" },
  { id: "trabajo", name: "Trabajo", color: "#3b82f6", icon: "briefcase" },
  { id: "mente", name: "Mente", color: "#8b5cf6", icon: "brain" },
  { id: "ejercicio", name: "Ejercicio", color: "#f59e0b", icon: "dumbbell" },
  { id: "estudio", name: "Estudio", color: "#ec4899", icon: "book" },
  { id: "otro", name: "Otro", color: "#6b7280", icon: "star" },
];

const ICON_MAP = {
  heart: Heart, briefcase: Briefcase, brain: Brain,
  dumbbell: Dumbbell, book: BookOpen, star: Star,
};

const PRIORITIES = [
  { id: "alta", name: "Alta", color: "#ef4444" },
  { id: "media", name: "Media", color: "#f59e0b" },
  { id: "baja", name: "Baja", color: "#10b981" },
];

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const WEEKDAYS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const COLOR_PALETTE = [
  "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#ef4444",
  "#06b6d4", "#84cc16", "#f97316", "#14b8a6", "#a855f7", "#6366f1",
];

const EMOJI_OPTIONS = [
  "💪", "🏃", "🧘", "💧", "📚", "✍️", "🛏️", "🥗", "🍎", "💊",
  "🦷", "🧠", "💼", "💻", "📵", "🎯", "🎨", "🎸", "🌱", "☀️",
  "🌙", "🙏", "❤️", "🔥", "⭐", "🚭", "🍵", "🚶", "🚴", "😴",
];

const EVENT_TYPES = [
  { id: "evento", name: "Evento", color: "#3b82f6" },
  { id: "prueba", name: "Prueba", color: "#ef4444" },
];
const eventTypeOf = (id) => EVENT_TYPES.find((t) => t.id === id) || EVENT_TYPES[0];

const GOAL_TIMEFRAMES = [
  { id: "semanal", name: "Semanal", color: "#10b981" },
  { id: "mensual", name: "Mensual", color: "#3b82f6" },
  { id: "anual", name: "Anual", color: "#8b5cf6" },
  { id: "vida", name: "De vida", color: "#f59e0b" },
];
const timeframeOf = (id) => GOAL_TIMEFRAMES.find((t) => t.id === id) || GOAL_TIMEFRAMES[1];

const ACCOUNTS_KEY = "habitnow:accounts:v1";
const SESSION_KEY = "habitnow:session:v1";
const accountDataKey = (id) => `habitnow:account:${id}:v1`;

// ----------------------------- Date helpers ------------------------------

const toKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const isoWeekday = (d) => (d.getDay() + 6) % 7; // 0=Mon..6=Sun

const addDays = (d, n) => {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
};

const sameDay = (a, b) => toKey(a) === toKey(b);

// ----------------------------- Initial data -------------------------------

const buildInitialData = () => ({
  habits: [],
  logs: {},
  tasks: [],
  events: [],
  goals: [],
  settings: { dark: false, onboarded: false },
});

const emptyHabit = {
  name: "", description: "", category: "salud", priority: "media",
  frequency: { type: "daily" }, goalType: "boolean",
  target: 1, unit: "veces", step: 1,
  color: "#3b82f6", emoji: "🎯",
};

// ----------------------------- Storage layer -----------------------------

async function loadAccounts() {
  try {
    const res = await window.storage.get(ACCOUNTS_KEY);
    if (res && res.value) return JSON.parse(res.value);
  } catch (e) { /* none yet */ }
  return [];
}
async function saveAccounts(accounts) {
  try { await window.storage.set(ACCOUNTS_KEY, JSON.stringify(accounts)); }
  catch (e) { console.error(e); }
}
async function loadSession() {
  try {
    const res = await window.storage.get(SESSION_KEY);
    if (res && res.value) return JSON.parse(res.value).activeId || null;
  } catch (e) { /* none */ }
  return null;
}
async function saveSession(activeId) {
  try { await window.storage.set(SESSION_KEY, JSON.stringify({ activeId })); }
  catch (e) { console.error(e); }
}
async function loadAccountData(id) {
  try {
    const res = await window.storage.get(accountDataKey(id));
    if (res && res.value) return JSON.parse(res.value);
  } catch (e) { /* new */ }
  const fresh = buildInitialData();
  await persistAccountData(id, fresh);
  return fresh;
}
async function persistAccountData(id, data) {
  try { await window.storage.set(accountDataKey(id), JSON.stringify(data)); }
  catch (e) { console.error(e); }
}
async function deleteAccountData(id) {
  try { await window.storage.delete(accountDataKey(id)); }
  catch (e) { console.error(e); }
}

// ----------------------------- Logic helpers ------------------------------

const isScheduledOn = (habit, date) => {
  const f = habit.frequency;
  if (f.type === "daily") return true;
  if (f.type === "weekly_days") return (f.days || []).includes(isoWeekday(date));
  return true; // times_per_week / times_per_month are flexible
};

const getLog = (logs, habitId, date) => {
  const k = toKey(date);
  return (logs[habitId] && logs[habitId][k]) || null;
};

const isCompletedOn = (habit, logs, date) => {
  const log = getLog(logs, habit.id, date);
  return !!(log && log.completed);
};

const calcStreak = (habit, logs) => {
  let streak = 0;
  let d = new Date();
  let guard = 0;
  while (guard < 400) {
    guard++;
    if (isScheduledOn(habit, d)) {
      if (isCompletedOn(habit, logs, d)) {
        streak++;
      } else {
        if (sameDay(d, new Date())) { d = addDays(d, -1); continue; }
        break;
      }
    }
    d = addDays(d, -1);
  }
  return streak;
};

const calcLongestStreak = (habit, logs) => {
  const entries = Object.keys(logs[habit.id] || {})
    .filter((k) => logs[habit.id][k].completed)
    .sort();
  if (entries.length === 0) return 0;
  let longest = 0, current = 0, prev = null;
  for (const k of entries) {
    const [y, m, dd] = k.split("-").map(Number);
    const date = new Date(y, m - 1, dd);
    if (prev) {
      let pd = addDays(date, -1), g = 0;
      while (!isScheduledOn(habit, pd) && g < 14) { pd = addDays(pd, -1); g++; }
      if (toKey(pd) === toKey(prev)) current++; else current = 1;
    } else current = 1;
    longest = Math.max(longest, current);
    prev = date;
  }
  return longest;
};

const calcCompletionRate = (habit, logs) => {
  const today = new Date();
  let scheduled = 0, done = 0;
  for (let i = 0; i < 30; i++) {
    const d = addDays(today, -i);
    if (isScheduledOn(habit, d)) {
      scheduled++;
      if (isCompletedOn(habit, logs, d)) done++;
    }
  }
  return scheduled === 0 ? 0 : Math.round((done / scheduled) * 100);
};

// ----------------------------- Small UI bits ------------------------------

const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[5];
const prioOf = (id) => PRIORITIES.find((p) => p.id === id) || PRIORITIES[1];

const CatIcon = ({ category, size = 18, color }) => {
  const cat = catOf(category);
  const Icon = ICON_MAP[cat.icon] || Star;
  return <Icon size={size} color={color || cat.color} />;
};

const ProgressRing = ({ pct, size = 44, stroke = 4, color = "#3b82f6", track = "#e5e7eb" }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }} />
    </svg>
  );
};

// ----------------------------- Habit Card ---------------------------------

function HabitCard({ habit, log, dark, onToggle, onAdjust, onEdit, onDelete, streak }) {
  const cat = catOf(habit.category);
  const color = habit.color || cat.color;
  const prio = prioOf(habit.priority);
  const completed = !!(log && log.completed);
  const value = (log && log.value) || 0;
  const pct = habit.goalType === "quantitative"
    ? Math.min(100, Math.round((value / habit.target) * 100))
    : completed ? 100 : 0;

  const [justDone, setJustDone] = useState(false);
  useEffect(() => {
    if (completed) {
      setJustDone(true);
      const t = setTimeout(() => setJustDone(false), 600);
      return () => clearTimeout(t);
    }
  }, [completed]);

  return (
    <div className={`relative rounded-2xl p-4 mb-3 overflow-hidden transition-all duration-300 border ${
      dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"
    } ${completed ? "opacity-90" : ""} shadow-sm hover:shadow-md`}>
      <span className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: color }} />
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center rounded-xl shrink-0 text-2xl"
          style={{ width: 44, height: 44, background: `${color}1a` }}>
          {habit.emoji || "🎯"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`font-semibold truncate ${dark ? "text-white" : "text-gray-900"} ${completed ? "line-through opacity-60" : ""}`}>
              {habit.name}
            </p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
              style={{ background: `${prio.color}1a`, color: prio.color }}>
              {prio.name}
            </span>
          </div>
          {habit.description && (
            <p className={`text-xs truncate ${dark ? "text-gray-400" : "text-gray-500"}`}>{habit.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1">
            {streak > 0 && (
              <span className={`flex items-center gap-1 text-xs font-medium ${justDone ? "scale-110" : ""} transition-transform`}
                style={{ color: "#f59e0b" }}>
                <Flame size={13} /> {streak}
              </span>
            )}
            {habit.goalType === "quantitative" && (
              <span className={`text-xs ${dark ? "text-gray-400" : "text-gray-500"}`}>
                {value} / {habit.target} {habit.unit}
              </span>
            )}
          </div>
        </div>

        {habit.goalType === "boolean" ? (
          <button onClick={() => onToggle(habit)}
            className={`shrink-0 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 ${justDone ? "scale-110" : ""}`}
            style={{
              width: 40, height: 40,
              background: completed ? color : "transparent",
              border: `2px solid ${completed ? color : dark ? "#4b5563" : "#d1d5db"}`,
            }}>
            {completed && <Check size={22} color="#fff" strokeWidth={3} />}
          </button>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => onAdjust(habit, -habit.step)}
              className={`rounded-lg flex items-center justify-center active:scale-90 transition ${dark ? "bg-gray-700 text-gray-200" : "bg-gray-100 text-gray-700"}`}
              style={{ width: 32, height: 32 }}>
              <Minus size={16} />
            </button>
            <div className="relative flex items-center justify-center" style={{ width: 44, height: 44 }}>
              <ProgressRing pct={pct} color={color} track={dark ? "#374151" : "#e5e7eb"} />
              <span className="absolute text-[10px] font-bold" style={{ color }}>{pct}%</span>
            </div>
            <button onClick={() => onAdjust(habit, habit.step)}
              className="rounded-lg flex items-center justify-center active:scale-90 transition text-white"
              style={{ width: 32, height: 32, background: color }}>
              <Plus size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-1 mt-2 justify-end">
        <button onClick={() => onEdit(habit)}
          className={`p-1.5 rounded-lg ${dark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-400"}`}>
          <Edit3 size={14} />
        </button>
        <button onClick={() => onDelete(habit)}
          className={`p-1.5 rounded-lg ${dark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-400"}`}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ----------------------------- Habit Modal --------------------------------

function HabitModal({ open, onClose, onSave, editing, dark }) {
  const [form, setForm] = useState(emptyHabit);

  useEffect(() => {
    if (!open) return;
    if (editing) setForm({ ...emptyHabit, ...JSON.parse(JSON.stringify(editing)) });
    else setForm(JSON.parse(JSON.stringify(emptyHabit)));
  }, [editing, open]);

  if (!open) return null;

  const upd = (patch) => setForm((f) => ({ ...f, ...patch }));
  const updFreq = (patch) => setForm((f) => ({ ...f, frequency: { ...f.frequency, ...patch } }));
  const toggleDay = (i) => setForm((f) => {
    const days = f.frequency.days || [];
    const next = days.includes(i) ? days.filter((d) => d !== i) : [...days, i].sort((a, b) => a - b);
    return { ...f, frequency: { ...f.frequency, days: next } };
  });
  const changeCount = (delta) => setForm((f) => ({
    ...f, frequency: { ...f.frequency, count: Math.max(1, (f.frequency.count || 1) + delta) },
  }));

  const canSave = form.name.trim().length > 0;
  const panel = dark ? "bg-gray-800 text-white" : "bg-white text-gray-900";
  const input = dark ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400";
  const label = dark ? "text-gray-300" : "text-gray-600";
  const handleOverlay = (e) => { if (e.target === e.currentTarget) onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onMouseDown={handleOverlay}>
      <div className={`${panel} w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col`} style={{ maxHeight: "92vh" }}>
        <div className={`flex items-center justify-between p-5 border-b shrink-0 ${dark ? "border-gray-700" : "border-gray-100"}`}>
          <h2 className="text-lg font-bold">{editing ? "Editar hábito" : "Nuevo hábito"}</h2>
          <button onClick={onClose} className={`p-2 rounded-full ${dark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-2xl"
            style={{ background: `${form.color}14`, border: `1px solid ${form.color}33` }}>
            <span className="flex items-center justify-center rounded-xl text-2xl shrink-0"
              style={{ width: 48, height: 48, background: `${form.color}26` }}>
              {form.emoji}
            </span>
            <div className="min-w-0">
              <p className="font-semibold truncate">{form.name.trim() || "Nombre del hábito"}</p>
              <p className={`text-xs truncate ${label}`}>{form.description.trim() || "Vista previa"}</p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className={`text-xs font-medium ${label}`}>Nombre del hábito</label>
            <input value={form.name} onChange={(e) => upd({ name: e.target.value })}
              placeholder="Ej. Beber agua" maxLength={40}
              className={`w-full mt-1 px-3 py-2.5 rounded-xl border outline-none focus:border-blue-400 ${input}`} />
          </div>

          {/* Description */}
          <div>
            <label className={`text-xs font-medium ${label}`}>Descripción (opcional)</label>
            <textarea value={form.description} onChange={(e) => upd({ description: e.target.value })}
              placeholder="Añade una nota o motivación..." rows={3} maxLength={160}
              className={`w-full mt-1 px-3 py-2.5 rounded-xl border outline-none resize-none focus:border-blue-400 ${input}`} />
            <p className={`text-[10px] mt-1 text-right ${label}`}>{form.description.length}/160</p>
          </div>

          {/* Emoji */}
          <div>
            <label className={`text-xs font-medium ${label}`}>Icono</label>
            <div className="grid grid-cols-10 gap-1.5 mt-2">
              {EMOJI_OPTIONS.map((em) => (
                <button key={em} onClick={() => upd({ emoji: em })}
                  className="aspect-square rounded-lg flex items-center justify-center text-lg transition"
                  style={{
                    background: form.emoji === em ? `${form.color}26` : (dark ? "#374151" : "#f3f4f6"),
                    outline: form.emoji === em ? `2px solid ${form.color}` : "none",
                  }}>
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className={`text-xs font-medium ${label}`}>Color</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {COLOR_PALETTE.map((col) => (
                <button key={col} onClick={() => upd({ color: col })}
                  className="rounded-full transition flex items-center justify-center"
                  style={{
                    width: 32, height: 32, background: col,
                    outline: form.color === col ? `2px solid ${dark ? "#fff" : "#111"}` : "none",
                    outlineOffset: 2,
                  }}>
                  {form.color === col && <Check size={16} color="#fff" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className={`text-xs font-medium ${label}`}>Categoría</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => upd({ category: c.id })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition border-2"
                  style={{
                    background: form.category === c.id ? `${c.color}1a` : "transparent",
                    borderColor: form.category === c.id ? c.color : (dark ? "#374151" : "#e5e7eb"),
                    color: form.category === c.id ? c.color : (dark ? "#9ca3af" : "#6b7280"),
                  }}>
                  <CatIcon category={c.id} size={15} color={c.color} /> {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className={`text-xs font-medium ${label}`}>Prioridad</label>
            <div className="flex gap-2 mt-2">
              {PRIORITIES.map((p) => (
                <button key={p.id} onClick={() => upd({ priority: p.id })}
                  className="flex-1 px-3 py-2 rounded-xl text-sm font-medium transition border-2"
                  style={{
                    background: form.priority === p.id ? `${p.color}1a` : "transparent",
                    borderColor: form.priority === p.id ? p.color : (dark ? "#374151" : "#e5e7eb"),
                    color: form.priority === p.id ? p.color : (dark ? "#9ca3af" : "#6b7280"),
                  }}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className={`text-xs font-medium ${label}`}>Frecuencia</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                { id: "daily", name: "Diaria" },
                { id: "weekly_days", name: "Días específicos" },
                { id: "times_per_week", name: "X / semana" },
                { id: "times_per_month", name: "X / mes" },
              ].map((opt) => (
                <button key={opt.id} onClick={() => updFreq({
                  type: opt.id,
                  days: opt.id === "weekly_days" ? (form.frequency.days || [0]) : undefined,
                  count: opt.id.startsWith("times") ? (form.frequency.count || 3) : undefined,
                })}
                  className="px-3 py-2 rounded-xl text-sm font-medium transition border-2"
                  style={{
                    background: form.frequency.type === opt.id ? "#3b82f61a" : "transparent",
                    borderColor: form.frequency.type === opt.id ? "#3b82f6" : (dark ? "#374151" : "#e5e7eb"),
                    color: form.frequency.type === opt.id ? "#3b82f6" : (dark ? "#9ca3af" : "#6b7280"),
                  }}>
                  {opt.name}
                </button>
              ))}
            </div>

            {form.frequency.type === "weekly_days" && (
              <div className="flex gap-1.5 mt-3">
                {WEEKDAYS.map((d, i) => {
                  const on = (form.frequency.days || []).includes(i);
                  return (
                    <button key={i} onClick={() => toggleDay(i)}
                      className="flex-1 py-2 rounded-lg text-xs font-bold transition"
                      style={{
                        background: on ? "#3b82f6" : (dark ? "#374151" : "#f3f4f6"),
                        color: on ? "#fff" : (dark ? "#9ca3af" : "#6b7280"),
                      }}>
                      {d}
                    </button>
                  );
                })}
              </div>
            )}

            {(form.frequency.type === "times_per_week" || form.frequency.type === "times_per_month") && (
              <div className="flex items-center gap-3 mt-3">
                <span className={`text-sm ${label}`}>Veces:</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => changeCount(-1)}
                    className={`w-8 h-8 rounded-lg ${dark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-700"} flex items-center justify-center active:scale-90 transition`}>
                    <Minus size={14} />
                  </button>
                  <span className="font-bold w-6 text-center">{form.frequency.count || 1}</span>
                  <button type="button" onClick={() => changeCount(1)}
                    className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center active:scale-90 transition">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Goal type */}
          <div>
            <label className={`text-xs font-medium ${label}`}>Tipo de meta</label>
            <div className="flex gap-2 mt-2">
              <button onClick={() => upd({ goalType: "boolean" })}
                className="flex-1 px-3 py-2 rounded-xl text-sm font-medium transition border-2"
                style={{
                  background: form.goalType === "boolean" ? "#10b9811a" : "transparent",
                  borderColor: form.goalType === "boolean" ? "#10b981" : (dark ? "#374151" : "#e5e7eb"),
                  color: form.goalType === "boolean" ? "#10b981" : (dark ? "#9ca3af" : "#6b7280"),
                }}>
                Sí / No
              </button>
              <button onClick={() => upd({ goalType: "quantitative" })}
                className="flex-1 px-3 py-2 rounded-xl text-sm font-medium transition border-2"
                style={{
                  background: form.goalType === "quantitative" ? "#8b5cf61a" : "transparent",
                  borderColor: form.goalType === "quantitative" ? "#8b5cf6" : (dark ? "#374151" : "#e5e7eb"),
                  color: form.goalType === "quantitative" ? "#8b5cf6" : (dark ? "#9ca3af" : "#6b7280"),
                }}>
                Cuantitativa
              </button>
            </div>

            {form.goalType === "quantitative" && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div>
                  <label className={`text-[10px] ${label}`}>Meta</label>
                  <input type="number" value={form.target} min={1}
                    onChange={(e) => upd({ target: Math.max(1, parseInt(e.target.value) || 1) })}
                    className={`w-full mt-1 px-2 py-2 rounded-lg border outline-none text-sm ${input}`} />
                </div>
                <div>
                  <label className={`text-[10px] ${label}`}>Unidad</label>
                  <input value={form.unit} onChange={(e) => upd({ unit: e.target.value })}
                    className={`w-full mt-1 px-2 py-2 rounded-lg border outline-none text-sm ${input}`} />
                </div>
                <div>
                  <label className={`text-[10px] ${label}`}>Paso (+/-)</label>
                  <input type="number" value={form.step} min={1}
                    onChange={(e) => upd({ step: Math.max(1, parseInt(e.target.value) || 1) })}
                    className={`w-full mt-1 px-2 py-2 rounded-lg border outline-none text-sm ${input}`} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`p-5 border-t shrink-0 ${dark ? "border-gray-700" : "border-gray-100"}`}>
          <button onClick={() => canSave && onSave(form)} disabled={!canSave}
            className={`w-full py-3 rounded-xl font-bold text-white transition ${
              canSave ? "bg-blue-500 hover:bg-blue-600 active:scale-95" : "bg-gray-300 cursor-not-allowed"
            }`}>
            {editing ? "Guardar cambios" : "Crear hábito"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------- Today View ---------------------------------

function TodayView({ habits, logs, dark, onToggle, onAdjust, onEdit, onDelete, onCreate }) {
  const [filter, setFilter] = useState("all");
  const today = new Date();

  const todays = useMemo(() => habits.filter((h) => isScheduledOn(h, today)), [habits]);
  const filtered = filter === "all" ? todays : todays.filter((h) => h.category === filter);
  const doneCount = todays.filter((h) => isCompletedOn(h, logs, today)).length;
  const pct = todays.length ? Math.round((doneCount / todays.length) * 100) : 0;
  const usedCats = [...new Set(todays.map((h) => h.category))];

  if (habits.length === 0) {
    return (
      <div className="px-4 pb-4">
        <div className={`text-center py-16 px-6 rounded-3xl ${dark ? "bg-gray-800" : "bg-white border border-gray-100"}`}>
          <div className="flex items-center justify-center rounded-2xl mx-auto mb-4"
            style={{ width: 72, height: 72, background: "#3b82f61a" }}>
            <Target size={36} color="#3b82f6" />
          </div>
          <p className={`font-bold text-lg ${dark ? "text-white" : "text-gray-900"}`}>Empieza tu primer hábito</p>
          <p className={`text-sm mt-1 mb-5 ${dark ? "text-gray-400" : "text-gray-500"}`}>
            Tu cuenta está lista. Crea un hábito y guardaremos tu progreso desde hoy.
          </p>
          <button onClick={onCreate}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition active:scale-95">
            <Plus size={18} /> Crear mi primer hábito
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4">
      <div className={`rounded-3xl p-5 mb-4 ${dark ? "bg-gradient-to-br from-blue-600 to-indigo-700" : "bg-gradient-to-br from-blue-500 to-indigo-600"} text-white shadow-lg`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">{WEEKDAYS_FULL[isoWeekday(today)]}, {today.getDate()} {MONTHS[today.getMonth()]}</p>
            <p className="text-2xl font-bold mt-1">{doneCount} de {todays.length} hábitos</p>
            <p className="text-sm opacity-90 mt-0.5">{pct === 100 && todays.length > 0 ? "¡Día completado! 🎉" : "completados hoy"}</p>
          </div>
          <div className="relative flex items-center justify-center">
            <ProgressRing pct={pct} size={72} stroke={7} color="#fff" track="rgba(255,255,255,0.25)" />
            <span className="absolute text-lg font-bold">{pct}%</span>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-white/25 overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {usedCats.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
          <button onClick={() => setFilter("all")}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition ${
              filter === "all" ? "bg-blue-500 text-white" : dark ? "bg-gray-800 text-gray-300" : "bg-white text-gray-600 border border-gray-200"
            }`}>
            Todas
          </button>
          {usedCats.map((cid) => {
            const c = catOf(cid);
            const on = filter === cid;
            return (
              <button key={cid} onClick={() => setFilter(cid)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition"
                style={{
                  background: on ? c.color : (dark ? "#1f2937" : "#fff"),
                  color: on ? "#fff" : c.color,
                  border: on ? "none" : `1px solid ${c.color}40`,
                }}>
                <CatIcon category={cid} size={14} color={on ? "#fff" : c.color} /> {c.name}
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className={`text-center py-16 ${dark ? "text-gray-500" : "text-gray-400"}`}>
          <Target size={48} className="mx-auto mb-3 opacity-50" />
          <p className="font-medium">No hay hábitos en esta categoría</p>
        </div>
      ) : (
        filtered.map((h) => (
          <HabitCard key={h.id} habit={h} log={getLog(logs, h.id, today)} dark={dark}
            onToggle={onToggle} onAdjust={onAdjust} onEdit={onEdit} onDelete={onDelete}
            streak={calcStreak(h, logs)} />
        ))
      )}
    </div>
  );
}

// ----------------------------- Day Detail ----------------------------------

function DayDetail({ date, habits, logs, dark, onClose }) {
  if (!date) return null;
  const panel = dark ? "bg-gray-800 text-white" : "bg-white text-gray-900";
  const sub = dark ? "text-gray-400" : "text-gray-500";

  const scheduled = habits.filter((h) => isScheduledOn(h, date));
  const doneCount = scheduled.filter((h) => isCompletedOn(h, logs, date)).length;
  const pct = scheduled.length ? Math.round((doneCount / scheduled.length) * 100) : 0;
  const isFuture = date > new Date() && !sameDay(date, new Date());
  const dateLabel = `${WEEKDAYS_FULL[isoWeekday(date)]}, ${date.getDate()} de ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

  return (
    <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${panel} w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col`} style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}>
        <div className={`flex items-center justify-between p-5 border-b shrink-0 ${dark ? "border-gray-700" : "border-gray-100"}`}>
          <div className="min-w-0">
            <h2 className="text-base font-bold capitalize truncate">{dateLabel}</h2>
            {scheduled.length > 0 && !isFuture && (
              <p className={`text-xs ${sub}`}>{doneCount} de {scheduled.length} completados · {pct}%</p>
            )}
          </div>
          <button onClick={onClose} className={`p-2 rounded-full shrink-0 ${dark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-2">
          {scheduled.length === 0 ? (
            <div className={`text-center py-10 ${sub}`}>
              <CalendarIcon size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No había hábitos programados este día</p>
            </div>
          ) : isFuture ? (
            <div className={`text-center py-10 ${sub}`}>
              <CalendarIcon size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Día futuro · {scheduled.length} hábito{scheduled.length !== 1 ? "s" : ""} programado{scheduled.length !== 1 ? "s" : ""}</p>
            </div>
          ) : (
            scheduled.map((h) => {
              const color = h.color || catOf(h.category).color;
              const log = getLog(logs, h.id, date);
              const completed = !!(log && log.completed);
              const value = (log && log.value) || 0;
              const qPct = h.goalType === "quantitative" ? Math.min(100, Math.round((value / h.target) * 100)) : (completed ? 100 : 0);
              return (
                <div key={h.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${dark ? "border-gray-700" : "border-gray-100"}`}
                  style={{ borderLeft: `4px solid ${color}` }}>
                  <span className="flex items-center justify-center rounded-xl shrink-0 text-xl"
                    style={{ width: 40, height: 40, background: `${color}1a` }}>
                    {h.emoji || "🎯"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${completed ? "line-through opacity-60" : ""}`}>{h.name}</p>
                    {h.goalType === "quantitative" ? (
                      <>
                        <p className={`text-xs ${sub}`}>{value} / {h.target} {h.unit}</p>
                        <div className={`mt-1 h-1.5 rounded-full overflow-hidden ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
                          <div className="h-full rounded-full" style={{ width: `${qPct}%`, background: color }} />
                        </div>
                      </>
                    ) : (
                      <p className="text-xs font-medium" style={{ color: completed ? "#10b981" : (dark ? "#9ca3af" : "#9ca3af") }}>
                        {completed ? "Completado" : "No completado"}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full flex items-center justify-center"
                    style={{
                      width: 28, height: 28,
                      background: completed ? color : "transparent",
                      border: `2px solid ${completed ? color : (dark ? "#4b5563" : "#d1d5db")}`,
                    }}>
                    {completed && <Check size={16} color="#fff" strokeWidth={3} />}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------- Calendar View -------------------------------

function CalendarView({ habits, logs, dark }) {
  const [cursor, setCursor] = useState(new Date());
  const [selectedHabit, setSelectedHabit] = useState("all");
  const [detailDate, setDetailDate] = useState(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startOffset = isoWeekday(new Date(year, month, 1));
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const relevantHabits = selectedHabit === "all" ? habits : habits.filter((h) => h.id === selectedHabit);
  const today = new Date();

  const dayStatus = (date) => {
    if (!date) return null;
    const scheduled = relevantHabits.filter((h) => isScheduledOn(h, date));
    if (scheduled.length === 0) return null;
    const done = scheduled.filter((h) => isCompletedOn(h, logs, date)).length;
    return { total: scheduled.length, done, ratio: done / scheduled.length };
  };

  if (habits.length === 0) {
    return (
      <div className="px-4 pb-4">
        <div className={`text-center py-16 ${dark ? "text-gray-500" : "text-gray-400"}`}>
          <CalendarIcon size={48} className="mx-auto mb-3 opacity-50" />
          <p className="font-medium">Aún no hay nada que mostrar</p>
          <p className="text-sm">Crea hábitos para ver tu progreso aquí</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4">
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        <button onClick={() => setSelectedHabit("all")}
          className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium ${
            selectedHabit === "all" ? "bg-blue-500 text-white" : dark ? "bg-gray-800 text-gray-300" : "bg-white text-gray-600 border border-gray-200"
          }`}>
          Todos
        </button>
        {habits.map((h) => {
          const color = h.color || catOf(h.category).color;
          const on = selectedHabit === h.id;
          return (
            <button key={h.id} onClick={() => setSelectedHabit(h.id)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                background: on ? color : (dark ? "#1f2937" : "#fff"),
                color: on ? "#fff" : color,
                border: on ? "none" : `1px solid ${color}40`,
              }}>
              <span>{h.emoji || "🎯"}</span> {h.name}
            </button>
          );
        })}
      </div>

      <div className={`rounded-3xl p-4 ${dark ? "bg-gray-800" : "bg-white border border-gray-100"} shadow-sm`}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))}
            className={`p-2 rounded-full ${dark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`}>
            <ChevronLeft size={20} />
          </button>
          <h3 className={`font-bold ${dark ? "text-white" : "text-gray-900"}`}>{MONTHS[month]} {year}</h3>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))}
            className={`p-2 rounded-full ${dark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`}>
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((d) => (
            <div key={d} className={`text-center text-xs font-semibold ${dark ? "text-gray-500" : "text-gray-400"}`}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const status = dayStatus(date);
            const isToday = sameDay(date, today);
            const isFuture = date > today && !isToday;
            let bg = "transparent", color = dark ? "#9ca3af" : "#6b7280";
            if (status && !isFuture) {
              if (status.ratio === 1) { bg = "#10b981"; color = "#fff"; }
              else if (status.ratio > 0) { bg = "#f59e0b"; color = "#fff"; }
              else { bg = dark ? "#374151" : "#f3f4f6"; }
            }
            return (
              <div key={i} className="aspect-square flex items-center justify-center">
                <button onClick={(e) => { e.stopPropagation(); setDetailDate(date); }}
                  className="w-full h-full rounded-xl flex items-center justify-center text-sm font-medium relative transition hover:scale-105 active:scale-95"
                  style={{ background: bg, color, border: isToday ? "2px solid #3b82f6" : "none", opacity: isFuture ? 0.4 : 1 }}>
                  {date.getDate()}
                  {status && status.ratio === 1 && !isFuture && (
                    <Check size={10} className="absolute bottom-0.5" color="#fff" strokeWidth={3} />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4 mt-4 text-xs">
          <span className="flex items-center gap-1.5" style={{ color: dark ? "#9ca3af" : "#6b7280" }}>
            <span className="w-3 h-3 rounded" style={{ background: "#10b981" }} /> Completo
          </span>
          <span className="flex items-center gap-1.5" style={{ color: dark ? "#9ca3af" : "#6b7280" }}>
            <span className="w-3 h-3 rounded" style={{ background: "#f59e0b" }} /> Parcial
          </span>
          <span className="flex items-center gap-1.5" style={{ color: dark ? "#9ca3af" : "#6b7280" }}>
            <span className="w-3 h-3 rounded" style={{ background: dark ? "#374151" : "#f3f4f6" }} /> Pendiente
          </span>
        </div>
        <p className={`text-center text-[11px] mt-3 ${dark ? "text-gray-500" : "text-gray-400"}`}>
          Toca cualquier día para ver el detalle
        </p>
      </div>

      <DayDetail date={detailDate} habits={relevantHabits} logs={logs} dark={dark} onClose={() => setDetailDate(null)} />
    </div>
  );
}

// ----------------------------- Stats View ----------------------------------

function StatsView({ habits, logs, dark }) {
  const today = new Date();
  const weekData = useMemo(() => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(today, -i);
      const scheduled = habits.filter((h) => isScheduledOn(h, d));
      const done = scheduled.filter((h) => isCompletedOn(h, logs, d)).length;
      arr.push({ label: WEEKDAYS[isoWeekday(d)], pct: scheduled.length ? Math.round((done / scheduled.length) * 100) : 0 });
    }
    return arr;
  }, [habits, logs]);

  const overallRate = useMemo(() => {
    if (habits.length === 0) return 0;
    return Math.round(habits.reduce((s, h) => s + calcCompletionRate(h, logs), 0) / habits.length);
  }, [habits, logs]);

  const totalStreaks = habits.reduce((s, h) => s + calcStreak(h, logs), 0);
  const bestStreak = habits.reduce((m, h) => Math.max(m, calcLongestStreak(h, logs)), 0);

  const card = dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100";
  const txt = dark ? "text-white" : "text-gray-900";
  const sub = dark ? "text-gray-400" : "text-gray-500";

  if (habits.length === 0) {
    return (
      <div className="px-4 pb-4">
        <div className={`text-center py-16 ${sub}`}>
          <BarChart3 size={48} className="mx-auto mb-3 opacity-50" />
          <p className="font-medium">Sin estadísticas todavía</p>
          <p className="text-sm">Tus métricas aparecerán cuando empieces a registrar hábitos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-2xl p-4 border ${card} text-center`}>
          <TrendingUp size={20} className="mx-auto mb-1 text-blue-500" />
          <p className={`text-2xl font-bold ${txt}`}>{overallRate}%</p>
          <p className={`text-xs ${sub}`}>Tasa global</p>
        </div>
        <div className={`rounded-2xl p-4 border ${card} text-center`}>
          <Flame size={20} className="mx-auto mb-1 text-amber-500" />
          <p className={`text-2xl font-bold ${txt}`}>{totalStreaks}</p>
          <p className={`text-xs ${sub}`}>Rachas activas</p>
        </div>
        <div className={`rounded-2xl p-4 border ${card} text-center`}>
          <Award size={20} className="mx-auto mb-1 text-purple-500" />
          <p className={`text-2xl font-bold ${txt}`}>{bestStreak}</p>
          <p className={`text-xs ${sub}`}>Mejor racha</p>
        </div>
      </div>

      <div className={`rounded-2xl p-5 border ${card}`}>
        <h3 className={`font-bold mb-4 ${txt}`}>Progreso de la semana</h3>
        <div className="flex items-end justify-between gap-2 h-36">
          {weekData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex items-end justify-center" style={{ height: "100px" }}>
                <div className="w-full max-w-[28px] rounded-t-lg transition-all duration-500 relative"
                  style={{
                    height: `${Math.max(4, d.pct)}%`,
                    background: d.pct >= 80 ? "#10b981" : d.pct >= 40 ? "#3b82f6" : d.pct > 0 ? "#f59e0b" : (dark ? "#374151" : "#e5e7eb"),
                  }}>
                  <span className={`absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold ${sub}`}>{d.pct}%</span>
                </div>
              </div>
              <span className={`text-xs font-medium ${sub}`}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={`rounded-2xl p-5 border ${card}`}>
        <h3 className={`font-bold mb-3 ${txt}`}>Detalle por hábito</h3>
        <div className="space-y-3">
          {habits.map((h) => {
            const color = h.color || catOf(h.category).color;
            const rate = calcCompletionRate(h, logs);
            const streak = calcStreak(h, logs);
            const longest = calcLongestStreak(h, logs);
            return (
              <div key={h.id} className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-xl shrink-0 text-lg"
                  style={{ width: 38, height: 38, background: `${color}1a` }}>
                  {h.emoji || "🎯"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`font-medium text-sm truncate ${txt}`}>{h.name}</p>
                    <span className="text-xs font-semibold" style={{ color }}>{rate}%</span>
                  </div>
                  <div className={`mt-1.5 h-1.5 rounded-full overflow-hidden ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${rate}%`, background: color }} />
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[11px] flex items-center gap-1 text-amber-500"><Flame size={11} /> {streak} actual</span>
                    <span className={`text-[11px] flex items-center gap-1 ${sub}`}><Award size={11} /> {longest} récord</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ----------------------------- Settings View -------------------------------

function SettingsView({ habits, dark, toggleDark, onResetData, onShowTutorial, accountName, accountCreatedAt, onLogout }) {
  const card = dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100";
  const txt = dark ? "text-white" : "text-gray-900";
  const sub = dark ? "text-gray-400" : "text-gray-500";

  const createdLabel = accountCreatedAt
    ? (() => { const [y, m, d] = accountCreatedAt.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; })()
    : "";

  return (
    <div className="px-4 pb-4 space-y-4">
      <div className={`rounded-2xl p-5 border ${card}`}>
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center rounded-full font-bold text-white shrink-0"
            style={{ width: 48, height: 48, background: "#3b82f6" }}>
            {(accountName || "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className={`font-bold truncate ${txt}`}>{accountName}</p>
            <p className={`text-xs ${sub}`}>Cuenta creada el {createdLabel}</p>
          </div>
        </div>
        <button onClick={onLogout}
          className={`w-full mt-4 py-2.5 rounded-xl font-medium transition active:scale-95 ${dark ? "bg-gray-700 text-gray-100" : "bg-gray-100 text-gray-700"}`}>
          Cerrar sesión
        </button>
      </div>

      <div className={`rounded-2xl p-5 border ${card}`}>
        <h3 className={`font-bold mb-3 ${txt}`}>Apariencia</h3>
        <button onClick={toggleDark} className={`w-full flex items-center justify-between p-3 rounded-xl ${dark ? "bg-gray-700" : "bg-gray-50"}`}>
          <span className={`flex items-center gap-2 font-medium ${txt}`}>
            {dark ? <Moon size={18} /> : <Sun size={18} />} Modo {dark ? "oscuro" : "claro"}
          </span>
          <span className={`relative w-12 h-6 rounded-full transition ${dark ? "bg-blue-500" : "bg-gray-300"}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${dark ? "left-6" : "left-0.5"}`} />
          </span>
        </button>
      </div>

      <div className={`rounded-2xl p-5 border ${card}`}>
        <h3 className={`font-bold mb-3 ${txt}`}>Categorías</h3>
        <div className="space-y-2">
          {CATEGORIES.map((c) => {
            const count = habits.filter((h) => h.category === c.id).length;
            return (
              <div key={c.id} className="flex items-center justify-between">
                <span className={`flex items-center gap-2.5 font-medium ${txt}`}>
                  <span className="flex items-center justify-center rounded-lg" style={{ width: 32, height: 32, background: `${c.color}1a` }}>
                    <CatIcon category={c.id} size={16} />
                  </span>
                  {c.name}
                </span>
                <span className={`text-sm ${sub}`}>{count} hábito{count !== 1 ? "s" : ""}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`rounded-2xl p-5 border ${card}`}>
        <h3 className={`font-bold mb-1 ${txt}`}>Ayuda</h3>
        <p className={`text-xs mb-3 ${sub}`}>¿Necesitas un recordatorio de cómo funciona la app?</p>
        <button onClick={onShowTutorial}
          className={`w-full py-2.5 rounded-xl font-medium transition active:scale-95 ${dark ? "bg-gray-700 text-gray-100" : "bg-gray-100 text-gray-700"}`}>
          Ver tutorial de nuevo
        </button>
      </div>

      <div className={`rounded-2xl p-5 border ${card}`}>
        <h3 className={`font-bold mb-1 ${txt}`}>Datos</h3>
        <p className={`text-xs mb-3 ${sub}`}>Borra todos tus hábitos e historial y empieza de cero.</p>
        <button onClick={onResetData}
          className="w-full py-2.5 rounded-xl font-medium text-red-500 border hover:bg-red-50 transition active:scale-95"
          style={{ borderColor: dark ? "#7f1d1d" : "#fecaca", background: dark ? "transparent" : "" }}>
          Borrar todos los datos
        </button>
      </div>

      <p className={`text-center text-xs ${sub} pt-2`}>HabitNow Clone · React + Tailwind</p>
    </div>
  );
}

// ----------------------------- Confirm Dialog ------------------------------

function ConfirmDialog({ open, title, message, onConfirm, onCancel, dark }) {
  if (!open) return null;
  const panel = dark ? "bg-gray-800 text-white" : "bg-white text-gray-900";
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className={`${panel} rounded-2xl p-5 max-w-xs w-full shadow-2xl`}>
        <h3 className="font-bold text-lg">{title}</h3>
        <p className={`text-sm mt-1 ${dark ? "text-gray-400" : "text-gray-500"}`}>{message}</p>
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className={`flex-1 py-2.5 rounded-xl font-medium ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 active:scale-95 transition">
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------- Auth Screen ---------------------------------

function AuthScreen({ accounts, dark, onCreate, onLogin, onDeleteAccount }) {
  const [mode, setMode] = useState(accounts.length > 0 ? "welcome" : "create");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [selected, setSelected] = useState(null);
  const [loginPin, setLoginPin] = useState("");
  const [error, setError] = useState("");

  const bg = dark ? "bg-gray-900" : "bg-gradient-to-b from-blue-50 to-gray-50";
  const txt = dark ? "text-white" : "text-gray-900";
  const sub = dark ? "text-gray-400" : "text-gray-500";
  const input = dark ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-900";

  const submitCreate = () => {
    if (name.trim().length < 2) { setError("Escribe un nombre de al menos 2 letras."); return; }
    if (pin && !/^\d{4}$/.test(pin)) { setError("El PIN debe tener 4 dígitos (o déjalo vacío)."); return; }
    onCreate(name.trim(), pin || null);
  };
  const submitLogin = () => {
    if (selected.pin && selected.pin !== loginPin) { setError("PIN incorrecto."); return; }
    onLogin(selected.id);
  };

  return (
    <div className={`${bg} min-h-screen`} style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="max-w-md mx-auto min-h-screen flex flex-col px-6 py-10 justify-center">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex items-center justify-center rounded-3xl mb-4" style={{ width: 80, height: 80, background: "#3b82f61a" }}>
            <Target size={40} color="#3b82f6" />
          </div>
          <h1 className={`text-3xl font-bold ${txt}`}>HabitNow</h1>
          <p className={`text-sm mt-1 ${sub}`}>Construye mejores hábitos, un día a la vez</p>
        </div>

        {mode === "welcome" && (
          <div className="space-y-3">
            <p className={`text-sm font-medium ${sub} px-1`}>Elige tu cuenta</p>
            {accounts.map((a) => (
              <div key={a.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
                <button onClick={() => { setSelected(a); setLoginPin(""); setError(""); setMode("login"); }}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <span className="flex items-center justify-center rounded-full shrink-0 font-bold text-white" style={{ width: 44, height: 44, background: "#3b82f6" }}>
                    {a.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className={`block font-semibold truncate ${txt}`}>{a.name}</span>
                    <span className={`block text-xs ${sub}`}>{a.pin ? "Protegida con PIN" : "Sin PIN"}</span>
                  </span>
                </button>
                <button onClick={() => onDeleteAccount(a)} className={`p-2 rounded-lg shrink-0 ${dark ? "hover:bg-gray-700 text-gray-500" : "hover:bg-gray-100 text-gray-400"}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button onClick={() => { setName(""); setPin(""); setError(""); setMode("create"); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-blue-500 border-2 border-dashed transition active:scale-95"
              style={{ borderColor: dark ? "#1e3a8a" : "#bfdbfe" }}>
              <Plus size={18} /> Crear cuenta nueva
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-4">
            <div>
              <label className={`text-xs font-medium ${sub}`}>Tu nombre</label>
              <input value={name} onChange={(e) => { setName(e.target.value); setError(""); }}
                placeholder="Ej. Camila" maxLength={20}
                className={`w-full mt-1 px-4 py-3 rounded-xl border outline-none ${input}`} />
            </div>
            <div>
              <label className={`text-xs font-medium ${sub}`}>PIN de 4 dígitos (opcional)</label>
              <input value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }}
                placeholder="••••" inputMode="numeric"
                className={`w-full mt-1 px-4 py-3 rounded-xl border outline-none tracking-widest ${input}`} />
              <p className={`text-[11px] mt-1 ${sub}`}>El PIN solo separa perfiles en este dispositivo; no es seguridad real.</p>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button onClick={submitCreate} className="w-full py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition active:scale-95">
              Crear cuenta y empezar
            </button>
            {accounts.length > 0 && (
              <button onClick={() => { setError(""); setMode("welcome"); }} className={`w-full py-2 text-sm font-medium ${sub}`}>
                Volver a mis cuentas
              </button>
            )}
          </div>
        )}

        {mode === "login" && selected && (
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              <span className="flex items-center justify-center rounded-full font-bold text-white mb-2" style={{ width: 56, height: 56, background: "#3b82f6" }}>
                {selected.name.charAt(0).toUpperCase()}
              </span>
              <p className={`font-semibold ${txt}`}>Hola, {selected.name}</p>
            </div>
            {selected.pin ? (
              <div>
                <label className={`text-xs font-medium ${sub}`}>Introduce tu PIN</label>
                <input value={loginPin} autoFocus
                  onChange={(e) => { setLoginPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }}
                  placeholder="••••" inputMode="numeric"
                  className={`w-full mt-1 px-4 py-3 rounded-xl border outline-none tracking-widest text-center text-lg ${input}`} />
              </div>
            ) : (
              <p className={`text-center text-sm ${sub}`}>Esta cuenta no tiene PIN. Entra directamente.</p>
            )}
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <button onClick={submitLogin} className="w-full py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition active:scale-95">
              Entrar
            </button>
            <button onClick={() => { setError(""); setMode("welcome"); }} className={`w-full py-2 text-sm font-medium ${sub}`}>
              Volver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------- Onboarding ----------------------------------

function Onboarding({ dark, onFinish }) {
  const [step, setStep] = useState(0);
  const slides = [
    { icon: Target, color: "#3b82f6", title: "Bienvenido a HabitNow",
      text: "Tu espacio para construir hábitos y mantener la constancia día a día. Empiezas con la app vacía: tú decides qué seguir." },
    { icon: Plus, color: "#10b981", title: "1 · Crea tus hábitos",
      text: "Pulsa el botón + en la vista «Hoy». Elige nombre, icono, color, categoría, frecuencia y si es de tipo Sí/No o con contador." },
    { icon: CheckCircle2, color: "#8b5cf6", title: "2 · Marca tu progreso",
      text: "Cada día, toca el círculo para completar un hábito, o usa +/− en los cuantitativos. La barra superior muestra tu avance del día." },
    { icon: BarChart3, color: "#f59e0b", title: "3 · Sigue tu evolución",
      text: "En «Calendario» ves qué días cumpliste y en «Estadísticas» tus rachas y tasas de éxito. Tus datos se guardan desde hoy." },
  ];
  const s = slides[step];
  const Icon = s.icon;
  const isLast = step === slides.length - 1;
  const bg = dark ? "bg-gray-900" : "bg-gray-50";
  const txt = dark ? "text-white" : "text-gray-900";
  const sub = dark ? "text-gray-400" : "text-gray-500";

  return (
    <div className={`${bg} min-h-screen`} style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="max-w-md mx-auto min-h-screen flex flex-col px-6 py-10">
        <div className="flex justify-end">
          <button onClick={onFinish} className={`text-sm font-medium ${sub}`}>Saltar</button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="flex items-center justify-center rounded-3xl mb-8 transition-all duration-300" style={{ width: 96, height: 96, background: `${s.color}1a` }}>
            <Icon size={48} color={s.color} strokeWidth={2} />
          </div>
          <h1 className={`text-2xl font-bold mb-3 ${txt}`}>{s.title}</h1>
          <p className={`text-base leading-relaxed ${sub} max-w-xs`}>{s.text}</p>
        </div>
        <div className="flex items-center justify-center gap-2 mb-6">
          {slides.map((_, i) => (
            <span key={i} className="rounded-full transition-all duration-300"
              style={{ width: i === step ? 24 : 8, height: 8, background: i === step ? s.color : (dark ? "#374151" : "#d1d5db") }} />
          ))}
        </div>
        <div className="flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)}
              className={`px-5 py-3 rounded-xl font-semibold ${dark ? "bg-gray-800 text-gray-200" : "bg-white text-gray-700 border border-gray-200"}`}>
              Atrás
            </button>
          )}
          <button onClick={() => (isLast ? onFinish() : setStep(step + 1))}
            className="flex-1 py-3 rounded-xl font-bold text-white transition active:scale-95" style={{ background: s.color }}>
            {isLast ? "Empezar" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------- Table / Tracker View ------------------------

function TableView({ habits, logs, dark, onToggleAt, onAdjustAt, onCreate, onEdit }) {
  const today = new Date();
  const [weekStart, setWeekStart] = useState(() => addDays(new Date(), -isoWeekday(new Date())));

  const weekDays = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 7; i++) arr.push(addDays(weekStart, i));
    return arr;
  }, [weekStart]);

  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const weekLabel = sameMonth
    ? `${weekStart.getDate()} – ${weekEnd.getDate()} ${MONTHS[weekEnd.getMonth()].slice(0, 3)}.`
    : `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()].slice(0, 3)}. – ${weekEnd.getDate()} ${MONTHS[weekEnd.getMonth()].slice(0, 3)}.`;

  const card = dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100";
  const txt = dark ? "text-white" : "text-gray-900";
  const sub = dark ? "text-gray-400" : "text-gray-500";
  const cellEmptyBg = dark ? "#374151" : "#f3f4f6";

  // Resumen del día (para mostrar integrado en PC, donde la barra flotante se oculta)
  const scheduledToday = habits.filter((h) => isScheduledOn(h, today));
  const doneToday = scheduledToday.filter((h) => isCompletedOn(h, logs, today)).length;
  const pendingToday = Math.max(0, scheduledToday.length - doneToday);
  const pctToday = scheduledToday.length ? Math.round((doneToday / scheduledToday.length) * 100) : 0;

  const handleCellTap = (habit, date) => {
    if (date > today && !sameDay(date, today)) return;
    if (!isScheduledOn(habit, date)) return;
    if (habit.goalType === "boolean") {
      onToggleAt(habit, date);
    } else {
      const log = getLog(logs, habit.id, date);
      const v = (log && log.value) || 0;
      const completed = v >= habit.target;
      // Tap toggles between 0 and target for the table view
      onAdjustAt(habit, date, completed ? -v : (habit.target - v));
    }
  };

  if (habits.length === 0) {
    return (
      <div className="px-4 pb-4">
        <div className={`text-center py-16 px-6 rounded-3xl ${card} border`}>
          <div className="flex items-center justify-center rounded-2xl mx-auto mb-4"
            style={{ width: 72, height: 72, background: "#3b82f61a" }}>
            <LayoutGrid size={36} color="#3b82f6" />
          </div>
          <p className={`font-bold text-lg ${txt}`}>Tracker vacío</p>
          <p className={`text-sm mt-1 mb-5 ${sub}`}>
            Crea tu primer hábito para empezar a llenar la tabla semana a semana.
          </p>
          <button onClick={onCreate}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition active:scale-95">
            <Plus size={18} /> Crear hábito
          </button>
        </div>
      </div>
    );
  }

  // 1fr columns: ~110px label + 7 day cells
  const gridCols = "minmax(96px, 1.4fr) repeat(7, minmax(0, 1fr))";

  return (
    <div className="px-4 pb-4 space-y-3">
      {/* Week navigator */}
      <div className={`rounded-2xl p-3 border ${card} flex items-center justify-between`}>
        <button onClick={() => setWeekStart(addDays(weekStart, -7))}
          className={`p-2 rounded-full ${dark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`}>
          <ChevronLeft size={18} />
        </button>
        <button onClick={() => setWeekStart(addDays(new Date(), -isoWeekday(new Date())))}
          className={`text-sm font-bold ${txt} px-3 py-1.5 rounded-lg ${dark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
          {weekLabel}
        </button>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))}
          className={`p-2 rounded-full ${dark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Resumen del día — solo PC */}
      {scheduledToday.length > 0 && (
        <div className={`hidden lg:flex items-center justify-between rounded-2xl p-4 border ${card}`}>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-extrabold ${pctToday === 100 ? "text-emerald-500" : "text-blue-500"}`}>{pctToday}%</span>
            <span className={`text-sm font-medium ${sub}`}>{doneToday}/{scheduledToday.length} hábitos hoy</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold" style={{ background: "#10b98122", color: "#10b981" }}>
              <Check size={14} strokeWidth={3} /> {doneToday} hechos
            </span>
            <span className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold" style={{ background: "#ef444422", color: "#ef4444" }}>
              <X size={14} strokeWidth={3} /> {pendingToday} faltan
            </span>
          </div>
        </div>
      )}

      {/* Add habit button */}
      <button onClick={onCreate}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl font-semibold text-blue-500 border-2 border-dashed transition active:scale-95 ${dark ? "border-blue-900" : "border-blue-200"}`}>
        <Plus size={16} /> Añadir hábito
      </button>

      {/* Table */}
      <div className={`rounded-2xl border ${card} overflow-hidden`}>
        {/* Day header row */}
        <div className="grid items-center" style={{ gridTemplateColumns: gridCols }}>
          <div className="p-2"></div>
          {weekDays.map((d, i) => {
            const isToday = sameDay(d, today);
            return (
              <div key={i} className="flex flex-col items-center justify-center py-2">
                <span className={`text-[10px] font-semibold ${sub}`}>{WEEKDAYS[i].charAt(0)}</span>
                <span className={`mt-0.5 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday ? "bg-blue-500 text-white" : txt
                }`}>{d.getDate()}</span>
              </div>
            );
          })}
        </div>

        {/* Habit rows */}
        {habits.map((h) => {
          const color = h.color || catOf(h.category).color;
          return (
            <div key={h.id} className={`grid items-center border-t ${dark ? "border-gray-700" : "border-gray-100"}`}
              style={{ gridTemplateColumns: gridCols }}>
              {/* Label */}
              <button onClick={() => onEdit(h)}
                className={`flex items-center gap-2 p-2 min-w-0 text-left transition active:scale-95 ${dark ? "hover:bg-gray-700/40" : "hover:bg-gray-50"}`}>
                <span className="text-lg shrink-0">{h.emoji || "🎯"}</span>
                <span className={`text-xs font-medium leading-tight truncate ${txt}`} title={h.name}>
                  {h.name}
                </span>
              </button>

              {/* Day cells */}
              {weekDays.map((d, i) => {
                const scheduled = isScheduledOn(h, d);
                const isFuture = d > today && !sameDay(d, today);
                const log = getLog(logs, h.id, d);
                const completed = !!(log && log.completed);
                const value = (log && log.value) || 0;
                const partial = h.goalType === "quantitative" && value > 0 && !completed;

                let bg = "transparent";
                if (completed) bg = color;
                else if (partial) bg = `${color}66`;
                else if (scheduled && !isFuture) bg = cellEmptyBg;

                return (
                  <div key={i} className="flex items-center justify-center py-1.5">
                    <button
                      onClick={() => handleCellTap(h, d)}
                      disabled={!scheduled || isFuture}
                      className="rounded-lg flex items-center justify-center transition active:scale-90 disabled:cursor-default"
                      style={{
                        width: 28, height: 28,
                        background: bg,
                        opacity: isFuture ? 0.35 : (scheduled ? 1 : 0.5),
                      }}>
                      {completed && <Check size={14} color="#fff" strokeWidth={3} />}
                      {!scheduled && !completed && (
                        <span className={`text-[8px] ${sub}`}>—</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <p className={`text-center text-[11px] ${sub}`}>
        Toca una celda para marcar · Toca el nombre del hábito para editarlo
      </p>
    </div>
  );
}

// ----------------------------- Tasks View ----------------------------------

const PRIORITY_RANK = { alta: 0, media: 1, baja: 2 };

function TasksView({ tasks, dark, onAdd, onToggle, onDelete, onCyclePriority }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("media");
  const [sortMode, setSortMode] = useState("priority");

  const today = new Date();
  const card = dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100";
  const txt = dark ? "text-white" : "text-gray-900";
  const sub = dark ? "text-gray-400" : "text-gray-500";
  const input = dark ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400";

  const doneCount = tasks.filter((t) => t.completed).length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const sorted = useMemo(() => {
    const arr = [...tasks];
    arr.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (sortMode === "priority") {
        const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (pr !== 0) return pr;
        return a.createdAt - b.createdAt;
      }
      return b.createdAt - a.createdAt;
    });
    return arr;
  }, [tasks, sortMode]);

  const handleAdd = () => {
    if (title.trim().length === 0) return;
    onAdd(title.trim(), priority);
    setTitle("");
    setPriority("media");
  };

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Header */}
      <div className={`rounded-3xl p-5 ${dark ? "bg-gradient-to-br from-emerald-600 to-teal-700" : "bg-gradient-to-br from-emerald-500 to-teal-600"} text-white shadow-lg`}>
        <p className="text-sm opacity-90 capitalize">{WEEKDAYS_FULL[isoWeekday(today)]}, {today.getDate()} {MONTHS[today.getMonth()]}</p>
        <p className="text-2xl font-bold mt-1">
          {tasks.length === 0 ? "Sin tareas aún" : `${doneCount} de ${tasks.length} hechas`}
        </p>
        {tasks.length > 0 && (
          <div className="mt-4 h-2 rounded-full bg-white/25 overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      {/* Quick add */}
      <div className={`rounded-2xl p-4 border ${card}`}>
        <div className="flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder="Añadir una tarea para hoy..." maxLength={80}
            className={`flex-1 px-3 py-2.5 rounded-xl border outline-none focus:border-emerald-400 ${input}`} />
          <button onClick={handleAdd} disabled={title.trim().length === 0}
            className={`px-4 rounded-xl font-bold text-white transition active:scale-95 ${
              title.trim().length === 0 ? "bg-gray-300 cursor-not-allowed" : "bg-emerald-500 hover:bg-emerald-600"
            }`}>
            <Plus size={20} />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          {PRIORITIES.map((p) => (
            <button key={p.id} onClick={() => setPriority(p.id)}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition border-2"
              style={{
                background: priority === p.id ? `${p.color}1a` : "transparent",
                borderColor: priority === p.id ? p.color : (dark ? "#374151" : "#e5e7eb"),
                color: priority === p.id ? p.color : (dark ? "#9ca3af" : "#6b7280"),
              }}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sort toggle */}
      {tasks.length > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className={`text-xs font-medium ${sub}`}>Ordenar por:</span>
          <div className={`flex rounded-lg p-0.5 ${dark ? "bg-gray-800" : "bg-gray-100"}`}>
            <button onClick={() => setSortMode("priority")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                sortMode === "priority" ? (dark ? "bg-gray-700 text-white" : "bg-white text-gray-900 shadow-sm") : sub
              }`}>
              <ArrowUpDown size={12} /> Prioridad
            </button>
            <button onClick={() => setSortMode("recent")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                sortMode === "recent" ? (dark ? "bg-gray-700 text-white" : "bg-white text-gray-900 shadow-sm") : sub
              }`}>
              Recientes
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className={`text-center py-12 ${sub}`}>
          <ListTodo size={48} className="mx-auto mb-3 opacity-50" />
          <p className="font-medium">Tu lista está vacía</p>
          <p className="text-sm">Escribe arriba lo que tengas que hacer hoy</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((t) => {
            const p = prioOf(t.priority);
            return (
              <div key={t.id}
                className={`relative overflow-hidden flex items-center gap-3 p-3 rounded-2xl border transition ${card} ${t.completed ? "opacity-60" : ""}`}>
                <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: p.color }} />
                <button onClick={() => onToggle(t.id)}
                  className="shrink-0 rounded-full flex items-center justify-center transition active:scale-90"
                  style={{
                    width: 26, height: 26,
                    background: t.completed ? p.color : "transparent",
                    border: `2px solid ${t.completed ? p.color : (dark ? "#4b5563" : "#d1d5db")}`,
                  }}>
                  {t.completed && <Check size={15} color="#fff" strokeWidth={3} />}
                </button>
                <p className={`flex-1 min-w-0 text-sm font-medium break-words ${txt} ${t.completed ? "line-through" : ""}`}>
                  {t.title}
                </p>
                <button onClick={() => onCyclePriority(t.id)}
                  className="shrink-0 text-[10px] px-2 py-1 rounded-full font-bold transition active:scale-95"
                  style={{ background: `${p.color}1a`, color: p.color }}
                  title="Toca para cambiar prioridad">
                  {p.name}
                </button>
                <button onClick={() => onDelete(t.id)}
                  className={`shrink-0 p-1.5 rounded-lg ${dark ? "hover:bg-gray-700 text-gray-500" : "hover:bg-gray-100 text-gray-400"}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ----------------------------- Event Modal ---------------------------------

function EventModal({ open, onClose, onSave, editing, defaultDate, dark }) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (editing) setForm({ ...editing });
    else setForm({ type: "evento", name: "", description: "", date: toKey(defaultDate || new Date()), time: "", place: "" });
  }, [open, editing, defaultDate]);

  if (!open || !form) return null;

  const upd = (patch) => setForm((f) => ({ ...f, ...patch }));
  const canSave = form.name.trim().length > 0 && form.date;
  const panel = dark ? "bg-gray-800 text-white" : "bg-white text-gray-900";
  const input = dark ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400";
  const label = dark ? "text-gray-300" : "text-gray-600";

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${panel} w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col`} style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}>
        <div className={`flex items-center justify-between p-5 border-b shrink-0 ${dark ? "border-gray-700" : "border-gray-100"}`}>
          <h2 className="text-lg font-bold">{editing ? "Editar" : "Nuevo evento"}</h2>
          <button onClick={onClose} className={`p-2 rounded-full ${dark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}>
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Type */}
          <div>
            <label className={`text-xs font-medium ${label}`}>Tipo</label>
            <div className="flex gap-2 mt-2">
              {EVENT_TYPES.map((t) => (
                <button key={t.id} onClick={() => upd({ type: t.id })}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition border-2"
                  style={{
                    background: form.type === t.id ? `${t.color}1a` : "transparent",
                    borderColor: form.type === t.id ? t.color : (dark ? "#374151" : "#e5e7eb"),
                    color: form.type === t.id ? t.color : (dark ? "#9ca3af" : "#6b7280"),
                  }}>
                  {t.id === "prueba" ? <GraduationCap size={16} /> : <CalendarIcon size={16} />} {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className={`text-xs font-medium ${label}`}>Nombre</label>
            <input value={form.name} onChange={(e) => upd({ name: e.target.value })}
              placeholder="Ej. Prueba de Matemáticas" maxLength={60}
              className={`w-full mt-1 px-3 py-2.5 rounded-xl border outline-none focus:border-blue-400 ${input}`} />
          </div>

          {/* Description */}
          <div>
            <label className={`text-xs font-medium ${label}`}>Descripción (opcional)</label>
            <textarea value={form.description} onChange={(e) => upd({ description: e.target.value })}
              placeholder="Temario, materiales, notas..." rows={2} maxLength={200}
              className={`w-full mt-1 px-3 py-2.5 rounded-xl border outline-none resize-none focus:border-blue-400 ${input}`} />
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={`text-xs font-medium ${label}`}>Fecha</label>
              <input type="date" value={form.date} onChange={(e) => upd({ date: e.target.value })}
                className={`w-full mt-1 px-3 py-2.5 rounded-xl border outline-none focus:border-blue-400 ${input}`} />
            </div>
            <div>
              <label className={`text-xs font-medium ${label}`}>Hora (opcional)</label>
              <input type="time" value={form.time} onChange={(e) => upd({ time: e.target.value })}
                className={`w-full mt-1 px-3 py-2.5 rounded-xl border outline-none focus:border-blue-400 ${input}`} />
            </div>
          </div>

          {/* Place */}
          <div>
            <label className={`text-xs font-medium ${label}`}>Lugar (opcional)</label>
            <input value={form.place} onChange={(e) => upd({ place: e.target.value })}
              placeholder="Ej. Sala 12 / Casa / Online" maxLength={60}
              className={`w-full mt-1 px-3 py-2.5 rounded-xl border outline-none focus:border-blue-400 ${input}`} />
          </div>
        </div>

        <div className={`p-5 border-t shrink-0 ${dark ? "border-gray-700" : "border-gray-100"}`}>
          <button onClick={() => canSave && onSave(form)} disabled={!canSave}
            className={`w-full py-3 rounded-xl font-bold text-white transition ${
              canSave ? "bg-blue-500 hover:bg-blue-600 active:scale-95" : "bg-gray-300 cursor-not-allowed"
            }`}>
            {editing ? "Guardar cambios" : "Crear evento"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------- Events Calendar (full screen) ---------------

function EventsCalendarView({ events, dark, onBack, onSave, onDelete }) {
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startOffset = isoWeekday(new Date(year, month, 1));
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const today = new Date();
  const bg = dark ? "bg-gray-900" : "bg-gray-50";
  const txt = dark ? "text-white" : "text-gray-900";
  const sub = dark ? "text-gray-400" : "text-gray-500";
  const card = dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100";

  const eventsOn = (date) => events.filter((e) => e.date === toKey(date));
  const selectedEvents = useMemo(
    () => events.filter((e) => e.date === toKey(selectedDate))
      .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")),
    [events, selectedDate]
  );

  const selLabel = `${WEEKDAYS_FULL[isoWeekday(selectedDate)]}, ${selectedDate.getDate()} de ${MONTHS[selectedDate.getMonth()]}`;

  const handleSave = (ev) => { onSave(ev); setModalOpen(false); setEditing(null); };

  return (
    <div className={`${bg} min-h-screen transition-colors`} style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="max-w-md mx-auto relative min-h-screen flex flex-col">
        {/* Header with back */}
        <header className={`sticky top-0 z-30 ${bg} px-4 pt-5 pb-3 flex items-center gap-3`}>
          <button onClick={onBack} className={`p-2 rounded-full ${dark ? "bg-gray-800 text-gray-200" : "bg-white text-gray-600 border border-gray-200"}`}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className={`text-xl font-bold ${txt}`}>Eventos y Pruebas</h1>
            <p className={`text-xs ${sub}`}>{events.length} en total</p>
          </div>
        </header>

        <main className="flex-1 pb-28 px-4 space-y-4">
          {/* Month calendar */}
          <div className={`rounded-3xl p-4 border ${card} shadow-sm`}>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setCursor(new Date(year, month - 1, 1))}
                className={`p-2 rounded-full ${dark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`}>
                <ChevronLeft size={20} />
              </button>
              <h3 className={`font-bold ${txt}`}>{MONTHS[month]} {year}</h3>
              <button onClick={() => setCursor(new Date(year, month + 1, 1))}
                className={`p-2 rounded-full ${dark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-100 text-gray-600"}`}>
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAYS.map((d) => (
                <div key={d} className={`text-center text-xs font-semibold ${sub}`}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((date, i) => {
                if (!date) return <div key={i} />;
                const dayEvents = eventsOn(date);
                const isToday = sameDay(date, today);
                const isSelected = sameDay(date, selectedDate);
                const hasPrueba = dayEvents.some((e) => e.type === "prueba");
                const hasEvento = dayEvents.some((e) => e.type === "evento");
                return (
                  <div key={i} className="aspect-square flex items-center justify-center">
                    <button onClick={() => setSelectedDate(date)}
                      className="w-full h-full rounded-xl flex flex-col items-center justify-center text-sm font-medium relative transition active:scale-95"
                      style={{
                        background: isSelected ? "#3b82f6" : "transparent",
                        color: isSelected ? "#fff" : (dark ? "#e5e7eb" : "#374151"),
                        border: isToday && !isSelected ? "2px solid #3b82f6" : "none",
                      }}>
                      {date.getDate()}
                      {(hasPrueba || hasEvento) && (
                        <span className="absolute bottom-1 flex gap-0.5">
                          {hasEvento && <span className="w-1.5 h-1.5 rounded-full" style={{ background: isSelected ? "#fff" : "#3b82f6" }} />}
                          {hasPrueba && <span className="w-1.5 h-1.5 rounded-full" style={{ background: isSelected ? "#fff" : "#ef4444" }} />}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-4 mt-4 text-xs">
              <span className="flex items-center gap-1.5" style={{ color: sub }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#3b82f6" }} /> Evento
              </span>
              <span className="flex items-center gap-1.5" style={{ color: sub }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ef4444" }} /> Prueba
              </span>
            </div>
          </div>

          {/* Selected day's events */}
          <div>
            <h3 className={`font-bold mb-2 capitalize ${txt}`}>{selLabel}</h3>
            {selectedEvents.length === 0 ? (
              <div className={`text-center py-10 rounded-2xl border ${card} ${sub}`}>
                <CalendarPlus size={36} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay nada este día</p>
                <p className="text-xs">Toca el botón + para agregar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((e) => {
                  const t = eventTypeOf(e.type);
                  return (
                    <div key={e.id} className={`relative overflow-hidden rounded-2xl p-4 border ${card}`}>
                      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: t.color }} />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${t.color}1a`, color: t.color }}>
                          {t.name}
                        </span>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditing(e); setModalOpen(true); }}
                            className={`p-1.5 rounded-lg ${dark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-400"}`}>
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => setConfirmDel(e)}
                            className={`p-1.5 rounded-lg ${dark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-400"}`}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className={`font-semibold mt-1.5 ${txt}`}>{e.name}</p>
                      {e.description && <p className={`text-sm mt-0.5 ${sub}`}>{e.description}</p>}
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        {e.time && (
                          <span className={`flex items-center gap-1 text-xs font-medium ${sub}`}>
                            <Clock size={13} /> {e.time}
                          </span>
                        )}
                        {e.place && (
                          <span className={`flex items-center gap-1 text-xs font-medium ${sub}`}>
                            <MapPin size={13} /> {e.place}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* FAB */}
        <button onClick={() => { setEditing(null); setModalOpen(true); }}
          className="fixed bottom-8 left-1/2 z-40" style={{ transform: "translateX(calc(-50% + 150px))" }}>
          <span className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/40 hover:bg-blue-600 active:scale-90 transition">
            <Plus size={28} />
          </span>
        </button>
      </div>

      <EventModal open={modalOpen} editing={editing} defaultDate={selectedDate} dark={dark}
        onClose={() => { setModalOpen(false); setEditing(null); }} onSave={handleSave} />

      <ConfirmDialog open={!!confirmDel} dark={dark}
        title="Eliminar"
        message={`¿Eliminar "${confirmDel?.name}"?`}
        onConfirm={() => { onDelete(confirmDel.id); setConfirmDel(null); }}
        onCancel={() => setConfirmDel(null)} />
    </div>
  );
}

// ----------------------------- Goal Modal -----------------------------------

function GoalModal({ open, onClose, onSave, editing, dark }) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (editing) setForm({ ...editing });
    else setForm({ title: "", timeframe: "mensual", deadline: "", description: "", why: "", steps: [] });
  }, [open, editing]);

  if (!open || !form) return null;
  const upd = (patch) => setForm((f) => ({ ...f, ...patch }));
  const canSave = form.title.trim().length > 0;
  const panel = dark ? "bg-gray-800 text-white" : "bg-white text-gray-900";
  const input = dark ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400";
  const label = dark ? "text-gray-300" : "text-gray-600";

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`${panel} w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col`} style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}>
        <div className={`flex items-center justify-between p-5 border-b shrink-0 ${dark ? "border-gray-700" : "border-gray-100"}`}>
          <h2 className="text-lg font-bold">{editing ? "Editar meta" : "Nueva meta"}</h2>
          <button onClick={onClose} className={`p-2 rounded-full ${dark ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className={`text-xs font-medium ${label}`}>Título de la meta</label>
            <input value={form.title} onChange={(e) => upd({ title: e.target.value })}
              placeholder="Ej. Generar 10k al mes" maxLength={70}
              className={`w-full mt-1 px-3 py-2.5 rounded-xl border outline-none focus:border-blue-400 ${input}`} />
          </div>
          <div>
            <label className={`text-xs font-medium ${label}`}>Plazo</label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {GOAL_TIMEFRAMES.map((t) => (
                <button key={t.id} onClick={() => upd({ timeframe: t.id })}
                  className="px-2 py-2 rounded-xl text-xs font-bold transition border-2"
                  style={{
                    background: form.timeframe === t.id ? `${t.color}1a` : "transparent",
                    borderColor: form.timeframe === t.id ? t.color : (dark ? "#374151" : "#e5e7eb"),
                    color: form.timeframe === t.id ? t.color : (dark ? "#9ca3af" : "#6b7280"),
                  }}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={`text-xs font-medium ${label}`}>Fecha límite (opcional)</label>
            <input type="date" value={form.deadline} onChange={(e) => upd({ deadline: e.target.value })}
              className={`w-full mt-1 px-3 py-2.5 rounded-xl border outline-none focus:border-blue-400 ${input}`} />
          </div>
          <div>
            <label className={`text-xs font-medium ${label}`}>Descripción (opcional)</label>
            <textarea value={form.description} onChange={(e) => upd({ description: e.target.value })}
              placeholder="¿En qué consiste esta meta?" rows={2} maxLength={200}
              className={`w-full mt-1 px-3 py-2.5 rounded-xl border outline-none resize-none focus:border-blue-400 ${input}`} />
          </div>
          <div>
            <label className={`text-xs font-medium ${label}`}>¿Por qué? (tu motivación)</label>
            <textarea value={form.why} onChange={(e) => upd({ why: e.target.value })}
              placeholder="El motivo que te impulsa a lograrla" rows={2} maxLength={200}
              className={`w-full mt-1 px-3 py-2.5 rounded-xl border outline-none resize-none focus:border-blue-400 ${input}`} />
          </div>
        </div>
        <div className={`p-5 border-t shrink-0 ${dark ? "border-gray-700" : "border-gray-100"}`}>
          <button onClick={() => canSave && onSave(form)} disabled={!canSave}
            className={`w-full py-3 rounded-xl font-bold text-white transition ${canSave ? "bg-blue-500 hover:bg-blue-600 active:scale-95" : "bg-gray-300 cursor-not-allowed"}`}>
            {editing ? "Guardar cambios" : "Crear meta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------- Goal Detail ----------------------------------

function GoalDetail({ goal, dark, onBack, onSave }) {
  const [stepText, setStepText] = useState("");
  const t = timeframeOf(goal.timeframe);
  const bg = dark ? "bg-gray-900" : "bg-gray-50";
  const txt = dark ? "text-white" : "text-gray-900";
  const sub = dark ? "text-gray-400" : "text-gray-500";
  const card = dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100";
  const input = dark ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400";

  const steps = goal.steps || [];
  const done = steps.filter((s) => s.done).length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;

  const addStep = () => {
    if (stepText.trim().length === 0) return;
    onSave({ ...goal, steps: [...steps, { id: "s" + Date.now(), text: stepText.trim(), done: false }] });
    setStepText("");
  };
  const toggleStep = (id) => onSave({ ...goal, steps: steps.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) });
  const delStep = (id) => onSave({ ...goal, steps: steps.filter((s) => s.id !== id) });

  return (
    <div className={`${bg} min-h-screen`} style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="max-w-md mx-auto min-h-screen flex flex-col">
        <header className={`sticky top-0 z-30 ${bg} px-4 pt-5 pb-3 flex items-center gap-3`}>
          <button onClick={onBack} className={`p-2 rounded-full ${dark ? "bg-gray-800 text-gray-200" : "bg-white text-gray-600 border border-gray-200"}`}><ArrowLeft size={20} /></button>
          <h1 className={`text-lg font-bold truncate ${txt}`}>Detalle de meta</h1>
        </header>

        <main className="flex-1 px-4 pb-24 space-y-4">
          {/* Goal info */}
          <div className={`relative overflow-hidden rounded-3xl p-5 border ${card}`}>
            <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: t.color }} />
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${t.color}1a`, color: t.color }}>{t.name}</span>
            <p className={`text-xl font-bold mt-2 ${txt}`}>{goal.title}</p>
            {goal.deadline && <p className={`text-xs mt-1 ${sub}`}>📅 Límite: {goal.deadline}</p>}
            {goal.description && <p className={`text-sm mt-2 ${sub}`}>{goal.description}</p>}
            {goal.why && (
              <div className={`mt-3 p-3 rounded-xl ${dark ? "bg-gray-700/50" : "bg-gray-50"}`}>
                <p className="text-xs font-bold" style={{ color: t.color }}>Mi porqué</p>
                <p className={`text-sm mt-0.5 ${txt}`}>{goal.why}</p>
              </div>
            )}
            {steps.length > 0 && (
              <>
                <div className="flex items-center justify-between mt-4 mb-1">
                  <span className={`text-xs font-medium ${sub}`}>Progreso</span>
                  <span className="text-xs font-bold" style={{ color: t.color }}>{pct}%</span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: t.color }} />
                </div>
              </>
            )}
          </div>

          {/* Steps */}
          <div>
            <h3 className={`font-bold mb-2 ${txt}`}>Pasos para lograrla</h3>
            <div className={`rounded-2xl p-3 border ${card} mb-3`}>
              <div className="flex gap-2">
                <input value={stepText} onChange={(e) => setStepText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addStep(); }}
                  placeholder="Ej. Llegar a 1k al mes" maxLength={100}
                  className={`flex-1 px-3 py-2.5 rounded-xl border outline-none focus:border-blue-400 ${input}`} />
                <button onClick={addStep} disabled={stepText.trim().length === 0}
                  className={`px-4 rounded-xl font-bold text-white transition active:scale-95 ${stepText.trim().length === 0 ? "bg-gray-300" : "bg-blue-500 hover:bg-blue-600"}`}>
                  <Plus size={20} />
                </button>
              </div>
            </div>

            {steps.length === 0 ? (
              <div className={`text-center py-8 ${sub}`}>
                <ListChecks size={36} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Añade los pasos progresivos hacia tu meta</p>
              </div>
            ) : (
              <div className="space-y-2">
                {steps.map((s, idx) => (
                  <div key={s.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${card} ${s.done ? "opacity-60" : ""}`}>
                    <button onClick={() => toggleStep(s.id)}
                      className="shrink-0 rounded-full flex items-center justify-center transition active:scale-90"
                      style={{ width: 26, height: 26, background: s.done ? t.color : "transparent", border: `2px solid ${s.done ? t.color : (dark ? "#4b5563" : "#d1d5db")}` }}>
                      {s.done && <Check size={15} color="#fff" strokeWidth={3} />}
                    </button>
                    <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${dark ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-500"}`}>{idx + 1}</span>
                    <p className={`flex-1 min-w-0 text-sm font-medium break-words ${txt} ${s.done ? "line-through" : ""}`}>{s.text}</p>
                    <button onClick={() => delStep(s.id)} className={`shrink-0 p-1.5 rounded-lg ${dark ? "hover:bg-gray-700 text-gray-500" : "hover:bg-gray-100 text-gray-400"}`}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ----------------------------- Goals View (tab content) --------------------

function GoalsView({ goals, dark, onSave, onDelete }) {
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const selected = goals.find((g) => g.id === selectedId);
  if (selected) {
    return <GoalDetail goal={selected} dark={dark} onBack={() => setSelectedId(null)} onSave={onSave} />;
  }

  const txt = dark ? "text-white" : "text-gray-900";
  const sub = dark ? "text-gray-400" : "text-gray-500";
  const card = dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100";

  const handleSave = (g) => { onSave(g); setModalOpen(false); setEditing(null); };

  return (
    <div className="px-4 pb-4 space-y-4 relative">
      <button onClick={() => { setEditing(null); setModalOpen(true); }}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl font-semibold text-white bg-blue-500 hover:bg-blue-600 transition active:scale-95">
        <Plus size={18} /> Nueva meta
      </button>

      {GOAL_TIMEFRAMES.map((tf) => {
        const list = goals.filter((g) => g.timeframe === tf.id);
        if (list.length === 0) return null;
        return (
          <div key={tf.id}>
            <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: tf.color }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: tf.color }} /> {tf.name}
            </h3>
            <div className="space-y-2">
              {list.map((g) => {
                const steps = g.steps || [];
                const done = steps.filter((s) => s.done).length;
                const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
                return (
                  <div key={g.id} className={`relative overflow-hidden rounded-2xl p-4 border ${card}`}>
                    <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: tf.color }} />
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => setSelectedId(g.id)} className="flex-1 min-w-0 text-left">
                        <p className={`font-semibold ${txt}`}>{g.title}</p>
                        {g.deadline && <p className={`text-xs mt-0.5 ${sub}`}>📅 {g.deadline}</p>}
                        <p className={`text-xs mt-1 ${sub}`}>{steps.length === 0 ? "Sin pasos aún · toca para añadir" : `${done}/${steps.length} pasos · ${pct}%`}</p>
                      </button>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={() => { setEditing(g); setModalOpen(true); }} className={`p-1.5 rounded-lg ${dark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-400"}`}><Edit3 size={14} /></button>
                        <button onClick={() => setConfirmDel(g)} className={`p-1.5 rounded-lg ${dark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-400"}`}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {steps.length > 0 && (
                      <div className={`mt-2 h-1.5 rounded-full overflow-hidden ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: tf.color }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {goals.length === 0 && (
        <div className={`text-center py-16 ${sub}`}>
          <Flag size={48} className="mx-auto mb-3 opacity-50" />
          <p className="font-medium">Aún no tienes metas</p>
          <p className="text-sm">Toca "Nueva meta" para crear la primera</p>
        </div>
      )}

      <GoalModal open={modalOpen} editing={editing} dark={dark} onClose={() => { setModalOpen(false); setEditing(null); }} onSave={handleSave} />
      <ConfirmDialog open={!!confirmDel} dark={dark} title="Eliminar meta" message={`¿Eliminar "${confirmDel?.title}"?`}
        onConfirm={() => { onDelete(confirmDel.id); setConfirmDel(null); }} onCancel={() => setConfirmDel(null)} />
    </div>
  );
}

// ----------------------------- Main App ------------------------------------

export default function App() {
  const [accounts, setAccounts] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState("today");
  const [showEvents, setShowEvents] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [confirmAccount, setConfirmAccount] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const accs = await loadAccounts();
      const session = await loadSession();
      if (!mounted) return;
      setAccounts(accs);
      if (session && accs.some((a) => a.id === session)) {
        const d = await loadAccountData(session);
        if (!mounted) return;
        setActiveId(session);
        setData(d);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const update = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (activeId) persistAccountData(activeId, next);
      return next;
    });
  }, [activeId]);

  const dark = data?.settings?.dark ?? false;
  const habits = data?.habits ?? [];
  const logs = data?.logs ?? {};
  const tasks = data?.tasks ?? [];
  const events = data?.events ?? [];
  const goals = data?.goals ?? [];

  const createAccount = async (name, pin) => {
    const id = "acc" + Date.now();
    const acc = { id, name, pin, createdAt: toKey(new Date()) };
    const nextAccounts = [...(accounts || []), acc];
    setAccounts(nextAccounts);
    await saveAccounts(nextAccounts);
    const fresh = buildInitialData();
    await persistAccountData(id, fresh);
    await saveSession(id);
    setActiveId(id);
    setData(fresh);
    setTab("today");
  };

  const loginAccount = async (id) => {
    const d = await loadAccountData(id);
    await saveSession(id);
    setActiveId(id);
    setData(d);
    setTab("today");
  };

  const logout = async () => {
    await saveSession(null);
    setActiveId(null);
    setData(null);
    setTab("today");
  };

  const confirmDeleteAccount = async () => {
    const acc = confirmAccount;
    const nextAccounts = (accounts || []).filter((a) => a.id !== acc.id);
    setAccounts(nextAccounts);
    await saveAccounts(nextAccounts);
    await deleteAccountData(acc.id);
    if (activeId === acc.id) await logout();
    setConfirmAccount(null);
  };

  const toggleDark = () => update((d) => ({ ...d, settings: { ...d.settings, dark: !d.settings.dark } }));

  const handleToggle = (habit) => {
    const k = toKey(new Date());
    update((d) => {
      const hl = { ...(d.logs[habit.id] || {}) };
      const cur = hl[k];
      hl[k] = { completed: !(cur && cur.completed) };
      return { ...d, logs: { ...d.logs, [habit.id]: hl } };
    });
  };

  const handleAdjust = (habit, delta) => {
    const k = toKey(new Date());
    update((d) => {
      const hl = { ...(d.logs[habit.id] || {}) };
      const cur = hl[k] || { value: 0 };
      const value = Math.max(0, (cur.value || 0) + delta);
      hl[k] = { value, completed: value >= habit.target };
      return { ...d, logs: { ...d.logs, [habit.id]: hl } };
    });
  };

  // Variants that accept an arbitrary date (used by the table view)
  const handleToggleAt = (habit, date) => {
    const k = toKey(date);
    update((d) => {
      const hl = { ...(d.logs[habit.id] || {}) };
      const cur = hl[k];
      hl[k] = { completed: !(cur && cur.completed) };
      return { ...d, logs: { ...d.logs, [habit.id]: hl } };
    });
  };

  const handleAdjustAt = (habit, date, delta) => {
    const k = toKey(date);
    update((d) => {
      const hl = { ...(d.logs[habit.id] || {}) };
      const cur = hl[k] || { value: 0 };
      const value = Math.max(0, (cur.value || 0) + delta);
      hl[k] = { value, completed: value >= habit.target };
      return { ...d, logs: { ...d.logs, [habit.id]: hl } };
    });
  };

  const handleSave = (form) => {
    update((d) => {
      if (editing) return { ...d, habits: d.habits.map((h) => (h.id === editing.id ? { ...h, ...form } : h)) };
      const id = "h" + Date.now();
      return { ...d, habits: [...d.habits, { ...form, id, createdAt: toKey(new Date()) }], logs: { ...d.logs, [id]: {} } };
    });
    setModalOpen(false);
    setEditing(null);
  };

  const confirmDelete = () => {
    const habit = confirm;
    update((d) => {
      const logs2 = { ...d.logs };
      delete logs2[habit.id];
      return { ...d, habits: d.habits.filter((h) => h.id !== habit.id), logs: logs2 };
    });
    setConfirm(null);
  };

  const handleReset = () => {
    update((d) => ({ ...buildInitialData(), settings: { dark: d.settings.dark, onboarded: true } }));
    setTab("today");
  };

  const finishOnboarding = () => update((d) => ({ ...d, settings: { ...d.settings, onboarded: true } }));
  const showOnboarding = () => update((d) => ({ ...d, settings: { ...d.settings, onboarded: false } }));

  // ---- Task actions ----
  const handleAddTask = (title, priority) => {
    update((d) => {
      const task = { id: "t" + Date.now(), title, priority, completed: false, createdAt: Date.now() };
      return { ...d, tasks: [...(d.tasks || []), task] };
    });
  };
  const handleToggleTask = (id) => {
    update((d) => ({ ...d, tasks: (d.tasks || []).map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)) }));
  };
  const handleDeleteTask = (id) => {
    update((d) => ({ ...d, tasks: (d.tasks || []).filter((t) => t.id !== id) }));
  };
  const handleCycleTaskPriority = (id) => {
    const order = ["alta", "media", "baja"];
    update((d) => ({
      ...d,
      tasks: (d.tasks || []).map((t) => {
        if (t.id !== id) return t;
        return { ...t, priority: order[(order.indexOf(t.priority) + 1) % order.length] };
      }),
    }));
  };

  // ---- Event actions ----
  const handleSaveEvent = (event) => {
    update((d) => {
      const evs = d.events || [];
      if (event.id && evs.some((e) => e.id === event.id)) {
        return { ...d, events: evs.map((e) => (e.id === event.id ? event : e)) };
      }
      return { ...d, events: [...evs, { ...event, id: "e" + Date.now(), createdAt: Date.now() }] };
    });
  };
  const handleDeleteEvent = (id) => {
    update((d) => ({ ...d, events: (d.events || []).filter((e) => e.id !== id) }));
  };

  // ---- Goal actions ----
  const handleSaveGoal = (goal) => {
    update((d) => {
      const gs = d.goals || [];
      if (goal.id && gs.some((g) => g.id === goal.id)) {
        return { ...d, goals: gs.map((g) => (g.id === goal.id ? goal : g)) };
      }
      return { ...d, goals: [...gs, { ...goal, id: "g" + Date.now(), steps: goal.steps || [], createdAt: Date.now() }] };
    });
  };
  const handleDeleteGoal = (id) => {
    update((d) => ({ ...d, goals: (d.goals || []).filter((g) => g.id !== id) }));
  };

  if (loading || accounts === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-gray-400 flex flex-col items-center gap-2">
          <Target size={32} /><p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!activeId || !data) {
    return (
      <>
        <AuthScreen accounts={accounts} dark={false}
          onCreate={createAccount} onLogin={loginAccount} onDeleteAccount={(a) => setConfirmAccount(a)} />
        <ConfirmDialog open={!!confirmAccount} dark={false}
          title="Eliminar cuenta"
          message={`Se borrarán todos los hábitos e historial de "${confirmAccount?.name}". Esta acción no se puede deshacer.`}
          onConfirm={confirmDeleteAccount} onCancel={() => setConfirmAccount(null)} />
      </>
    );
  }

  if (!data.settings?.onboarded) {
    return <Onboarding dark={dark} onFinish={finishOnboarding} />;
  }

  if (showEvents) {
    return (
      <EventsCalendarView events={events} dark={dark}
        onBack={() => setShowEvents(false)}
        onSave={handleSaveEvent} onDelete={handleDeleteEvent} />
    );
  }

  const bg = dark ? "bg-gray-900" : "bg-gray-50";
  const txt = dark ? "text-white" : "text-gray-900";
  const activeAccount = accounts.find((a) => a.id === activeId);

  // Estadísticas en vivo del día (para la barra del Tracker)
  const todayDate = new Date();
  const todayScheduled = habits.filter((h) => isScheduledOn(h, todayDate));
  const todayDone = todayScheduled.filter((h) => isCompletedOn(h, logs, todayDate)).length;
  const todayPending = Math.max(0, todayScheduled.length - todayDone);
  const todayPct = todayScheduled.length ? Math.round((todayDone / todayScheduled.length) * 100) : 0;

  const tabs = [
    { id: "today", name: "Hoy", icon: Home },
    { id: "metas", name: "Metas", icon: Flag },
    { id: "tasks", name: "Tareas", icon: ListTodo },
    { id: "tracker", name: "Tracker", icon: LayoutGrid },
    { id: "calendar", name: "Calend.", icon: CalendarIcon },
    { id: "stats", name: "Stats", icon: BarChart3 },
    { id: "settings", name: "Ajustes", icon: Settings },
  ];
  const titles = { today: "Hoy", metas: "Metas", tasks: "Tareas", tracker: "Tracker", calendar: "Calendario", stats: "Estadísticas", settings: "Ajustes" };

  return (
    <div className={`${bg} min-h-screen transition-colors duration-300`} style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="lg:flex lg:max-w-6xl lg:mx-auto lg:min-h-screen">
        {/* Barra lateral — solo en pantallas grandes (PC) */}
        <aside className={`hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen border-r p-4 ${dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
          <div className="flex items-center gap-2 px-2 py-3 mb-3">
            <div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "#3b82f61a" }}>
              <Target size={22} color="#3b82f6" />
            </div>
            <div className="min-w-0">
              <p className={`font-bold ${txt}`}>HabitNow</p>
              <p className={`text-xs truncate ${dark ? "text-gray-400" : "text-gray-500"}`}>{activeAccount?.name}</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1">
            {tabs.map((t) => {
              const Icon = t.icon; const on = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition ${on ? "bg-blue-500 text-white" : (dark ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100")}`}>
                  <Icon size={20} strokeWidth={on ? 2.5 : 2} /> <span>{titles[t.id]}</span>
                </button>
              );
            })}
          </nav>
          <button onClick={toggleDark}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium ${dark ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"}`}>
            {dark ? <Sun size={20} /> : <Moon size={20} />} <span>Modo {dark ? "claro" : "oscuro"}</span>
          </button>
        </aside>

        {/* Columna de contenido */}
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-none mx-auto lg:mx-0 lg:flex-1 relative min-h-screen flex flex-col">
        <header className={`sticky top-0 z-30 ${bg} px-4 pt-5 pb-3 flex items-center justify-between lg:max-w-3xl lg:mx-auto lg:w-full`}>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-2xl font-bold ${txt}`}>{titles[tab]}</h1>
              {tab === "calendar" && (
                <button onClick={() => setShowEvents(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 active:scale-95 transition shadow-sm shadow-blue-500/30">
                  <CalendarPlus size={14} /> Eventos
                </button>
              )}
            </div>
            {tab === "today" && <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-500"}`}>Hola, {activeAccount?.name} 👋</p>}
          </div>
          <button onClick={toggleDark} className={`p-2.5 rounded-full lg:hidden ${dark ? "bg-gray-800 text-amber-400" : "bg-white text-gray-600 border border-gray-200"}`}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <main className={`flex-1 lg:max-w-3xl lg:mx-auto lg:w-full ${tab === "tracker" ? "pb-44 lg:pb-12" : "pb-24 lg:pb-12"}`}>
          {tab === "today" && (
            <TodayView habits={habits} logs={logs} dark={dark}
              onToggle={handleToggle} onAdjust={handleAdjust}
              onEdit={(h) => { setEditing(h); setModalOpen(true); }} onDelete={(h) => setConfirm(h)}
              onCreate={() => { setEditing(null); setModalOpen(true); }} />
          )}
          {tab === "metas" && (
            <GoalsView goals={goals} dark={dark} onSave={handleSaveGoal} onDelete={handleDeleteGoal} />
          )}
          {tab === "tasks" && (
            <TasksView tasks={tasks} dark={dark}
              onAdd={handleAddTask} onToggle={handleToggleTask}
              onDelete={handleDeleteTask} onCyclePriority={handleCycleTaskPriority} />
          )}
          {tab === "tracker" && (
            <TableView habits={habits} logs={logs} dark={dark}
              onToggleAt={handleToggleAt} onAdjustAt={handleAdjustAt}
              onEdit={(h) => { setEditing(h); setModalOpen(true); }}
              onCreate={() => { setEditing(null); setModalOpen(true); }} />
          )}
          {tab === "calendar" && <CalendarView habits={habits} logs={logs} dark={dark} />}
          {tab === "stats" && <StatsView habits={habits} logs={logs} dark={dark} />}
          {tab === "settings" && (
            <SettingsView habits={habits} dark={dark} toggleDark={toggleDark}
              onResetData={handleReset} onShowTutorial={showOnboarding}
              accountName={activeAccount?.name} accountCreatedAt={activeAccount?.createdAt} onLogout={logout} />
          )}
        </main>

        {(tab === "today" || tab === "tracker") && (
          <button onClick={() => { setEditing(null); setModalOpen(true); }}
            className={`fixed right-5 lg:right-8 z-40 ${tab === "tracker" ? "bottom-44" : "bottom-24"} lg:bottom-8`}>
            <span className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/40 hover:bg-blue-600 active:scale-90 transition">
              <Plus size={28} />
            </span>
          </button>
        )}

        {/* Barra de estado del día — solo visible en el Tracker */}
        {tab === "tracker" && habits.length > 0 && (
          <div className="fixed left-1/2 -translate-x-1/2 max-w-md md:max-w-2xl w-full px-3 z-30 lg:hidden"
            style={{ bottom: "60px" }}>
            <div className={`rounded-2xl border shadow-lg p-3 ${dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`}>
              {todayScheduled.length === 0 ? (
                <p className={`text-center text-sm font-medium ${dark ? "text-gray-400" : "text-gray-500"}`}>
                  Sin hábitos programados hoy
                </p>
              ) : (
                <>
                  <div className={`h-1.5 rounded-full overflow-hidden mb-2.5 ${dark ? "bg-gray-700" : "bg-gray-100"}`}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${todayPct}%`,
                        background: todayPct === 100 ? "#10b981" : "#3b82f6",
                      }} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className={`text-xl font-extrabold ${todayPct === 100 ? "text-emerald-500" : "text-blue-500"}`}>
                        {todayPct}%
                      </span>
                      <span className={`text-xs font-medium ${dark ? "text-gray-400" : "text-gray-500"} truncate`}>
                        {todayDone}/{todayScheduled.length} hábitos
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
                        style={{ background: "#10b98122", color: "#10b981" }}>
                        <Check size={12} strokeWidth={3} /> {todayDone}
                      </span>
                      <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
                        style={{ background: "#ef444422", color: "#ef4444" }}>
                        <X size={12} strokeWidth={3} /> {todayPending}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <nav className={`fixed bottom-0 left-1/2 -translate-x-1/2 max-w-md md:max-w-2xl w-full ${dark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"} border-t z-30 lg:hidden`}>
          <div className="flex items-center justify-around px-2 py-2">
            {tabs.map((t) => {
              const Icon = t.icon;
              const on = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} className="flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-xl transition flex-1">
                  <Icon size={21} color={on ? "#3b82f6" : (dark ? "#6b7280" : "#9ca3af")} strokeWidth={on ? 2.5 : 2} />
                  <span className="text-[9px] font-medium whitespace-nowrap" style={{ color: on ? "#3b82f6" : (dark ? "#6b7280" : "#9ca3af") }}>{t.name}</span>
                </button>
              );
            })}
          </div>
        </nav>
        </div>
      </div>

      <HabitModal open={modalOpen} editing={editing} dark={dark}
        onClose={() => { setModalOpen(false); setEditing(null); }} onSave={handleSave} />

      <ConfirmDialog open={!!confirm} dark={dark}
        title="Eliminar hábito"
        message={`¿Seguro que quieres eliminar "${confirm?.name}"? Se perderá su historial.`}
        onConfirm={confirmDelete} onCancel={() => setConfirm(null)} />
    </div>
  );
}
