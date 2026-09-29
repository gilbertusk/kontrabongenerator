/**
 * Urutan invoice di kontrabon, dipakai bersama oleh preview web dan export
 * Excel supaya keduanya selalu sama.
 *
 * Aturan:
 * 1. Invoice diurutkan dari tanggal paling lama ke paling baru (tanggal sama
 *    -> nomor invoice kecil dulu; tanggal tak terbaca ditaruh paling bawah).
 * 2. Invoice dengan No. PO yang sama dikumpulkan jadi satu blok, ditaruh di
 *    posisi invoice PO itu yang paling lama; di dalam blok tetap urut aturan 1.
 * 3. No. PO kosong tidak dianggap sama satu sama lain.
 */

export interface OrderableRow {
  invoiceNo: string;
  dateValue: number;
  poCustomer: string;
}

/** Kunci pembanding No. PO: abaikan beda spasi & huruf besar/kecil. */
export function poKey(po: string): string {
  return (po || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function compareChronologically(a: OrderableRow, b: OrderableRow): number {
  const aInvalid = isNaN(a.dateValue);
  const bInvalid = isNaN(b.dateValue);
  if (aInvalid !== bInvalid) return aInvalid ? 1 : -1;
  if (!aInvalid && a.dateValue !== b.dateValue) return a.dateValue - b.dateValue;
  return a.invoiceNo.localeCompare(b.invoiceNo, undefined, { numeric: true });
}

export function orderRows<T extends OrderableRow>(rows: readonly T[]): T[] {
  const sorted = [...rows].sort(compareChronologically);

  const byPo = new Map<string, T[]>();
  for (const row of sorted) {
    const key = poKey(row.poCustomer);
    if (!key) continue;
    byPo.set(key, [...(byPo.get(key) ?? []), row]);
  }

  const emittedPo = new Set<string>();
  return sorted.flatMap((row) => {
    const key = poKey(row.poCustomer);
    if (!key) return [row];
    if (emittedPo.has(key)) return [];
    emittedPo.add(key);
    return byPo.get(key) ?? [row];
  });
}

/**
 * No. PO yang dipakai lebih dari satu invoice, dipetakan ke nomor grup
 * (0, 1, 2, ...) sesuai urutan kemunculannya. Dipakai untuk menyorot baris.
 */
export function duplicatePoGroups(rows: readonly OrderableRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = poKey(row.poCustomer);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const groups = new Map<string, number>();
  for (const row of rows) {
    const key = poKey(row.poCustomer);
    if ((counts.get(key) ?? 0) > 1 && !groups.has(key)) {
      groups.set(key, groups.size);
    }
  }
  return groups;
}

/* ---------- urutan manual ---------- */

/** Nomor urut yang diketik user, per id baris; string kosong = tidak ikut. */
export type ManualNumbers = Readonly<Record<string, string>>;

/** "3" -> 3; kosong, 0, negatif, atau bukan bilangan bulat -> null. */
export function parseManualNo(value: string | undefined): number | null {
  const text = (value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n > 0 ? n : null;
}

/** Nomori baris 1, 2, 3, ... sesuai urutan yang diberikan. */
export function numberRows(rows: readonly { id: string }[]): ManualNumbers {
  return Object.fromEntries(rows.map((r, i) => [r.id, String(i + 1)]));
}

/**
 * Baris yang punya nomor urut valid, diurutkan menurut nomor itu. Nomor tidak
 * harus rapat (1, 2, 5 tetap jalan); di Excel tetap dinomori ulang 1..n.
 */
export function orderManually<T extends { id: string }>(
  rows: readonly T[],
  numbers: ManualNumbers
): T[] {
  return rows
    .map((row, index) => ({ row, index, no: parseManualNo(numbers[row.id]) }))
    .filter((x): x is { row: T; index: number; no: number } => x.no !== null)
    .sort((a, b) => a.no - b.no || a.index - b.index)
    .map((x) => x.row);
}

/** Nomor urut yang dipakai lebih dari satu baris (di antara `ids`). */
export function duplicateManualNumbers(
  ids: readonly string[],
  numbers: ManualNumbers
): Set<number> {
  const seen = new Set<number>();
  const dup = new Set<number>();
  for (const id of ids) {
    const n = parseManualNo(numbers[id]);
    if (n === null) continue;
    if (seen.has(n)) dup.add(n);
    seen.add(n);
  }
  return dup;
}
