"use client";

import { useState } from "react";
import { parseGoodsReceiptWorkbook, GoodsReceiptParseResult } from "@/lib/parseGoodsReceipt";
import { REJECT_CATEGORIES, slipSeqNo } from "@/lib/internalUse";
import Intro from "../Intro";
import AppTopbar from "../AppTopbar";
import FileDrop from "../FileDrop";
import InternalUseFields from "../_internal-use/InternalUseFields";
import FixedValues from "../_internal-use/FixedValues";
import SummaryCallout from "../_internal-use/SummaryCallout";
import GenerateBar from "../_internal-use/GenerateBar";
import { formatQty } from "../_internal-use/format";
import { useInternalUseForm } from "../_internal-use/useInternalUseForm";
import { useSelection } from "../_internal-use/useSelection";
import { useGenerateFile } from "../_internal-use/useGenerateFile";
import RejectTable, { RejectItem, toRejectItems } from "./RejectTable";

/** "Reject 1 11.902 · Reject 3 1.101" (kategori yang qty-nya 0 dilewati). */
function categoryTotals(items: readonly RejectItem[]): string {
  return REJECT_CATEGORIES.map((c) => ({
    label: c.label,
    qty: items.filter((i) => i.category === c.no).reduce((s, i) => s + i.qty, 0),
  }))
    .filter((t) => t.qty > 0)
    .map((t) => `${t.label} ${formatQty(t.qty)}`)
    .join(" · ");
}

/** "Usage Type Reject 1 = 00035", dst. + Remark, untuk daftar Nilai Tetap. */
const FIXED_VALUES = [
  ...REJECT_CATEGORIES.map((c) => ({ label: `Usage Type ${c.label}`, value: c.usageType })),
  { label: "Remark", value: "Flight Number" },
];

