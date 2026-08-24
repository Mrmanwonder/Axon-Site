import { Link } from "react-router-dom";
import { paths } from "../app/paths";

export default function NotFound() {
  return (
    <div style={{ padding: "16px var(--text-gutter)" }}>
      <h1
        style={{
          margin: 0,
          fontSize: "var(--fs-h1)",
          fontWeight: "var(--fw-bold)",
          letterSpacing: "var(--ls-h1)",
          lineHeight: 1.06,
        }}
      >
        Nothing here
      </h1>
      <p style={{ marginTop: 10, fontSize: "var(--fs-body)", lineHeight: 1.5, color: "var(--label-2)" }}>
        That link doesn&rsquo;t point at anything in your library.
      </p>
      <Link to={paths.home} style={{ color: "var(--accent)", fontWeight: "var(--fw-semibold)" }}>
        Go home
      </Link>
    </div>
  );
}
