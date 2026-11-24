import { describe, expect, it } from "vitest";
import { freeQtyFromRemark } from "./freeQty";

describe("freeQtyFromRemark", () => {
  it.each([
    // contoh dari user
    ["300-1 F200 (28X500+1X21)", 200],
    ["300-15 F25 (1X300) L2F125 (2X500+1X420)", 25],
    ["400-1 L1F176 L2F176(1X500+1X324)", 176],
    // variasi yang ada di tarikan ECOUNT
    ["400-11 F108(1X322)", 108],
    ["400-4 D3 F32(2X500+1X71)", 32],
    ["400-10 D1,D2 L1F800 L2F675(101X500+1X236)", 800],
    ["300-11 L1F100 (2X500+1X259)", 100],
    ["F185(2X600 PCS)", 185],
    ["200-6 F150 ()8X500+1X480", 150],
    ["F500 D1 F500(23X500+1X296", 500],
    ["400-11 F90(1X130) L2F202", 90],
    ["200-13 F100 (1C500+1C235)", 100],
    ["  300-1 f40 (1X50)  ", 40],
  ])("%s -> %i", (remark, expected) => {
    expect(freeQtyFromRemark(remark)).toBe(expected);
  });

  it.each([
    "200-5 (25X250)",
    "300-15 (129X250+1X160)",
    "D001 [100 pcs X 2 ikat = 200 pcs]+ 60 pcs]",
    "1X(20X600 PCS)",
    "300-8 (1ROLL)",
    "",
  ])("tidak ada free untuk %j", (remark) => {
    expect(freeQtyFromRemark(remark)).toBeNull();
  });

  it("free layer 2 saja tidak dihitung", () => {
    expect(freeQtyFromRemark("300-2 L2F269 (45X500+1X456)")).toBeNull();
  });

  it("FR20 bukan penanda free (sama seperti rumus Excel lama)", () => {
    expect(freeQtyFromRemark("200-6 FR20 (1X500+1X210)")).toBeNull();
  });

  it("huruf F di tengah kata bukan penanda free", () => {
    expect(freeQtyFromRemark("300-1 OFF5 (1X50)")).toBeNull();
  });

  it("F0 dianggap tidak ada free", () => {
    expect(freeQtyFromRemark("300-1 F0 (1X50)")).toBeNull();
  });

  it("angka ribuan bertitik koma dibaca utuh", () => {
    expect(freeQtyFromRemark("300-1 F1,200 (3X500)")).toBe(1200);
  });

  it("menerima nilai bukan string tanpa error", () => {
    expect(freeQtyFromRemark(null)).toBeNull();
    expect(freeQtyFromRemark(undefined)).toBeNull();
  });
});