export default function RejectPage() {
  const [fileName, setFileName] = useState("");
  const [parseResult, setParseResult] = useState<GoodsReceiptParseResult | null>(null);
  const [parseError, setParseError] = useState("");
  const { selectedIds, toggle, selectOnly } = useSelection();
  const form = useInternalUseForm();
  const file = useGenerateFile();

  const rows = parseResult?.rows ?? [];
  const items = toRejectItems(rows);
  const noRejectCount = rows.filter((r) => r.parts.length === 0).length;
  const assumedCount = rows.filter((r) => r.assumedReject1 > 0).length;
  const excessCount = rows.filter((r) => r.excessDetail > 0).length;

  /** Baris yang ikut ke file, dalam urutan file ECOUNT. */
  const selectedItems = items.filter((i) => selectedIds.has(i.id));
  const exportIndex = new Map(selectedItems.map((item, i) => [item.id, i] as const));
  const totalQty = selectedItems.reduce((sum, i) => sum + i.qty, 0);
  const slipCount = selectedItems.length ? slipSeqNo(selectedItems.length - 1) : 0;
  const isAllSelected = items.length > 0 && selectedItems.length === items.length;

  const blocker =
    rows.length === 0
      ? "Belum ada file Goods Receipt Status yang dibaca."
      : items.length === 0
      ? "Tidak ada reject di file ini."
      : selectedItems.length === 0
      ? "Belum ada baris reject yang dicentang."
      : form.formBlocker;

  function selectItems(next: readonly RejectItem[]) {
    selectOnly(next.map((i) => i.id));
  }

  async function handleFile(upload: File) {
    file.clearMessages();
    setParseError("");
    setFileName(upload.name);
    try {
      const result = parseGoodsReceiptWorkbook(await upload.arrayBuffer());
      setParseResult(result);
      selectItems(toRejectItems(result.rows));
      if (result.rows.length === 0) {
        setParseError(result.warnings[0] || "Tidak ada baris item yang terbaca.");
      }
    } catch (e) {
      console.error(e);
      setParseResult(null);
      selectItems([]);
      setParseError(
        'Gagal membaca file. Pastikan ini file .xlsx export "Goods Receipt Status" dari ECOUNT.'
      );
    }
  }

  function handleGenerate() {
    if (blocker) {
      file.setErrorMsg(blocker);
      return;
    }
    file.generate(
      "/api/internal-use",
      {
        kind: "reject",
        tanggal: form.tanggal,
        picCode: form.picCode,
        rows: selectedItems.map((i) => ({
          itemCode: i.row.itemCode,
          qty: i.qty,
          category: i.category,
          flightNo: i.row.flightNo,
        })),
      },
      "Internal Use Reject.xlsx"
    );
  }

  const sidebarMessage = parseError || parseResult?.warnings.join(" ") || "";
  const readyText = `${selectedItems.length} baris · ${slipCount} slip · ${categoryTotals(selectedItems)}`;

  return (
    <>
      <Intro />
      <div className="app">
        <AppTopbar active="reject" />

        <div className="workspace">
          <aside className="sidebar">
            <section>
              <FileDrop title="Goods Receipt Status" fileName={fileName} onFile={handleFile} />
              {sidebarMessage && <p className="helper">{sidebarMessage}</p>}
            </section>

            <InternalUseFields
              tanggal={form.tanggal}
              picCode={form.picCode}
              onTanggalChange={form.setTanggal}
              onPicChange={form.setPicCode}
            />

            <FixedValues extra={FIXED_VALUES} />

            <SummaryCallout blocker={blocker} readyText={readyText} />
          </aside>

          <main className="content">
            {(noRejectCount > 0 || assumedCount > 0 || excessCount > 0) && (
              <p className="notice">
                {noRejectCount > 0 && (
                  <>
                    <b>{noRejectCount} baris</b> tanpa reject tidak ditampilkan.{" "}
                  </>
                )}
                {assumedCount > 0 && (
                  <>
                    <b>{assumedCount} baris</b> punya Qty. Reject tanpa rincian Reject 1-4,
                    jadi dimasukkan ke Reject 1 (ditandai TANPA RINCIAN).{" "}
                  </>
                )}
                {excessCount > 0 && (
                  <>
                    <b>{excessCount} baris</b> punya rincian Reject 1-4 yang melebihi Qty.
                    Reject (ditandai MELEBIHI QTY. REJECT); cek dulu sebelum upload.
                  </>
                )}
              </p>
            )}

            <div className="content-head">
              <h1>
                Reject
                <span className="tag mono">[ECOUNT : INTERNAL USE]</span>
              </h1>
              <div className="head-actions">
                <button
                  className="linkbtn strong"
                  onClick={() => selectItems(items)}
                  disabled={items.length === 0 || isAllSelected}
                >
                  Pilih semua
                </button>
                <button
                  className="linkbtn"
                  onClick={() => selectItems([])}
                  disabled={selectedItems.length === 0}
                >
                  Batalkan semua
                </button>
              </div>
            </div>

            {items.length > 0 ? (
              <RejectTable
                items={items}
                selectedIds={selectedIds}
                exportIndex={exportIndex}
                isAllSelected={isAllSelected}
                onToggle={toggle}
                onToggleAll={() => selectItems(isAllSelected ? [] : items)}
              />
            ) : (
              <div className="placeholder">
                {rows.length > 0
                  ? "Tidak ada reject di file ini."
                  : 'Upload file export "Goods Receipt Status" dari ECOUNT untuk melihat reject.'}
              </div>
            )}
          </main>
        </div>

        <GenerateBar
          stats={[
            { label: "Terpilih", value: `${selectedItems.length} / ${items.length} baris` },
            { label: "Slip", value: String(slipCount) },
            { label: "Total qty reject", value: formatQty(totalQty), isTotal: true },
          ]}
          hint="1 baris laporan bisa jadi beberapa baris file: satu per kategori Reject 1-4."
          errorMsg={file.errorMsg}
          successMsg={file.successMsg}
          buttonLabel="Generate & Download Internal Use"
          isGenerating={file.isGenerating}
          isDisabled={!!blocker}
          onGenerate={handleGenerate}
        />
      </div>
    </>
  );
}
