type Props = {
  /** syarat yang belum terpenuhi; kosong = siap */
  blocker: string;
  /** ringkasan saat sudah siap */
  readyText: string;
};

/** Kotak "Ringkasan" di bawah kolom kiri. */
export default function SummaryCallout({ blocker, readyText }: Props) {
  return (
    <div className={`callout${blocker ? "" : " ready"}`}>
      <div className="callout-head">
        <span className="label">Ringkasan</span>
        <span className="status">{blocker ? "Belum lengkap" : "Siap"}</span>
      </div>
      <p>{blocker || readyText}</p>
    </div>
  );
}
