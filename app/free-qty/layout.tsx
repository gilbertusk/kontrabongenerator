import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Internal Use Free Qty - PT Berlian Artha Label",
  description:
    "Buat file upload ECOUNT Internal Use dari free qty di laporan Sales Status Details.",
};

export default function FreeQtyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
