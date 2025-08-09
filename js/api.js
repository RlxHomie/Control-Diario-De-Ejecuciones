/**
 * Capa de acceso a Microsoft Graph / Excel.
 * @module api
 */

import { getAccessToken } from './auth.js';
import { EXCEL } from './config.js';

/** Fetch a Graph API con token + retry 429. */
export async function graphFetch(url, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` }
  });
  if (res.status === 429) {
    const wait = parseInt(res.headers.get("Retry-After") || "2", 10) * 1000;
    await new Promise(r => setTimeout(r, wait));
    return graphFetch(url, options);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Graph error ${res.status}: ${txt}`);
  }
  return res;
}

/** Ejecuta $batch. */
export async function graphBatch(requests) {
  const token = await getAccessToken();
  const res = await fetch("https://graph.microsoft.com/v1.0/$batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests })
  });
  if (!res.ok) throw new Error(`Batch error ${res.status}`);
  return (await res.json()).responses;
}

/** Helpers tablas */
const base = (fileId) => `/me/drive/items/${fileId}/workbook/tables`;

export async function getTableRows(tableName) {
  const url = `https://graph.microsoft.com/v1.0${base(EXCEL.fileId)}('${tableName}')/rows`;
  const res = await graphFetch(url);
  const data = await res.json();
  return data.value || [];
}

export async function addRow(tableName, rowValues) {
  const url = `https://graph.microsoft.com/v1.0${base(EXCEL.fileId)}('${tableName}')/rows/add`;
  await graphFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: [rowValues] }) });
}

export async function replaceRow(tableName, rowIndex, rowValues) {
  const url = `https://graph.microsoft.com/v1.0${base(EXCEL.fileId)}('${tableName}')/rows/${rowIndex}/range`;
  await graphFetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: [rowValues] }) });
}

export async function deleteRow(tableName, rowIndex) {
  const url = `https://graph.microsoft.com/v1.0${base(EXCEL.fileId)}('${tableName}')/rows/${rowIndex}`;
  await graphFetch(url, { method: "DELETE" });
}

/** Reconstruye mapa id→rowIndex tras add/delete. */
export async function refreshRowIndex(tableName, map) {
  map.clear();
  const rows = await getTableRows(tableName);
  rows.forEach(r => {
    const id = String(r.values[0][0] || "");
    if (id) map.set(id, r.index);
  });
}
