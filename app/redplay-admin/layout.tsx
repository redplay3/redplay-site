import type { Metadata } from "next";
import "./admin.css";
import "./stats.css";

export const metadata: Metadata = {
  title: "Редакция",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
