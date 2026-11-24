/**
 * Aturan pengisian template upload ECOUNT "Internal Use", dipakai menu
 * Internal Use Free Qty dan Internal Use Reject. File ini sengaja tidak
 * mengimpor `fs` supaya bisa dipakai di halaman web (pilihan PIC, pratinjau)
 * maupun di server (pembuat file Excel).
 *
 * Nilai tetap di bawah ditentukan oleh tim (lihat README), sama untuk kedua
 * menu:
 * - Location-Out 00009
 * - Gross weight 0, Koli Barang 0, No. PO Customer "-"
 * - 1 slip (Seq. No.) maksimal 1000 baris
 *
 * Yang berbeda per menu hanya Usage Type dan Remark:
 * - Free Qty : Usage Type 00026, Remark "QTY FREE DD - MM - YYYY"
 * - Reject   : Usage Type 00035..00038 (Reject 1..4), Remark = Flight Number
 */

export const LOCATION_OUT = "00009";
export const PO_CUSTOMER_PLACEHOLDER = "-";
export const GROSS_WEIGHT = 0;
export const KOLI = 0;
export const FREE_QTY_USAGE_TYPE = "00026";

/** Baris ke-1..1000 masuk Seq. No. 1, ke-1001..2000 Seq. No. 2, dst. */
export const ROWS_PER_SLIP = 1000;

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

export type RejectCategoryNo = 1 | 2 | 3 | 4;

export interface RejectCategory {
  no: RejectCategoryNo;
  /** kode Usage Type di ECOUNT */
  usageType: string;
  label: string;
  /** keterangan kolom di laporan Goods Receipt Status */
  description: string;
}

export const REJECT_CATEGORIES: readonly RejectCategory[] = [
  { no: 1, usageType: "00035", label: "Reject 1", description: "Material/Setting/Sambungan" },
  { no: 2, usageType: "00036", label: "Reject 2", description: "Slitting/Sonic" },
  { no: 3, usageType: "00037", label: "Reject 3", description: "Printing" },
  { no: 4, usageType: "00038", label: "Reject 4", description: "Cut&Fold" },
];

export function findRejectCategory(no: unknown): RejectCategory | undefined {
  return REJECT_CATEGORIES.find((c) => c.no === no);
}

/* ---------- tanggal ---------- */

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

/** Remark Free Qty: "QTY FREE 24 - 11 - 2026". */
export function freeQtyRemark(isoDate: string): string {
  const { dd, mm, yyyy } = requireDate(isoDate);
  return `QTY FREE ${dd} - ${mm} - ${yyyy}`;
}

/** Seq. No. untuk baris ke-`index` (mulai 0). */
export function slipSeqNo(index: number): number {
  return Math.floor(index / ROWS_PER_SLIP) + 1;
}

/* ---------- baris data ---------- */

/** Satu baris data template; yang beda per menu hanya usageType & remark. */
export interface InternalUseLine {
  itemCode: string;
  qty: number;
  usageType: string;
  remark: string;
}

export interface FreeQtyLine {
  itemCode: string;
  qty: number;
}

export interface RejectLine {
  itemCode: string;
  qty: number;
  category: RejectCategoryNo;
  flightNo: string;
}

export function freeQtyLines(
  lines: readonly FreeQtyLine[],
  isoDate: string
): InternalUseLine[] {
  const remark = freeQtyRemark(isoDate);
  return lines.map(({ itemCode, qty }) => ({
    itemCode,
    qty,
    usageType: FREE_QTY_USAGE_TYPE,
    remark,
  }));
}

export function rejectLines(lines: readonly RejectLine[]): InternalUseLine[] {
  return lines.map(({ itemCode, qty, category, flightNo }) => {
    const found = findRejectCategory(category);
    if (!found) throw new Error(`Kategori reject ${category} tidak dikenal.`);
    return { itemCode, qty, usageType: found.usageType, remark: flightNo };
  });
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
  lines: readonly InternalUseLine[],
  { date, picCode }: InternalUseOptions
): InternalUseRow[] {
  if (!findPic(picCode)) {
    throw new Error(`Kode PIC "${picCode}" tidak terdaftar.`);
  }
  const ecount = ecountDate(date);

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
    usageType: line.usageType,
    remark: line.remark,
  }));
}

/* ---------- jenis menu ---------- */

export type InternalUseKind = "free" | "reject";

/** Dipakai di nama file: "Internal Use Free Qty 24-11-2026.xlsx". */
export const KIND_TITLE: Record<InternalUseKind, string> = {
  free: "Free Qty",
  reject: "Reject",
};
