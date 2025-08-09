/**
 * Utilidades varias (formateo, fechas, validaciones, UI).
 * @module utils
 */

export const fmtEUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Convierte serial Excel (sistema 1900) a 'YYYY-MM-DD'. */
export function fromExcelSerial(n) {
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const ms = n * 86400000;
  const d = new Date(epoch.getTime() + ms);
  return d.toISOString().slice(0, 10);
}

/** Normaliza valores de celda fecha a 'YYYY-MM-DD'. */
export function parseDateCell(v) {
  if (!v) return "";
  if (typeof v === "number") return fromExcelSerial(v);
  if (typeof v === "string") {
    if (v.includes("T")) return v.split("T")[0];
    if (v.includes("/")) {
      const [d, m, y] = v.split("/");
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    return v;
  }
  return String(v);
}

export function showLoading(b) {
  const el = document.getElementById('loading');
  el.classList.toggle('show', !!b);
  el.setAttribute('aria-busy', b ? 'true' : 'false');
}

/** Toastify wrapper */
export function toast(msg, type = "info") {
  const color = { success: "#22c55e", error: "#ef4444", warning: "#f59e0b", info: "#4c92ff" }[type] || "#4c92ff";
  Toastify({ text: msg, duration: 2500, gravity: "top", position: "right", style: { background: color } }).showToast();
}

/** Festivos del mes por sede */
export function getFestivosByMonthSede(festivos, yyyyMM, sede) {
  const s = (sede || "").toLowerCase();
  return festivos.filter(f => f.fecha.startsWith(yyyyMM) && (!s || f.sede === s));
}

/** Días laborables L–V del mes menos festivos/vacaciones. */
export function getWorkingDaysYYYYMM(yyyyMM, festivos, sede, vacacionesCsv) {
  const [Y, Mnum] = yyyyMM.split('-').map(Number);
  const monthIndex = Mnum - 1;
  const lastDay = new Date(Y, monthIndex + 1, 0).getDate();
  const vacSet = new Set((vacacionesCsv || "").split(',').map(s => s.trim()).filter(Boolean));
  const festSet = new Set(getFestivosByMonthSede(festivos, yyyyMM, sede).map(f => f.fecha));
  const days = [];
  for (let d = 1; d <= lastDay; d++) {
    const date = `${Y}-${String(Mnum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    if (festSet.has(date)) continue;
    if (vacSet.has(date)) continue;
    days.push(d);
  }
  return days;
}

export function getRelativeTodayDay(yyyyMM) {
  const [y, m] = yyyyMM.split('-').map(Number);
  const now = new Date();
  const ny = now.getFullYear(), nm = now.getMonth() + 1;
  if (y === ny && m === nm) return now.getDate();
  return null;
}

export function monthOf(dateStr) { return dateStr.slice(0, 7); }

/** Detección de expediente duplicado por usuario/mes. */
export function isExpedienteDuplicateForUserMonth(entries, email, yyyyMM, expediente, ignoreId = null) {
  return entries.some(e =>
    e.email === email.toLowerCase() &&
    e.fecha.startsWith(yyyyMM) &&
    e.expediente === expediente &&
    e.id !== ignoreId
  );
}
