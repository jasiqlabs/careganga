import Link from "next/link";
import { LoginForm } from "../../../../features/identity-access/login-form";
export default function AdminLogin() {
  return <main className="page">
    <header className="topbar"><span className="cg-brandline"><img src="/careganga-mark.png" width="40" height="40" alt=""/><strong>CareGanga Foundation</strong></span><Link href="/">View site</Link></header>
    <section className="auth-card" aria-labelledby="sign-in-title">
      <h1 id="sign-in-title">Foundation staff sign in</h1>
      <p>Use your verified work account and authenticator.</p>
      <LoginForm/>
      <p><Link href="/admin/recovery">Recover account</Link></p>
    </section>
  </main>;
}
