import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import DocumentMeta from "../components/DocumentMeta";
import { paths } from "../app/paths";

type LegalKind = "privacy" | "terms" | "cookies";
type Props = { kind: LegalKind; children: ReactNode };

const META: Record<LegalKind, { title: string; description: string; heading: string; path: string }> = {
  privacy: {
    title: "Privacy Policy | Axon",
    description: "How Axon collects, uses, protects, retains and deletes account, student and scanned-paper data.",
    heading: "Privacy Policy",
    path: paths.privacy,
  },
  terms: {
    title: "Terms and Conditions | Axon",
    description: "The terms governing Axon accounts, study materials, AI-generated output, subscriptions and use of the service.",
    heading: "Terms and Conditions",
    path: paths.terms,
  },
  cookies: {
    title: "Cookie Policy | Axon",
    description: "How Axon uses necessary browser storage and optional PostHog analytics, and how to control those choices.",
    heading: "Cookie & Similar Technologies Policy",
    path: paths.cookies,
  },
};

export default function LegalPage({ kind, children }: Props) {
  const meta = META[kind];
  return (
    <div className="public-page">
      <DocumentMeta title={meta.title} description={meta.description} path={meta.path} />
      <header className="public-header">
        <Link className="wordmark" to={paths.home} aria-label="Axon home">Axon</Link>
        <Link className="public-cta" to={paths.home}>Open Axon</Link>
      </header>
      <main className="legal-content" id="main-content">
        <p className="eyebrow">Legal</p>
        <h1>{meta.heading}</h1>
        <p className="updated">Effective 22 September 2026 · Last updated 22 September 2026</p>
        {children}
      </main>
      <footer className="public-footer">
        <span>Axon</span>
        <nav aria-label="Legal">
          <Link to={paths.privacy}>Privacy</Link>
          <Link to={paths.terms}>Terms</Link>
          <Link to={paths.cookies}>Cookies</Link>
        </nav>
      </footer>
    </div>
  );
}
