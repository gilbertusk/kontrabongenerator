import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseSalesStatusWorkbook } from "./parseSalesStatus";

const HEADER = [
  "Date",
  "No. SJ",
  "No. PO Customer",
  "Progress Status",
  "Customer Code",
  "Customer",
  "Address 2",
  "FLIGHT NO.",
  "Pengiriman",
  "Item Code",
  "Item Name (Spec)",
  "Qty.",
  "Remarks/Ikatan",
  "Price",
  "Pretax Amount",
];

function dataRow(sj: string, item: string, qty: number, remark: string) {
  return [
    "23/11/2026 ",
    sj,
    "HNM-540",
    "CORETAX",
    "010251",
    "PT KREASI GARMENT CIREBON",
    "CIREBON",
    "HNM11/0661",
    "BESTINDO 1121",
    item,
    `${item} WHITE [HOTCUT >> QC >> PACK]`,
    qty,
    remark,
    68.53,
    1000,
  ];
}

/** Bentuk file export ECOUNT "Sales Status Details" (judul, header, data, total). */
function workbookBuffer(rows: unknown[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sales Status Details");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

const SAMPLE = workbookBuffer([
  ["Company Name : PT Berlian Artha Label / 22/11/2026  ~ 23/11/2026 "],
  HEADER,
  dataRow("BAL-261101101", "FG002784", 14021, "300-1 F200 (28X500+1X21)"),
  dataRow("BAL-261101101", "FG009165", 250, "300-15 F25 (1X300) L2F125 (2X500+1X420)"),
  dataRow("BAL-261101104", "FG00035151", 12057, "400-1 L1F176 L2F176(1X500+1X324)"),
  dataRow("BAL-261101104", "FG00035152", 50, "200-5 (25X250)"),
  ["11/2026  Total", "", "", "", "", "", "", "", "", "", "", 26378, "", 0, 0],
  ["Grand Total", "", "", "", "", "", "", "", "", "", "", 26378, "", 0, 0],
  ["24/11/2026 (Tue) 11:22:42"],
]);

describe("parseSalesStatusWorkbook", () => {
  const result = parseSalesStatusWorkbook(SAMPLE);

  it("membaca semua baris item dan melewati baris total/timestamp", () => {
    expect(result.rows.map((r) => r.itemCode)).toEqual([
      "FG002784",
      "FG009165",
      "FG00035151",
      "FG00035152",
    ]);
  });

  it("memetakan kolom ECOUNT ke field baris", () => {
    expect(result.rows[0]).toMatchObject({
      dateStr: "23/11/2026",
      sjNo: "BAL-261101101",
      poCustomer: "HNM-540",
      progressStatus: "CORETAX",
      customerCode: "010251",
      customer: "PT KREASI GARMENT CIREBON",
      flightNo: "HNM11/0661",
      pengiriman: "BESTINDO 1121",
      itemName: "FG002784 WHITE [HOTCUT >> QC >> PACK]",
      qty: 14021,
      remark: "300-1 F200 (28X500+1X21)",
    });
  });

  it("menghitung free qty dari Remarks/Ikatan", () => {
    expect(result.rows.map((r) => r.freeQty)).toEqual([200, 25, 176, null]);
  });

  it("id tiap baris unik", () => {
    const ids = new Set(result.rows.map((r) => r.id));
    expect(ids.size).toBe(result.rows.length);
  });

  it("memberi tahu jumlah baris tanpa free", () => {
    expect(result.warnings.join(" ")).toMatch(/1 baris/);
  });

  it("memberi peringatan kalau header tidak ditemukan", () => {
    const bad = parseSalesStatusWorkbook(
      workbookBuffer([["Number", "Invoice", "Date", "Total Amount"], [1, "X", "1/1/2026", 5]])
    );
    expect(bad.rows).toEqual([]);
    expect(bad.warnings[0]).toMatch(/Remarks\/Ikatan/);
  });

  it("file tanpa baris data menghasilkan daftar kosong + peringatan", () => {
    const empty = parseSalesStatusWorkbook(workbookBuffer([HEADER]));
    expect(empty.rows).toEqual([]);
    expect(empty.warnings.join(" ")).toMatch(/Tidak ada/);
  });
});
