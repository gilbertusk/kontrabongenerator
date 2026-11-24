import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Internal Use Reject - PT Berlian Artha Label",
  description:
    "Buat file upload ECOUNT Internal Use dari qty reject di laporan Goods Receipt Status.",
};

export default function RejectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
