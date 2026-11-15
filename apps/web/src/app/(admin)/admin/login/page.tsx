import Link from "next/link";
import { LoginForm } from "../../../../features/identity-access/login-form";
export default function AdminLogin() {
  return <main className="page">
    <header className="topbar"><strong>CareGanga Foundation</strong><Link href="/">View site</Link></header>
    <section className="auth-card" aria-labelledby="sign-in-title">
      <h1 id="sign-in-title">Foundation staff sign in</h1>
      <p>Use your verified work account and authenticator.</p>
      <LoginForm/>
    </section>
  </main>;
}
