import * as XLSX from "xlsx";

/**
 * Pembantu kecil untuk membaca file export ECOUNT, dipakai bersama oleh
 * parser kontrabon (Sales List) dan parser free qty (Sales Status Details).
 */

/** Isi sheet pertama sebagai matriks baris x kolom (nilai mentah). */
export function readFirstSheetMatrix(buffer: ArrayBuffer | Buffer): unknown[][] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
  });
}

/** Nama kolom dicocokkan longgar: huruf kecil, spasi ganda dirapikan. */
export function normalizeHeader(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Posisi kolom tiap field berdasarkan daftar alias nama kolomnya. */
export function buildColumnMap<K extends string>(
  headerRow: unknown[],
  aliases: Record<K, readonly string[]>
): Partial<Record<K, number>> {
  const normalized = headerRow.map(normalizeHeader);
  const map: Partial<Record<K, number>> = {};
  for (const field of Object.keys(aliases) as K[]) {
    const idx = normalized.findIndex((h) => aliases[field].includes(h));
    if (idx !== -1) map[field] = idx;
  }
  return map;
}

export function parseNumberCell(v: unknown): number {
  if (typeof v === "number") return v;
  if (v == null || v === "") return 0;
  const cleaned = String(v).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export function textAt(row: unknown[], idx: number | undefined): string {
  if (idx === undefined) return "";
  return String(row[idx] ?? "").trim();
}

// Baris footer ECOUNT biasanya berupa timestamp cetak, misal:
// "23/09/2026 (Wed) 9:24:04" -- ini bukan baris data, jadi jadi sinyal berhenti.
export const TIMESTAMP_ROW_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}\s*\(\w+\)/;
