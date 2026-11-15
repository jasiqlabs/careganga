import Link from "next/link";
export default function PublicHome() {
  return <main className="page main">
    <header className="topbar"><strong>CareGanga Foundation</strong><Link href="/admin/login">Foundation staff sign in</Link></header>
    <h1>CareGanga Foundation</h1>
    <p>Foundation operations and healthcare assistance.</p>
    <p>Additional public services will appear only after their owning modules are ready.</p>
  </main>;
}
