import Link from "next/link";
import { AdminSignOut } from "@/components/admin/admin-sign-out";
import "./admin.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function AdminTopbar() {
  return <header className="admin-topbar"><Link href="/redplay-admin" className="admin-brand"><span className="redplay-mark small">R</span><span>REDPLAY <small>Редакция</small></span></Link><nav><Link href="/redplay-admin">Публикации</Link><Link href="/redplay-admin/articles/new">Новый материал</Link><Link href="/">Открыть сайт</Link><AdminSignOut/></nav></header>;
}
