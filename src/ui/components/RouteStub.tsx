/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE STUB

   A deliberately plain placeholder for a route whose screen has not been
   ported yet. It exists to make the routing testable — deep links, params and
   the back button — without inventing any of the design it is standing in for.

   It is not a design pattern and nothing should be copied out of it. It will
   not survive the screen-content pass.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function RouteStub({
  title,
  note,
  params,
}: {
  title: string;
  note: string;
  params?: Record<string, string | undefined>;
}) {
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
        {title}
      </h1>

      <p
        style={{
          marginTop: 10,
          fontSize: "var(--fs-body)",
          lineHeight: 1.5,
          color: "var(--label-2)",
          maxWidth: "34em",
        }}
      >
        {note}
      </p>

      {params && Object.keys(params).length > 0 && (
        <dl
          style={{
            marginTop: 18,
            padding: "14px 16px",
            background: "var(--surface)",
            border: ".5px solid var(--hairline)",
            borderRadius: "var(--r-card)",
            fontSize: "var(--fs-t2)",
            color: "var(--label-2)",
          }}
        >
          {Object.entries(params).map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 10 }}>
              <dt style={{ color: "var(--label-3)", minWidth: 84 }}>{k}</dt>
              <dd style={{ margin: 0, color: "var(--label)" }}>{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
