import TopNav, { MenuId } from "./TopNav";

type Props = {
  active: MenuId;
  /** isi tambahan di sebelah kanan menu, mis. tombol Bantuan */
  children?: React.ReactNode;
};

/** Baris atas semua halaman: logo, menu utama, nama perusahaan. */
export default function AppTopbar({ active, children }: Props) {
  return (
    <header className="topbar">
      <span className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-bal.png" alt="PT Berlian Artha Label" />
        Kontrabon Generator
      </span>
      <TopNav active={active} />
      {children}
      <span className="company">PT Berlian Artha Label</span>
    </header>
  );
}
