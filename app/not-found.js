import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <h1 className="page-title" style={{ fontSize: 28 }}>Seite nicht gefunden</h1>
        <p className="page-subtitle">Diese Seite existiert nicht oder ist nicht mehr verfügbar.</p>
        <Link className="btn btn-primary" href="/admin">
          Zur Administration
        </Link>
      </div>
    </main>
  );
}
