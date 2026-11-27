import { describe, expect, it } from "vitest";
import { validateInternalUseRequest } from "./internalUseRequest";

const free = {
  tanggal: "2026-11-24",
  picCode: "58",
  rows: [{ itemCode: "FG002784", qty: 200, flightNo: "HNM11/0661" }],
};

const reject = {
  kind: "reject",
  tanggal: "2026-11-24",
  picCode: "151",
  rows: [
    { itemCode: "FG00022589", qty: 100, category: 1, flightNo: "HNM11/0745" },
    { itemCode: "FG00022589", qty: 50, category: 3, flightNo: " HNM11/0745 " },
  ],
};

describe("validateInternalUseRequest - free qty", () => {
  it("body tanpa kind dianggap free qty; Remark = Flight Number (dirapikan)", () => {
    const result = validateInternalUseRequest({
      ...free,
      rows: [{ itemCode: "  FG002784 ", qty: 200, flightNo: " HNM11/0661 " }],
    });
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "free",
        tanggal: "2026-11-24",
        picCode: "58",
        lines: [{ itemCode: "FG002784", qty: 200, usageType: "00026", remark: "HNM11/0661" }],
      },
    });
  });

  it("Flight Number kosong tetap boleh (Remark kosong)", () => {
    const result = validateInternalUseRequest({
      ...free,
      rows: [{ itemCode: "FG1", qty: 5 }],
    });
    expect(result.ok && result.value.lines[0]).toEqual({
      itemCode: "FG1",
      qty: 5,
      usageType: "00026",
      remark: "",
    });
  });

  it.each([
    [null, /tidak valid/],
    [{ ...free, kind: "lain" }, /Jenis/],
    [{ ...free, tanggal: "2026-13-01" }, /Tanggal/],
    [{ ...free, picCode: "" }, /PIC/],
    [{ ...free, picCode: "12345" }, /PIC/],
    [{ ...free, rows: [] }, /minimal 1/],
    [{ ...free, rows: "x" }, /minimal 1/],
    [{ ...free, rows: [{ itemCode: "", qty: 1 }] }, /Item Code/],
    [{ ...free, rows: [{ itemCode: "X".repeat(21), qty: 1 }] }, /Item Code/],
    [{ ...free, rows: [{ itemCode: "FG1", qty: 0 }] }, /Qty/],
    [{ ...free, rows: [{ itemCode: "FG1", qty: -5 }] }, /Qty/],
    [{ ...free, rows: [{ itemCode: "FG1", qty: "10" }] }, /Qty/],
    [{ ...free, rows: [{ itemCode: "FG1", qty: Infinity }] }, /Qty/],
    [{ ...free, rows: [{ itemCode: "FG1", qty: 1, flightNo: "X".repeat(201) }] }, /Flight Number/],
  ])("menolak body %#", (body, message) => {
    const result = validateInternalUseRequest(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });

  it("menolak jumlah baris yang tidak wajar", () => {
    const rows = Array.from({ length: 20001 }, () => ({ itemCode: "FG1", qty: 1 }));
    expect(validateInternalUseRequest({ ...free, rows }).ok).toBe(false);
  });
});

describe("validateInternalUseRequest - reject", () => {
  it("Usage Type dari kategori, Remark = Flight Number (dirapikan)", () => {
    const result = validateInternalUseRequest(reject);
    expect(result).toEqual({
      ok: true,
      value: {
        kind: "reject",
        tanggal: "2026-11-24",
        picCode: "151",
        lines: [
          { itemCode: "FG00022589", qty: 100, usageType: "00035", remark: "HNM11/0745" },
          { itemCode: "FG00022589", qty: 50, usageType: "00037", remark: "HNM11/0745" },
        ],
      },
    });
  });

  it("Flight Number kosong tetap boleh (Remark kosong)", () => {
    const result = validateInternalUseRequest({
      ...reject,
      rows: [{ itemCode: "FG1", qty: 5, category: 4 }],
    });
    expect(result.ok && result.value.lines[0]).toEqual({
      itemCode: "FG1",
      qty: 5,
      usageType: "00038",
      remark: "",
    });
  });

  it.each([
    [{ itemCode: "FG1", qty: 5, category: 0, flightNo: "X" }, /kategori/],
    [{ itemCode: "FG1", qty: 5, category: "1", flightNo: "X" }, /kategori/],
    [{ itemCode: "FG1", qty: 5, flightNo: "X" }, /kategori/],
    [{ itemCode: "FG1", qty: 5, category: 1, flightNo: "X".repeat(201) }, /Flight Number/],
    [{ itemCode: "FG1", qty: 0, category: 1, flightNo: "X" }, /Qty/],
  ])("menolak baris reject %#", (row, message) => {
    const result = validateInternalUseRequest({ ...reject, rows: [row] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });

  it("Usage Type kiriman browser diabaikan; tetap dari kategori", () => {
    const result = validateInternalUseRequest({
      ...reject,
      rows: [{ itemCode: "FG1", qty: 5, category: 2, flightNo: "X", usageType: "99999" }],
    });
    expect(result.ok && result.value.lines[0].usageType).toBe("00036");
  });
});
