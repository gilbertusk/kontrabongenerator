import {
  GROSS_WEIGHT,
  KOLI,
  LOCATION_OUT,
  PO_CUSTOMER_PLACEHOLDER,
  ROWS_PER_SLIP,
} from "@/lib/internalUse";
import { formatQty } from "./format";

export type FixedValue = { label: string; value: string };

type Props = {
  /** nilai khusus menu ini (Usage Type, Remark), tampil setelah nilai umum */
  extra: readonly FixedValue[];
};

/** Daftar nilai yang selalu sama di file ECOUNT (tidak bisa diubah di web). */
export default function FixedValues({ extra }: Props) {
  const items: readonly FixedValue[] = [
    { label: "Location-Out", value: LOCATION_OUT },
    { label: "Gross weight / Koli", value: `${GROSS_WEIGHT} / ${KOLI}` },
    { label: "No. PO Customer", value: PO_CUSTOMER_PLACEHOLDER },
    { label: "Seq. No.", value: `1 per ${formatQty(ROWS_PER_SLIP)} baris` },
    ...extra,
  ];

  return (
    <section>
      <div className="block-head">
        <h2 className="block-title">Nilai Tetap di File</h2>
      </div>
      <dl className="kv">
        {items.map(({ label, value }) => (
          <div key={label} className="kv-row">
            <dt>{label}</dt>
            <dd className="mono">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
