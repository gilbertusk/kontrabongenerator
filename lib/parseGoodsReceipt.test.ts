import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseGoodsReceiptWorkbook, rejectBreakdown } from "./parseGoodsReceipt";

describe("rejectBreakdown", () => {
  it("memakai kolom Reject 1-4 yang terisi", () => {
    expect(rejectBreakdown(150, [100, 0, 50, 0])).toEqual({
      parts: [
        { category: 1, qty: 100 },
        { category: 3, qty: 50 },
      ],
      assumedReject1: 0,
      excessDetail: 0,
    });
  });

  it("Qty. Reject tanpa rincian masuk Reject 1", () => {
    expect(rejectBreakdown(1440, [0, 0, 0, 0])).toEqual({
      parts: [{ category: 1, qty: 1440 }],
      assumedReject1: 1440,
      excessDetail: 0,
    });
  });

  it("sisa Qty. Reject yang belum dirinci ditambahkan ke Reject 1", () => {
    expect(rejectBreakdown(150, [0, 100, 0, 0])).toEqual({
      parts: [
        { category: 1, qty: 50 },
        { category: 2, qty: 100 },
      ],
      assumedReject1: 50,
      excessDetail: 0,
    });
  });

  it("tidak ada reject -> kosong", () => {
    expect(rejectBreakdown(0, [0, 0, 0, 0])).toEqual({
      parts: [],
      assumedReject1: 0,
      excessDetail: 0,
    });
  });

  it("rincian lebih besar dari Qty. Reject: dipakai apa adanya tapi ditandai", () => {
    expect(rejectBreakdown(100, [80, 0, 50, 0])).toEqual({
      parts: [
        { category: 1, qty: 80 },
        { category: 3, qty: 50 },
      ],
      assumedReject1: 0,
      excessDetail: 30,
    });
  });

  it("Qty. Reject kosong tapi rincian terisi: tidak dianggap kelebihan", () => {
    expect(rejectBreakdown(0, [40, 0, 0, 0]).excessDetail).toBe(0);
  });
});

const HEADER = [
  "Creation Date",
  "Initial Creator",
  "PIC Name",
  "Date",
  "Flight Number",
  "Item Group I Name",
  "Item Code",
  "Item Name [Spec Name]",
  "Qty",
  "Qty Layer 2",
  "Qty Layer 3",
  "Qty. Reject",
  "Reject 1 (Material/Setting/Sambungan)",
  "Reject 2 (Slitting/Sonic)",
  "Reject 3 (Printing)",
  "Reject 4 (Cut&Fold)",
];

function dataRow(
  flight: string,
  item: string,
  qtyReject: number | null,
  rejects: (number | null)[]
) {
  return [
    "21/11/2026  9:11:01",
    "Siti Rohmah",
    "Rohmah",
    "21 Nov 2026",
    flight,
    "Printed Fabric Label",
    item,
    `${item} [SCREEN PRINT >> QC >> PACK]`,
    1000,
    null,
    null,
    qtyReject,
    ...rejects,
  ];
}

function workbookBuffer(rows: unknown[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Goods Receipt Status");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

const SAMPLE = workbookBuffer([
  ["Company Name : PT Berlian Artha Label / 21/11/2026  ~ 23/11/2026  / Goods Receipt Status"],
  HEADER,
  dataRow("HNM11/0580", "FG00024737", 50, [50, null, null, null]),
  dataRow("MDS11/0479", "FG021585", null, [null, null, null, null]),
  dataRow("HNM11/0745", "FG00022589", 150, [100, null, 50, null]),
  dataRow("HNM11/0392-1", "FG00034819", 1440, [null, null, null, null]),
  ["11/2026  Sub Total", null, null, null, null, null, null, null, 4000, 0, 0, 1640],
  ["Total", null, null, null, null, null, null, null, 4000, 0, 0, 1640],
  ["24/11/2026  13:29:30"],
]);

describe("parseGoodsReceiptWorkbook", () => {
  const result = parseGoodsReceiptWorkbook(SAMPLE);

  it("membaca semua baris item dan melewati baris total/timestamp", () => {
    expect(result.rows.map((r) => r.itemCode)).toEqual([
      "FG00024737",
      "FG021585",
      "FG00022589",
      "FG00034819",
    ]);
  });

  it("memetakan kolom laporan ke field baris", () => {
    expect(result.rows[0]).toMatchObject({
      dateStr: "21 Nov 2026",
      picName: "Rohmah",
      flightNo: "HNM11/0580",
      itemGroup: "Printed Fabric Label",
      itemName: "FG00024737 [SCREEN PRINT >> QC >> PACK]",
      qty: 1000,
      qtyReject: 50,
      parts: [{ category: 1, qty: 50 }],
      assumedReject1: 0,
    });
  });

  it("memecah reject per kategori dan menandai yang dianggap Reject 1", () => {
    expect(result.rows.map((r) => r.parts)).toEqual([
      [{ category: 1, qty: 50 }],
      [],
      [
        { category: 1, qty: 100 },
        { category: 3, qty: 50 },
      ],
      [{ category: 1, qty: 1440 }],
    ]);
    expect(result.rows[3].assumedReject1).toBe(1440);
  });

  it("id tiap baris unik", () => {
    expect(new Set(result.rows.map((r) => r.id)).size).toBe(result.rows.length);
  });

  it("memberi tahu baris tanpa rincian kategori", () => {
    expect(result.warnings.join(" ")).toMatch(/1 baris.*Reject 1/);
  });

  it("memberi tahu baris yang rinciannya melebihi Qty. Reject", () => {
    const over = parseGoodsReceiptWorkbook(
      workbookBuffer([HEADER, dataRow("X", "FG1", 100, [80, null, 50, null])])
    );
    expect(over.rows[0].excessDetail).toBe(30);
    expect(over.warnings.join(" ")).toMatch(/1 baris.*melebihi Qty\. Reject/);
  });

  it("memberi peringatan kalau header tidak ditemukan", () => {
    const bad = parseGoodsReceiptWorkbook(
      workbookBuffer([["Date", "No. SJ", "Item Code", "Qty."], ["1/1/2026", "X", "FG1", 5]])
    );
    expect(bad.rows).toEqual([]);
    expect(bad.warnings[0]).toMatch(/Goods Receipt Status/);
  });

  it("file tanpa reject sama sekali memberi peringatan", () => {
    const none = parseGoodsReceiptWorkbook(
      workbookBuffer([HEADER, dataRow("X", "FG1", null, [null, null, null, null])])
    );
    expect(none.rows).toHaveLength(1);
    expect(none.warnings.join(" ")).toMatch(/Tidak ada reject/);
  });
});
