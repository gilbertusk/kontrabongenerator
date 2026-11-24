import Link from "next/link";

type MenuId = "kontrabon" | "free-qty";

const MENUS: readonly { id: MenuId; href: string; label: string }[] = [
  { id: "kontrabon", href: "/", label: "Kontrabon" },
  { id: "free-qty", href: "/free-qty", label: "Internal Use Free Qty" },
];

type Props = {
  active: MenuId;
};

/** Menu utama di baris atas; menu aktif ditandai garis bawah. */
export default function TopNav({ active }: Props) {
  return (
    <nav className="topnav" aria-label="Menu utama">
      {MENUS.map((m) => (
        <Link
          key={m.id}
          href={m.href}
          aria-current={m.id === active ? "page" : undefined}
        >
          {m.label}
        </Link>
      ))}
    </nav>
  );
}
