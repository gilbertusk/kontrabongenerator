import * as XLSX from "xlsx";

export interface EcountRow {
  /** key unik untuk React list & seleksi (bukan data bisnis) */
  id: string;
  number?: string;
  /**
   * Nomor yang dipakai di kolom "INVOICE" kontrabon.
   * Diambil dari "Receivable No." (nomor faktur) bila ada; kalau kosong,
   * mundur ke "No. SJ" (nomor surat jalan). Pada file format lama yang hanya
   * punya kolom "Invoice", nilainya dari kolom itu.
   */
  invoiceNo: string;
  /** asal `invoiceNo`: nomor faktur, atau nomor surat jalan sebagai pengganti */
  invoiceNoSource: "receivable" | "sj";
  /** kolom "Receivable No." / "Invoice"; "" kalau kosong atau tidak ada */
  receivableNo: string;
  /** kolom "No. SJ" (format baru); "" kalau tidak ada */
  sjNo: string;
  /** tanggal apa adanya untuk ditampilkan, format dd/mm/yyyy bila bisa dideteksi */
  dateStr: string;
  /** timestamp (ms) untuk keperluan sorting, NaN jika tidak terbaca */
  dateValue: number;
  amount: number;
  foreignAmount: number | null;
  poCustomer: string;
  flightNumber: string;
  customer: string;
  /** kolom "Progress Status" (format baru), mis. "KONTRA BON" / "CORETAX" */
  progressStatus: string;
  /** kolom "No. Kontra Bon" (format baru): nomor kontrabon yang sudah dipakai */
  existingKontrabonNo: string;
  /**
   * Baris ini sudah pernah masuk kontrabon sebelumnya, jadi tidak dicentang
   * otomatis supaya tidak tertagih dua kali.
   */
  alreadyBilled: boolean;
}

/** Kolom opsional yang benar-benar ada di file yang baru dibaca. */
export interface AvailableColumns {
  receivableNo: boolean;
  sjNo: boolean;
  progressStatus: boolean;
  existingKontrabonNo: boolean;
  foreignAmount: boolean;
}

export interface ParseResult {
  rows: EcountRow[];
  customers: string[];
  warnings: string[];
  available: AvailableColumns;
}

// Alias nama kolom yang dikenali dari file export ECOUNT ("Sales List" dsb).
// Cocokkan secara longgar (lowercase, tanpa titik/spasi ganda) supaya tahan
// terhadap variasi kecil nama kolom antar jenis laporan ECOUNT.
//
// Dua bentuk export yang sudah pernah dipakai:
//  - lama : Number | Invoice | Date | Total Amount | Total Foreign Currency
//           Amount | No. PO Customer | Flight Number | CUST.
//  - baru : Number | Receivable No. | No. SJ | Date | Total Amount | Total
//           Foreign Currency Amount | No. PO Customer | Flight Number |
//           CUST. | Progress Status | No. Kontra Bon
const HEADER_ALIASES: Record<string, string[]> = {
  number: ["number", "no"],
  receivableNo: [
    "invoice",
    "invoice no",
    "invoice no.",
    "no invoice",
    "no. invoice",
    "receivable",
    "receivable no",
    "receivable no.",
    "no receivable",
    "no. receivable",
  ],
  sjNo: [
    "no. sj",
    "no sj",
    "sj",
    "no. surat jalan",
    "no surat jalan",
    "surat jalan",
    "no. do",
    "no do",
  ],
  date: ["date", "tanggal"],
  amount: ["total amount", "amount", "jumlah", "total"],
  foreignAmount: [
    "total foreign currency amount",
    "foreign currency amount",
    "foreign amount",
  ],
  poCustomer: [
    "no. po customer",
    "no po customer",
    "po customer",
    "no. po",
    "no po",
  ],
  flightNumber: ["flight number", "flight no", "flight no.", "no flight"],
  customer: ["cust.", "cust", "customer", "customer name", "nama customer"],
  progressStatus: ["progress status", "status", "status progress"],
  existingKontrabonNo: [
    "no. kontra bon",
    "no kontra bon",
    "kontra bon",
    "no. kontrabon",
    "no kontrabon",
    "kontrabon",
  ],
};

/** Nilai "Progress Status" yang berarti barisnya sudah masuk kontrabon. */
const BILLED_STATUSES = ["kontra bon", "kontrabon"];

function normalizeHeader(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findHeaderRow(matrix: unknown[][]): number {
  const maxScan = Math.min(matrix.length, 15);
  for (let r = 0; r < maxScan; r++) {
    const row = matrix[r] || [];
    const normalized = row.map(normalizeHeader);
    // Nomor dokumen boleh datang dari kolom faktur ("Invoice"/"Receivable No.")
    // atau dari kolom surat jalan ("No. SJ") -- format baru tidak punya kolom
    // bernama "Invoice" lagi.
    const hasDocNo =
      normalized.some((c) => HEADER_ALIASES.receivableNo.includes(c)) ||
      normalized.some((c) => HEADER_ALIASES.sjNo.includes(c));
    const hasDate = normalized.some((c) => HEADER_ALIASES.date.includes(c));
    const hasAmount = normalized.some((c) =>
      HEADER_ALIASES.amount.includes(c)
    );
    if (hasDocNo && hasDate && hasAmount) return r;
  }
  return -1;
}

function buildColumnMap(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  const normalized = headerRow.map(normalizeHeader);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx !== -1) map[field] = idx;
  }
  return map;
}

// Baris footer ECOUNT biasanya berupa timestamp cetak, misal:
// "23/09/2026 (Wed) 9:24:04" -- ini bukan baris data, jadi jadi sinyal berhenti.
const TIMESTAMP_ROW_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}\s*\(\w+\)/;

