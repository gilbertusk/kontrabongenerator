import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { buildKontrabonFile } from "./buildKontrabon";

describe("buildKontrabonFile", () => {
  it("menulis tabel invoice dengan teks berisi $ apa adanya", async () => {
    const { buffer, filename } = await buildKontrabonFile({
      kontrabonNo: "BAL-2611001",
      tanggal: new Date(2026, 10, 24),
      customer: "PT TES $& JAYA",
      rows: [
        {
          invoiceNo: "BAL-261101101",
          dateStr: "23/11/2026",
          dateValue: new Date(2026, 10, 23).getTime(),
          amount: 1000.5,
          poCustomer: "PO$&1",
          flightNumber: "HNM11/0661",
          customer: "PT TES $& JAYA",
        },
      ],
    });

    expect(filename).toBe("26.1124 BAL-2611001 PT TES $& JAYA.xlsx");

    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    expect(ws.C32.v).toBe("BAL-261101101");
    expect(ws.E32.v).toBe(1000.5);
    expect(ws.G32.v).toBe("PO$&1");
    expect(ws.I32.v).toBe("PT TES $& JAYA");
    expect(ws.E8.v).toBe(1000.5);
  });
});
