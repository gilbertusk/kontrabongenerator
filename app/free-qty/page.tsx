"use client";

import { useState } from "react";
import {
  parseSalesStatusWorkbook,
  SalesStatusParseResult,
  SalesStatusRow,
} from "@/lib/parseSalesStatus";
import { FREE_QTY_USAGE_TYPE, freeQtyRemark, isValidIsoDate, slipSeqNo } from "@/lib/internalUse";
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
import FreeQtyTable from "./FreeQtyTable";

function hasFree(row: SalesStatusRow): boolean {
  return row.freeQty !== null;
}

export default function FreeQtyPage() {
  const [fileName, setFileName] = useState("");
  const [parseResult, setParseResult] = useState<SalesStatusParseResult | null>(null);
  const [parseError, setParseError] = useState("");
  const { selectedIds, toggle, selectOnly } = useSelection();
  const form = useInternalUseForm();
  const file = useGenerateFile();

  const rows = parseResult?.rows ?? [];
  const freeRows = rows.filter(hasFree);
  const noFreeCount = rows.length - freeRows.length;

  /** Baris yang ikut ke file, dalam urutan file ECOUNT. */
  const selectedRows = freeRows.filter((r) => selectedIds.has(r.id));
  const exportIndex = new Map(selectedRows.map((r, i) => [r.id, i] as const));
  const totalFree = selectedRows.reduce((sum, r) => sum + (r.freeQty ?? 0), 0);
  const slipCount = selectedRows.length ? slipSeqNo(selectedRows.length - 1) : 0;
  const isAllSelected = freeRows.length > 0 && selectedRows.length === freeRows.length;

  const blocker =
    rows.length === 0
      ? "Belum ada file Sales Status Details yang dibaca."
      : selectedRows.length === 0
      ? "Belum ada baris free yang dicentang."
      : form.formBlocker;

  function selectRows(next: readonly SalesStatusRow[]) {
    selectOnly(next.map((r) => r.id));
  }

  async function handleFile(upload: File) {
    file.clearMessages();
    setParseError("");
    setFileName(upload.name);
    try {
      const result = parseSalesStatusWorkbook(await upload.arrayBuffer());
      setParseResult(result);
      selectRows(result.rows.filter(hasFree));
      if (result.rows.length === 0) {
        setParseError(result.warnings[0] || "Tidak ada baris item yang terbaca.");
      }
    } catch (e) {
      console.error(e);
      setParseResult(null);
      selectRows([]);
      setParseError(
        'Gagal membaca file. Pastikan ini file .xlsx export "Sales Status Details" dari ECOUNT.'
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
        kind: "free",
        tanggal: form.tanggal,
        picCode: form.picCode,
        rows: selectedRows.map((r) => ({ itemCode: r.itemCode, qty: r.freeQty })),
      },
      "Internal Use Free Qty.xlsx"
    );
  }

  const sidebarMessage = parseError || parseResult?.warnings.join(" ") || "";
  const remarkPreview = isValidIsoDate(form.tanggal) ? freeQtyRemark(form.tanggal) : "-";

  return (
    <>
      <Intro />
      <div className="app">
        <AppTopbar active="free-qty" />

        <div className="workspace">
          <aside className="sidebar">
            <section>
              <FileDrop title="Sales Status Details" fileName={fileName} onFile={handleFile} />
              {sidebarMessage && <p className="helper">{sidebarMessage}</p>}
            </section>

            <InternalUseFields
              tanggal={form.tanggal}
              picCode={form.picCode}
              onTanggalChange={form.setTanggal}
              onPicChange={form.setPicCode}
            />

            <FixedValues
              extra={[
                { label: "Usage Type", value: FREE_QTY_USAGE_TYPE },
                { label: "Remark", value: remarkPreview },
              ]}
            />

            <SummaryCallout
              blocker={blocker}
              readyText={`${selectedRows.length} baris · ${slipCount} slip · total free ${formatQty(totalFree)}`}
            />
          </aside>

          <main className="content">
            {noFreeCount > 0 && (
              <p className="notice">
                <b>{noFreeCount} baris</b> tidak punya penanda free (F / L1F) di
                Remarks/Ikatan, jadi tidak bisa dicentang. Free layer 2 (L2F) memang
                tidak dihitung.
              </p>
            )}

            <div className="content-head">
              <h1>
                Free Qty
                <span className="tag mono">[ECOUNT : INTERNAL USE]</span>
              </h1>
              <div className="head-actions">
                <button
                  className="linkbtn strong"
                  onClick={() => selectRows(freeRows)}
                  disabled={freeRows.length === 0 || isAllSelected}
                >
                  Pilih semua
                </button>
                <button
                  className="linkbtn"
                  onClick={() => selectRows([])}
                  disabled={selectedRows.length === 0}
                >
                  Batalkan semua
                </button>
              </div>
            </div>

            {rows.length > 0 ? (
              <FreeQtyTable
                rows={rows}
                selectedIds={selectedIds}
                exportIndex={exportIndex}
                isAllSelected={isAllSelected}
                onToggle={toggle}
                onToggleAll={() => selectRows(isAllSelected ? [] : freeRows)}
              />
            ) : (
              <div className="placeholder">
                Upload file export &quot;Sales Status Details&quot; dari ECOUNT untuk
                melihat free qty.
              </div>
            )}
          </main>
        </div>

        <GenerateBar
          stats={[
            { label: "Terpilih", value: `${selectedRows.length} / ${freeRows.length} baris` },
            { label: "Slip", value: String(slipCount) },
            { label: "Total free qty", value: formatQty(totalFree), isTotal: true },
          ]}
          hint="Free diambil dari F pertama di Remarks/Ikatan (L1F ikut, L2F tidak)."
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
