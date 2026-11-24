import { describe, expect, it } from "vitest";
import {
  ROWS_PER_SLIP,
  ecountDate,
  fileNameDate,
  findPic,
  freeQtyRemark,
  slipSeqNo,
  toInternalUseRows,
  validateInternalUseRequest,
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

describe("freeQtyRemark", () => {
  it("mengikuti format QTY FREE DD - MM - YYYY", () => {
    expect(freeQtyRemark("2026-11-12")).toBe("QTY FREE 12 - 11 - 2026");
    expect(freeQtyRemark("2026-03-07")).toBe("QTY FREE 07 - 03 - 2026");
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

describe("toInternalUseRows", () => {
  const lines = [
    { itemCode: "FG002784", qty: 200 },
    { itemCode: "FG009165", qty: 10 },
  ];

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
        remark: "QTY FREE 24 - 11 - 2026",
      },
      expect.objectContaining({ itemCode: "FG009165", qty: 10, seqNo: 1 }),
    ]);
  });

  it("Seq. No. naik setiap 1000 baris", () => {
    const many = Array.from({ length: 2001 }, (_, i) => ({
      itemCode: `FG${i}`,
      qty: 1,
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

describe("validateInternalUseRequest", () => {
  const valid = {
    tanggal: "2026-11-24",
    picCode: "58",
    rows: [{ itemCode: "FG002784", qty: 200 }],
  };

  it("menerima body yang benar dan merapikan kode item", () => {
    const result = validateInternalUseRequest({
      ...valid,
      rows: [{ itemCode: "  FG002784 ", qty: 200 }],
    });
    expect(result).toEqual({
      ok: true,
      value: { ...valid, rows: [{ itemCode: "FG002784", qty: 200 }] },
    });
  });

  it.each([
    [null, /tidak valid/],
    [{ ...valid, tanggal: "2026-13-01" }, /Tanggal/],
    [{ ...valid, picCode: "" }, /PIC/],
    [{ ...valid, picCode: "12345" }, /PIC/],
    [{ ...valid, rows: [] }, /minimal 1/],
    [{ ...valid, rows: "x" }, /minimal 1/],
    [{ ...valid, rows: [{ itemCode: "", qty: 1 }] }, /Item Code/],
    [{ ...valid, rows: [{ itemCode: "X".repeat(21), qty: 1 }] }, /Item Code/],
    [{ ...valid, rows: [{ itemCode: "FG1", qty: 0 }] }, /Qty/],
    [{ ...valid, rows: [{ itemCode: "FG1", qty: -5 }] }, /Qty/],
    [{ ...valid, rows: [{ itemCode: "FG1", qty: "10" }] }, /Qty/],
    [{ ...valid, rows: [{ itemCode: "FG1", qty: Infinity }] }, /Qty/],
  ])("menolak body %#", (body, message) => {
    const result = validateInternalUseRequest(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });

  it("menolak jumlah baris yang tidak wajar", () => {
    const rows = Array.from({ length: 20001 }, () => ({ itemCode: "FG1", qty: 1 }));
    const result = validateInternalUseRequest({ ...valid, rows });
    expect(result.ok).toBe(false);
  });
});
