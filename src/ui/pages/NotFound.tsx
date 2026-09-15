import { Link } from "react-router-dom";
import { paths } from "../app/paths";
import DocumentMeta from "../components/DocumentMeta";

export default function NotFound() {
  return (
    <main className="not-found">
      <DocumentMeta title="Page not found | Axon" description="The requested Axon page could not be found." path={location.pathname} noIndex />
      <div className="wordmark">Axon</div>
      <h1
        style={{
          margin: 0,
          fontSize: "var(--fs-h1)",
          fontWeight: "var(--fw-bold)",
          letterSpacing: "var(--ls-h1)",
          lineHeight: 1.06,
        }}
      >
        Page not found
      </h1>
      <p style={{ marginTop: 10, fontSize: "var(--fs-body)", lineHeight: 1.5, color: "var(--label-2)" }}>
        That address does not point to an Axon page. It may have moved, or the link may be incomplete.
      </p>
      <Link to={paths.home} style={{ color: "var(--accent)", fontWeight: "var(--fw-semibold)" }}>
        Open Axon
      </Link>
    </main>
  );
}
