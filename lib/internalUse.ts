/**
 * Aturan pengisian template upload ECOUNT "Internal Use" untuk free qty.
 * File ini sengaja tidak mengimpor `fs` supaya bisa dipakai di halaman web
 * (pilihan PIC, pratinjau Remark) maupun di server (pembuat file Excel).
 *
 * Nilai tetap di bawah ditentukan oleh tim (lihat README):
 * - Location-Out 00009, Usage Type 00026
 * - Gross weight 0, Koli Barang 0, No. PO Customer "-"
 * - 1 slip (Seq. No.) maksimal 1000 baris
 * - Remark: "QTY FREE DD - MM - YYYY" (tanggal input)
 */

export const LOCATION_OUT = "00009";
export const USAGE_TYPE = "00026";
export const PO_CUSTOMER_PLACEHOLDER = "-";
export const GROSS_WEIGHT = 0;
export const KOLI = 0;

/** Baris ke-1..1000 masuk Seq. No. 1, ke-1001..2000 Seq. No. 2, dst. */
export const ROWS_PER_SLIP = 1000;

/** Batas panjang Item Code di ECOUNT. */
export const ITEM_CODE_MAX_LENGTH = 20;
/** Qty ECOUNT: maksimal 12 digit bilangan bulat. */
const QTY_MAX = 999_999_999_999;
/** Pengaman supaya endpoint tidak diminta membuat file raksasa. */
export const MAX_LINES = 20_000;

export interface PicOption {
  code: string;
  name: string;
}

/** PIC yang boleh dipilih; kodenya harus sama dengan kode PIC di ECOUNT. */
export const PIC_LIST: readonly PicOption[] = [
  { code: "58", name: "Fajri" },
  { code: "157", name: "Adi Kusuma" },
  { code: "151", name: "Irfan" },
];

export function findPic(code: string): PicOption | undefined {
  return PIC_LIST.find((p) => p.code === code);
}

interface DateParts {
  dd: string;
  mm: string;
  yyyy: string;
}

/** "YYYY-MM-DD" (nilai input date) -> bagian tanggal; null kalau tidak valid. */
function parseIsoDate(value: string): DateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [, yyyy, mm, dd] = m;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const isRealDate =
    date.getFullYear() === Number(yyyy) &&
    date.getMonth() === Number(mm) - 1 &&
    date.getDate() === Number(dd);
  return isRealDate ? { dd, mm, yyyy } : null;
}

export function isValidIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null;
}

function requireDate(value: string): DateParts {
  const parts = parseIsoDate(value);
  if (!parts) throw new Error(`Tanggal tidak valid: "${value}".`);
  return parts;
}

/** Kolom Date template ECOUNT: "DDMMYYYY". */
export function ecountDate(isoDate: string): string {
  const { dd, mm, yyyy } = requireDate(isoDate);
  return `${dd}${mm}${yyyy}`;
}

/** Tanggal untuk nama file: "24-11-2026". */
export function fileNameDate(isoDate: string): string {
  const { dd, mm, yyyy } = requireDate(isoDate);
  return `${dd}-${mm}-${yyyy}`;
}

/** Kolom Remark: "QTY FREE 24 - 11 - 2026". */
export function freeQtyRemark(isoDate: string): string {
  const { dd, mm, yyyy } = requireDate(isoDate);
  return `QTY FREE ${dd} - ${mm} - ${yyyy}`;
}

/** Seq. No. untuk baris ke-`index` (mulai 0). */
export function slipSeqNo(index: number): number {
  return Math.floor(index / ROWS_PER_SLIP) + 1;
}

export interface FreeQtyLine {
  itemCode: string;
  qty: number;
}

/** Isi satu baris template Internal Use (kolom yang dikosongkan tidak ada). */
export interface InternalUseRow {
  date: string;
  seqNo: number;
  locationOut: string;
  pic: string;
  grossWeight: number;
  koli: number;
  poCustomer: string;
  itemCode: string;
  qty: number;
  usageType: string;
  remark: string;
}

export interface InternalUseOptions {
  /** tanggal input ke ECOUNT, "YYYY-MM-DD" */
  date: string;
  picCode: string;
}

export function toInternalUseRows(
  lines: readonly FreeQtyLine[],
  { date, picCode }: InternalUseOptions
): InternalUseRow[] {
  if (!findPic(picCode)) {
    throw new Error(`Kode PIC "${picCode}" tidak terdaftar.`);
  }
  const ecount = ecountDate(date);
  const remark = freeQtyRemark(date);

  return lines.map((line, i) => ({
    date: ecount,
    seqNo: slipSeqNo(i),
    locationOut: LOCATION_OUT,
    pic: picCode,
    grossWeight: GROSS_WEIGHT,
    koli: KOLI,
    poCustomer: PO_CUSTOMER_PLACEHOLDER,
    itemCode: line.itemCode,
    qty: line.qty,
    usageType: USAGE_TYPE,
    remark,
  }));
}

/* ---------- validasi body API ---------- */

export interface InternalUseRequest {
  tanggal: string;
  picCode: string;
  rows: FreeQtyLine[];
}

export type ValidationResult =
  | { ok: true; value: InternalUseRequest }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateLine(raw: unknown, index: number): FreeQtyLine | string {
  const label = `Baris ${index + 1}`;
  if (!isRecord(raw)) return `${label}: data tidak valid.`;

  const itemCode = typeof raw.itemCode === "string" ? raw.itemCode.trim() : "";
  if (!itemCode || itemCode.length > ITEM_CODE_MAX_LENGTH) {
    return `${label}: Item Code wajib diisi (maks. ${ITEM_CODE_MAX_LENGTH} karakter).`;
  }

  const { qty } = raw;
  if (typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0 || qty > QTY_MAX) {
    return `${label} (${itemCode}): Qty free harus angka lebih dari 0.`;
  }
  return { itemCode, qty };
}

/** Periksa body POST /api/internal-use sebelum file dibuat. */
export function validateInternalUseRequest(body: unknown): ValidationResult {
  if (!isRecord(body)) return { ok: false, error: "Body permintaan tidak valid." };

  const tanggal = typeof body.tanggal === "string" ? body.tanggal : "";
  if (!isValidIsoDate(tanggal)) {
    return { ok: false, error: "Tanggal tidak valid." };
  }

  const picCode = typeof body.picCode === "string" ? body.picCode : "";
  if (!findPic(picCode)) {
    return { ok: false, error: "PIC belum dipilih atau tidak terdaftar." };
  }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return { ok: false, error: "Pilih minimal 1 baris free qty." };
  }
  if (body.rows.length > MAX_LINES) {
    return {
      ok: false,
      error: `Terlalu banyak baris (${body.rows.length}); maksimal ${MAX_LINES} per file.`,
    };
  }

  const rows: FreeQtyLine[] = [];
  for (const [i, raw] of body.rows.entries()) {
    const line = validateLine(raw, i);
    if (typeof line === "string") return { ok: false, error: line };
    rows.push(line);
  }

  return { ok: true, value: { tanggal, picCode, rows } };
}
