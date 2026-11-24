export type Stat = { label: string; value: string; isTotal?: boolean };

type Props = {
  stats: readonly Stat[];
  /** keterangan saat tidak ada pesan error/sukses */
  hint: string;
  errorMsg: string;
  successMsg: string;
  buttonLabel: string;
  isGenerating: boolean;
  isDisabled: boolean;
  onGenerate: () => void;
};

/** Baris bawah: angka ringkasan, pesan, dan tombol generate. */
export default function GenerateBar({
  stats,
  hint,
  errorMsg,
  successMsg,
  buttonLabel,
  isGenerating,
  isDisabled,
  onGenerate,
}: Props) {
  const message = errorMsg
    ? { cls: "inline-msg error", text: errorMsg }
    : successMsg
    ? { cls: "inline-msg ok", text: successMsg }
    : { cls: "inline-msg", text: hint };

  return (
    <footer className="actionbar">
      <div className="stats">
        {stats.map((s) => (
          <div key={s.label}>
            <span className="k">{s.label}</span>
            <span className={`v mono${s.isTotal ? " total" : ""}`}>{s.value}</span>
          </div>
        ))}
      </div>

      <div className="bar-right">
        <span className={message.cls}>{message.text}</span>
        <button
          className="btn-primary"
          onClick={onGenerate}
          disabled={isGenerating || isDisabled}
        >
          {isGenerating ? "Membuat file..." : buttonLabel}
        </button>
      </div>
    </footer>
  );
}
