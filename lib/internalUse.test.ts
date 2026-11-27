import { describe, expect, it } from "vitest";
import {
  REJECT_CATEGORIES,
  ROWS_PER_SLIP,
  ecountDate,
  fileNameDate,
  findPic,
  findRejectCategory,
  freeQtyLines,
  rejectLines,
  slipSeqNo,
  toInternalUseRows,
} from "./internalUse";

describe("ecountDate", () => {
  it("mengubah YYYY-MM-DD jadi DDMMYYYY", () => {
    expect(ecountDate("2026-11-24")).toBe("24112026");
    expect(ecountDate("2026-01-05")).toBe("05012026");
  });

  it("menolak tanggal yang tidak ada", () => {
    expect(() => ecountDate("2026-02-30")).toThrow();
    expect(() => ecountDate("24/11/2026")).toThrow();
  });
});

describe("fileNameDate", () => {
  it("memakai format DD-MM-YYYY", () => {
    expect(fileNameDate("2026-11-24")).toBe("24-11-2026");
  });
});

describe("slipSeqNo", () => {
  it("baris 1-1000 -> 1, 1001-2000 -> 2, dst.", () => {
    expect(ROWS_PER_SLIP).toBe(1000);
    expect(slipSeqNo(0)).toBe(1);
    expect(slipSeqNo(999)).toBe(1);
    expect(slipSeqNo(1000)).toBe(2);
    expect(slipSeqNo(1999)).toBe(2);
    expect(slipSeqNo(2000)).toBe(3);
  });
});

describe("findPic", () => {
  it("mengenali kode PIC yang terdaftar", () => {
    expect(findPic("58")?.name).toBe("Fajri");
    expect(findPic("157")?.name).toBe("Adi Kusuma");
    expect(findPic("151")?.name).toBe("Irfan");
    expect(findPic("999")).toBeUndefined();
  });
});

describe("REJECT_CATEGORIES", () => {
  it("Reject 1-4 memakai Usage Type 00035-00038", () => {
    expect(REJECT_CATEGORIES.map((c) => [c.label, c.usageType])).toEqual([
      ["Reject 1", "00035"],
      ["Reject 2", "00036"],
      ["Reject 3", "00037"],
      ["Reject 4", "00038"],
    ]);
    expect(findRejectCategory(3)?.usageType).toBe("00037");
    expect(findRejectCategory(5)).toBeUndefined();
    expect(findRejectCategory("1")).toBeUndefined();
  });
});

describe("freeQtyLines", () => {
  it("Usage Type 00026 dan Remark = Flight Number", () => {
    expect(
      freeQtyLines([
        { itemCode: "FG1", qty: 200, flightNo: "HNM11/0661" },
        { itemCode: "FG2", qty: 25, flightNo: "" },
      ])
    ).toEqual([
      { itemCode: "FG1", qty: 200, usageType: "00026", remark: "HNM11/0661" },
      { itemCode: "FG2", qty: 25, usageType: "00026", remark: "" },
    ]);
  });
});

describe("rejectLines", () => {
  it("Usage Type sesuai kategori dan Remark = Flight Number", () => {
    expect(
      rejectLines([
        { itemCode: "FG1", qty: 100, category: 1, flightNo: "HNM11/0745" },
        { itemCode: "FG1", qty: 50, category: 3, flightNo: "HNM11/0745" },
      ])
    ).toEqual([
      { itemCode: "FG1", qty: 100, usageType: "00035", remark: "HNM11/0745" },
      { itemCode: "FG1", qty: 50, usageType: "00037", remark: "HNM11/0745" },
    ]);
  });
});

describe("toInternalUseRows", () => {
  const lines = freeQtyLines([
    { itemCode: "FG002784", qty: 200, flightNo: "HNM11/0661" },
    { itemCode: "FG009165", qty: 10, flightNo: "HNM11/0661" },
  ]);

  it("mengisi kolom wajib dengan nilai tetap + PIC + tanggal pilihan", () => {
    const rows = toInternalUseRows(lines, { date: "2026-11-24", picCode: "157" });
    expect(rows).toEqual([
      {
        date: "24112026",
        seqNo: 1,
        locationOut: "00009",
        pic: "157",
        grossWeight: 0,
        koli: 0,
        poCustomer: "-",
        itemCode: "FG002784",
        qty: 200,
        usageType: "00026",
        remark: "HNM11/0661",
      },
      expect.objectContaining({ itemCode: "FG009165", qty: 10, seqNo: 1 }),
    ]);
  });

  it("Usage Type & Remark diambil dari baris (menu Reject)", () => {
    const [row] = toInternalUseRows(
      rejectLines([{ itemCode: "FG1", qty: 5, category: 2, flightNo: "MDS11/0479" }]),
      { date: "2026-11-24", picCode: "58" }
    );
    expect(row).toMatchObject({ usageType: "00036", remark: "MDS11/0479", locationOut: "00009" });
  });

  it("Seq. No. naik setiap 1000 baris", () => {
    const many = Array.from({ length: 2001 }, (_, i) => ({
      itemCode: `FG${i}`,
      qty: 1,
      usageType: "00026",
      remark: "",
    }));
    const rows = toInternalUseRows(many, { date: "2026-11-24", picCode: "58" });
    expect(rows[999].seqNo).toBe(1);
    expect(rows[1000].seqNo).toBe(2);
    expect(rows[2000].seqNo).toBe(3);
  });

  it("tidak mengubah array input", () => {
    const input = Object.freeze([...lines]);
    toInternalUseRows(input, { date: "2026-11-24", picCode: "58" });
    expect(input).toEqual(lines);
  });

  it("menolak PIC yang tidak terdaftar", () => {
    expect(() =>
      toInternalUseRows(lines, { date: "2026-11-24", picCode: "1" })
    ).toThrow(/PIC/);
  });
});