function parseDateCell(v: unknown): { str: string; value: number } {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const dd = String(v.getDate()).padStart(2, "0");
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const yyyy = v.getFullYear();
    return { str: `${dd}/${mm}/${yyyy}`, value: v.getTime() };
  }
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const yyyy = parseInt(m[3], 10) + (m[3].length === 2 ? 2000 : 0);
    const d = new Date(yyyy, mm - 1, dd);
    return {
      str: `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${yyyy}`,
      value: d.getTime(),
    };
  }
  const parsed = Date.parse(s);
  return { str: s, value: isNaN(parsed) ? NaN : parsed };
}

function parseNumberCell(v: unknown): number {
  if (typeof v === "number") return v;
  if (v == null || v === "") return 0;
  const cleaned = String(v).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function textAt(row: unknown[], idx: number | undefined): string {
  if (idx === undefined) return "";
  return String(row[idx] ?? "").trim();
}

/**
 * Parse file export ECOUNT (xlsx) jadi daftar invoice terstruktur.
 * `buffer` boleh ArrayBuffer (browser) atau Buffer (Node/serverless).
 */
export function parseEcountWorkbook(buffer: ArrayBuffer | Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
  });

  const warnings: string[] = [];
  const noColumns: AvailableColumns = {
    receivableNo: false,
    sjNo: false,
    progressStatus: false,
    existingKontrabonNo: false,
    foreignAmount: false,
  };

  const headerRowIdx = findHeaderRow(matrix);
  if (headerRowIdx === -1) {
    return {
      rows: [],
      customers: [],
      available: noColumns,
      warnings: [
        "Tidak menemukan baris header di file ini. Baris judul kolomnya harus " +
          'punya "Date", "Total Amount", dan salah satu dari "Invoice" / ' +
          '"Receivable No." / "No. SJ". Pastikan ini file export "Sales List" dari ECOUNT.',
      ],
    };
  }

  const colMap = buildColumnMap(matrix[headerRowIdx] as unknown[]);
  const available: AvailableColumns = {
    receivableNo: colMap.receivableNo !== undefined,
    sjNo: colMap.sjNo !== undefined,
    progressStatus: colMap.progressStatus !== undefined,
    existingKontrabonNo: colMap.existingKontrabonNo !== undefined,
    foreignAmount: colMap.foreignAmount !== undefined,
  };

  for (const f of ["date", "amount"]) {
    if (!(f in colMap)) {
      warnings.push(`Kolom untuk '${f}' tidak ditemukan di header.`);
    }
  }

  const rows: EcountRow[] = [];
  /** baris yang nomor fakturnya kosong sehingga memakai No. SJ */
  let sjFallbackCount = 0;

  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    const firstCell = String(row[0] ?? "").trim();

    if (row.every((c) => c === null || c === "")) continue; // baris kosong
    if (TIMESTAMP_ROW_RE.test(firstCell)) break; // baris timestamp footer -> selesai

    const receivableNo = textAt(row, colMap.receivableNo);
    const sjNo = textAt(row, colMap.sjNo);
    // Format baru: SJ yang belum jadi faktur punya "Receivable No." kosong,
    // tapi tetap boleh ditagih -- pakai nomor SJ-nya sebagai nomor dokumen.
    const invoiceNo = receivableNo || sjNo;
    if (!invoiceNo) continue; // tidak ada nomor dokumen -> bukan baris data
    const invoiceNoSource: EcountRow["invoiceNoSource"] = receivableNo
      ? "receivable"
      : "sj";
    if (invoiceNoSource === "sj" && available.receivableNo) sjFallbackCount++;

    const { str: dateStr, value: dateValue } = parseDateCell(row[colMap.date]);
    const amount = parseNumberCell(row[colMap.amount]);
    const foreignAmount =
      colMap.foreignAmount !== undefined
        ? (() => {
            const v = row[colMap.foreignAmount];
            return v === null || v === "" ? null : parseNumberCell(v);
          })()
        : null;

    const progressStatus = textAt(row, colMap.progressStatus);
    const existingKontrabonNo = textAt(row, colMap.existingKontrabonNo);
    const alreadyBilled =
      existingKontrabonNo !== "" ||
      BILLED_STATUSES.includes(normalizeHeader(progressStatus));

    rows.push({
      id: `${invoiceNo}-${r}`,
      number:
        colMap.number !== undefined ? textAt(row, colMap.number) : undefined,
      invoiceNo,
      invoiceNoSource,
      receivableNo,
      sjNo,
      dateStr,
      dateValue,
      amount,
      foreignAmount,
      poCustomer: textAt(row, colMap.poCustomer),
      flightNumber: textAt(row, colMap.flightNumber),
      customer: textAt(row, colMap.customer),
      progressStatus,
      existingKontrabonNo,
      alreadyBilled,
    });
  }

  const customers = Array.from(
    new Set(rows.map((r) => r.customer).filter(Boolean))
  ).sort();

  if (rows.length === 0) {
    warnings.push("Tidak ada baris data invoice yang terbaca dari file ini.");
  }

  const billedCount = rows.filter((r) => r.alreadyBilled).length;
  if (billedCount > 0) {
    warnings.push(
      `${billedCount} baris sudah punya No. Kontra Bon di file ini, jadi tidak dicentang otomatis.`
    );
  }
  if (sjFallbackCount > 0) {
    warnings.push(
      `${sjFallbackCount} baris belum punya Receivable No., jadi memakai No. SJ sebagai nomor dokumen.`
    );
  }

  return { rows, customers, warnings, available };
}
