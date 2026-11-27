import type { SalesStatusRow } from "@/lib/parseSalesStatus";
import { slipSeqNo } from "@/lib/internalUse";
import { formatQty } from "../_internal-use/format";
import { slipStartClass } from "../_internal-use/slipStart";

type Props = {
  rows: readonly SalesStatusRow[];
  selectedIds: ReadonlySet<string>;
  /** urutan baris di file ECOUNT (0, 1, 2, ...) untuk baris yang dicentang */
  exportIndex: ReadonlyMap<string, number>;
  isAllSelected: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
};

function rowClass(row: SalesStatusRow, index: number | undefined): string {
  return [row.freeQty === null ? "off" : "", slipStartClass(index)]
    .filter(Boolean)
    .join(" ");
}

/** Tabel item dari "Sales Status Details" beserta free qty hasil bacaan Remarks. */
export default function FreeQtyTable({
  rows,
  selectedIds,
  exportIndex,
  isAllSelected,
  onToggle,
  onToggleAll,
}: Props) {
  return (
    <div className="table-wrap">
      <table className="invoices free-qty">
        <thead>
          <tr>
            <th className="cb">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={onToggleAll}
                aria-label="Pilih semua baris yang punya free"
              />
            </th>
            <th className="no">No.</th>
            <th className="seq" title="Seq. No. di file ECOUNT (1 slip = 1000 baris)">
              Seq
            </th>
            <th>No. SJ</th>
            <th title="Ditulis ke kolom Remark">Flight Number</th>
            <th>Item Code</th>
            <th className="num">Qty</th>
            <th>Remarks/Ikatan</th>
            <th className="num active">Free Qty</th>
            <th>Customer</th>
            <th>Item Name</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const index = exportIndex.get(r.id);
            const hasFree = r.freeQty !== null;
            return (
              <tr
                key={r.id}
                className={rowClass(r, index)}
                title={hasFree ? undefined : "Remarks tidak punya penanda F, jadi tidak ikut"}
              >
                <td className="cb">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.id)}
                    disabled={!hasFree}
                    onChange={() => onToggle(r.id)}
                    aria-label={`Pilih ${r.itemCode} dari ${r.sjNo}`}
                  />
                </td>
                <td className="no mono">{index === undefined ? "" : index + 1}</td>
                <td className="seq mono">
                  {index === undefined ? "" : slipSeqNo(index)}
                </td>
                <td className="mono">{r.sjNo}</td>
                {/* apa adanya: kalau kosong, Remark di file juga kosong */}
                <td className="mono">{r.flightNo}</td>
                <td className="mono">{r.itemCode}</td>
                <td className="num mono">{formatQty(r.qty)}</td>
                <td className="mono remark">{r.remark || "-"}</td>
                <td className="num mono active">
                  {hasFree ? formatQty(r.freeQty ?? 0) : "-"}
                </td>
                <td className="desc" title={r.customer}>
                  {r.customer}
                </td>
                <td className="desc wide" title={r.itemName}>
                  {r.itemName}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
