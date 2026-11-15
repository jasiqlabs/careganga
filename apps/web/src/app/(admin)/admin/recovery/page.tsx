import Link from "next/link";
import { RecoveryForm } from "../../../../features/identity-access/recovery-form";
export default function Recovery() {
  return <main className="page">
    <header className="topbar"><span className="cg-brandline"><img src="/careganga-mark.png" width="40" height="40" alt=""/><strong>CareGanga Foundation</strong></span><Link href="/">View site</Link></header>
    <section className="auth-card"><h1>Recover Foundation staff access</h1><RecoveryForm/></section>
  </main>;
}
