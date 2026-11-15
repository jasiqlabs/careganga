import Link from "next/link";
export default function PublicHome() {
  return <main className="page main">
    <header className="topbar"><span className="cg-brandline"><img src="/careganga-mark.png" width="40" height="40" alt=""/><strong>CareGanga Foundation</strong></span><Link href="/admin/login">Foundation staff sign in</Link></header>
    <h1>CareGanga Foundation</h1>
    <p>Foundation operations and healthcare assistance.</p>
    <p>More ways to connect with CareGanga Foundation are being prepared. Please check back soon.</p>
  </main>;
}
