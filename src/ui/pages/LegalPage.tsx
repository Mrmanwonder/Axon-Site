import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import DocumentMeta from "../components/DocumentMeta";
import { paths } from "../app/paths";

type Props = { kind: "privacy" | "terms"; children: ReactNode };

export default function LegalPage({ kind, children }: Props) {
  const privacy = kind === "privacy";
  const title = privacy ? "Privacy Policy | Axon" : "Terms of Service | Axon";
  const description = privacy
    ? "How Axon collects, uses, protects, retains and deletes account, study and scanned-paper data."
    : "The terms that apply when using Axon and uploading study materials."
  return (
    <div className="public-page">
      <DocumentMeta title={title} description={description} path={privacy ? paths.privacy : paths.terms} />
      <header className="public-header">
        <Link className="wordmark" to={paths.home} aria-label="Axon home">Axon</Link>
        <Link className="public-cta" to={paths.home}>Open Axon</Link>
      </header>
      <main className="legal-content" id="main-content">
        <p className="eyebrow">Legal</p>
        <h1>{privacy ? "Privacy Policy" : "Terms of Service"}</h1>
        <p className="updated">Last updated 14 September 2026</p>
        {children}
      </main>
      <footer className="public-footer">
        <span>Axon</span>
        <nav aria-label="Legal">
          <Link to={paths.privacy}>Privacy</Link>
          <Link to={paths.terms}>Terms</Link>
        </nav>
      </footer>
    </div>
  );
}
