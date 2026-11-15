import Link from "next/link";
import { RecoveryForm } from "../../../../features/identity-access/recovery-form";
export default function Recovery() {
  return <main className="page">
    <header className="topbar"><strong>CareGanga Foundation</strong><Link href="/">View site</Link></header>
    <section className="auth-card"><h1>Recover Foundation staff access</h1><RecoveryForm/></section>
  </main>;
}
