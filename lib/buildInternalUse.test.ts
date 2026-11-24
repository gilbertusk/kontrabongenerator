import JSZip from "jszip";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { buildInternalUseFile } from "./buildInternalUse";

function readBack(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return {
    sheetName: wb.SheetNames[0],
    ws,
    matrix: XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }),
  };
}

describe("buildInternalUseFile", () => {
  it("mengisi template ECOUNT mulai baris 2 dengan kolom yang benar", async () => {
    const { buffer, filename } = await buildInternalUseFile({
      tanggal: "2026-11-24",
      picCode: "58",
      rows: [
        { itemCode: "FG002784", qty: 200 },
        { itemCode: "FG009165", qty: 10 },
      ],
    });

    expect(filename).toBe("Internal Use Free Qty 24-11-2026.xlsx");

    const { sheetName, ws, matrix } = readBack(buffer);
    expect(sheetName).toBe("1_New Int. Use");
    expect(matrix[0][0]).toBe("Date");
    expect(matrix[0][23]).toBe("Remark");
    expect(matrix).toHaveLength(3);

    const cell = (ref: string) => ws[ref]?.v;
    expect(cell("A2")).toBe("24112026");
    expect(cell("B2")).toBe("1");
    expect(cell("C2")).toBeUndefined();
    expect(cell("F2")).toBe("00009");
    expect(cell("G2")).toBe("58");
    expect(cell("M2")).toBe(0);
    expect(cell("N2")).toBe(0);
    expect(cell("O2")).toBe("-");
    expect(cell("R2")).toBe("FG002784");
    expect(cell("S2")).toBeUndefined();
    expect(cell("U2")).toBe(200);
    expect(cell("W2")).toBe("00026");
    expect(cell("X2")).toBe("QTY FREE 24 - 11 - 2026");

    expect(cell("R3")).toBe("FG009165");
    expect(cell("U3")).toBe(10);
    // kode berawalan 0 harus tetap teks, bukan angka
    expect(ws.F2.t).toBe("s");
    expect(ws.U2.t).toBe("n");
  });

  it("Seq. No. pindah ke 2 mulai baris data ke-1001", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({
      itemCode: `FG${i}`,
      qty: 1,
    }));
    const { buffer } = await buildInternalUseFile({
      tanggal: "2026-11-24",
      picCode: "151",
      rows,
    });
    const { ws } = readBack(buffer);
    expect(ws.B1001.v).toBe("1");
    expect(ws.B1002.v).toBe("2");
    expect(ws["!ref"]).toBe("A1:X1002");
  });

  it("komentar petunjuk kolom dari ECOUNT tetap ada", async () => {
    const { buffer } = await buildInternalUseFile({
      tanggal: "2026-11-24",
      picCode: "58",
      rows: [{ itemCode: "FG1", qty: 5 }],
    });
    const zip = await JSZip.loadAsync(buffer);
    expect(zip.file("xl/comments1.xml")).not.toBeNull();
  });

  it("Item Code berisi karakter $ tetap utuh", async () => {
    const { buffer } = await buildInternalUseFile({
      tanggal: "2026-11-24",
      picCode: "58",
      rows: [{ itemCode: "AB$&C", qty: 5 }],
    });
    const { ws } = readBack(buffer);
    expect(ws.R2.v).toBe("AB$&C");
  });

  it("menolak PIC yang tidak terdaftar", async () => {
    await expect(
      buildInternalUseFile({
        tanggal: "2026-11-24",
        picCode: "1",
        rows: [{ itemCode: "FG1", qty: 5 }],
      })
    ).rejects.toThrow(/PIC/);
  });
});
