import { describe, expect, it } from "vitest";
import {
  SharedStringTable,
  escapeXml,
  readSharedStrings,
  sharedStringCell,
} from "./sheetXml";

const TEMPLATE_SST =
  '<?xml version="1.0"?><sst xmlns="x" count="2" uniqueCount="2">' +
  "<si><t>Remark</t></si><si><r><t>Item</t></r><r><t xml:space=\"preserve\"> Code</t></r></si>" +
  "</sst>";

describe("escapeXml", () => {
  it("meng-escape karakter khusus XML", () => {
    expect(escapeXml(`A&B <"x">`)).toBe("A&amp;B &lt;&quot;x&quot;&gt;");
  });
});

describe("readSharedStrings", () => {
  it("membaca teks biasa dan rich text", () => {
    expect(readSharedStrings(TEMPLATE_SST)).toEqual(["Remark", "Item Code"]);
  });
});

describe("SharedStringTable", () => {
  it("memakai ulang teks yang sudah ada dan menambah teks baru di belakang", () => {
    const table = new SharedStringTable(readSharedStrings(TEMPLATE_SST));
    expect(table.ref("Remark")).toBe(0);
    expect(table.ref("00009")).toBe(2);
    expect(table.ref("00009")).toBe(2);
    expect(table.ref("A&B")).toBe(3);

    const xml = table.apply(TEMPLATE_SST);
    expect(xml).toContain('count="6" uniqueCount="4"');
    expect(readSharedStrings(xml)).toEqual(["Remark", "Item Code", "00009", "A&B"]);
  });

  it("teks berisi pola $ (mis. $& $` $$) ditulis apa adanya", () => {
    const table = new SharedStringTable(readSharedStrings(TEMPLATE_SST));
    const tricky = ["AB$&C", "X$`Y", "P$$Q", "Z$'W"];
    tricky.forEach((t) => table.ref(t));
    expect(readSharedStrings(table.apply(TEMPLATE_SST))).toEqual([
      "Remark",
      "Item Code",
      ...tricky,
    ]);
  });

  it("error kalau XML bukan sharedStrings", () => {
    expect(() => new SharedStringTable([]).apply("<x/>")).toThrow(/sharedStrings/);
  });
});

describe("sharedStringCell", () => {
  it("membuat sel bertipe s", () => {
    expect(sharedStringCell("A2", 2, 5)).toBe('<c r="A2" s="2" t="s"><v>5</v></c>');
  });
});
