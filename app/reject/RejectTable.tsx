import type { GoodsReceiptRow } from "@/lib/parseGoodsReceipt";
import { findRejectCategory, slipSeqNo } from "@/lib/internalUse";
import type { RejectCategoryNo } from "@/lib/internalUse";
import { formatQty } from "../_internal-use/format";
import { slipStartClass } from "../_internal-use/slipStart";

/** Satu baris di file ECOUNT: satu kategori reject dari satu baris laporan. */
export interface RejectItem {
  id: string;
  row: GoodsReceiptRow;
  category: RejectCategoryNo;
  qty: number;
  /** qty ini (sebagian) berasal dari Qty. Reject tanpa rincian kategori */
  isAssumed: boolean;
}

/** Pecah baris laporan jadi baris file: satu per kategori reject. */
export function toRejectItems(rows: readonly GoodsReceiptRow[]): RejectItem[] {
  return rows.flatMap((row) =>
    row.parts.map((p) => ({
      id: `${row.id}-r${p.category}`,
      row,
      category: p.category,
      qty: p.qty,
      isAssumed: p.category === 1 && row.assumedReject1 > 0,
    }))
  );
}

type Props = {
  items: readonly RejectItem[];
  selectedIds: ReadonlySet<string>;
  /** urutan baris di file ECOUNT (0, 1, 2, ...) untuk baris yang dicentang */
  exportIndex: ReadonlyMap<string, number>;
  isAllSelected: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
};

/** Tabel reject dari "Goods Receipt Status", sudah dipecah per kategori. */
export default function RejectTable({
  items,
  selectedIds,
  exportIndex,
  isAllSelected,
  onToggle,
  onToggleAll,
}: Props) {
  return (
    <div className="table-wrap">
      <table className="invoices reject">
        <thead>
          <tr>
            <th className="cb">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={onToggleAll}
                aria-label="Pilih semua baris reject"
              />
            </th>
            <th className="no">No.</th>
            <th className="seq" title="Seq. No. di file ECOUNT (1 slip = 1000 baris)">
              Seq
            </th>
            <th title="Ditulis ke kolom Remark">Flight Number</th>
            <th>Item Code</th>
            <th className="num active">Qty Reject</th>
            <th>Kategori</th>
            <th>Usage Type</th>
            <th>Tanggal</th>
            <th>PIC</th>
            <th>Item Name</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const index = exportIndex.get(item.id);
            const category = findRejectCategory(item.category);
            return (
              <tr key={item.id} className={slipStartClass(index)}>
                <td className="cb">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => onToggle(item.id)}
                    aria-label={`Pilih ${item.row.itemCode} ${category?.label ?? ""}`}
                  />
                </td>
                <td className="no mono">{index === undefined ? "" : index + 1}</td>
                <td className="seq mono">{index === undefined ? "" : slipSeqNo(index)}</td>
                {/* apa adanya: kalau kosong, Remark di file juga kosong */}
                <td className="mono">{item.row.flightNo}</td>
                <td className="mono">{item.row.itemCode}</td>
                <td className="num mono active">{formatQty(item.qty)}</td>
                <td title={category?.description}>
                  {category?.label}
                  {item.isAssumed && (
                    <span
                      className="badge"
                      title={`Qty. Reject ${formatQty(item.row.qtyReject)} tidak dirinci ke Reject 1-4, jadi dimasukkan ke Reject 1`}
                    >
                      TANPA RINCIAN
                    </span>
                  )}
                  {item.row.excessDetail > 0 && (
                    <span
                      className="badge warn"
                      title={`Rincian Reject 1-4 lebih ${formatQty(item.row.excessDetail)} dari Qty. Reject ${formatQty(item.row.qtyReject)}; yang dipakai rinciannya`}
                    >
                      MELEBIHI QTY. REJECT
                    </span>
                  )}
                </td>
                <td className="mono">{category?.usageType}</td>
                <td className="mono">{item.row.dateStr}</td>
                <td>{item.row.picName}</td>
                <td className="desc wide" title={item.row.itemName}>
                  {item.row.itemName}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
