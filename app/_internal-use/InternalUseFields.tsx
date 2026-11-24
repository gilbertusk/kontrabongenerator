import { PIC_LIST } from "@/lib/internalUse";

type Props = {
  tanggal: string;
  picCode: string;
  onTanggalChange: (value: string) => void;
  onPicChange: (value: string) => void;
};

/** Blok "Detail Internal Use": Tanggal Input + PIC (wajib dipilih). */
export default function InternalUseFields({
  tanggal,
  picCode,
  onTanggalChange,
  onPicChange,
}: Props) {
  return (
    <section>
      <div className="block-head">
        <h2 className="block-title">Detail Internal Use</h2>
      </div>
      <div className="form">
        <div>
          <label className="field-label" htmlFor="f-tgl">
            Tanggal Input
          </label>
          <input
            id="f-tgl"
            type="date"
            value={tanggal}
            onChange={(e) => onTanggalChange(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="f-pic">
            PIC
          </label>
          <select
            id="f-pic"
            value={picCode}
            onChange={(e) => onPicChange(e.target.value)}
            className={picCode ? "" : "unset"}
          >
            <option value="">Pilih yang input...</option>
            {PIC_LIST.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
