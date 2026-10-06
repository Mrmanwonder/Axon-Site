/**
 * Axon's check of an unmarked paper. Every number here is labelled as an
 * estimate and set apart from teacher marks: a different heading, the
 * "likely"/"unsure" confidence form (never "confirmed"), and a standing note.
 */
import MathText from "./MathText";
import { numMark } from "../data/causes";
import { estimateTotals, type PaperCheck, type RegionCheck } from "../data/schemeCheck";

const CONF_LABEL: Record<RegionCheck["confidence"], string> = { likely: "Likely", unsure: "Unsure" };

export function SchemeCheckSummary({ check, regions }: { check: PaperCheck; regions: Map<string, RegionCheck> }) {
  if (check.status === "queued" || check.status === "running") {
    return (
      <section className="card po-summary" aria-label="Axon's check">
        <div className="po-lost">Checking against the mark scheme</div>
        <div className="po-sub">This paper has no marking, so Axon is checking it against the {check.paper_label} mark scheme. Estimates appear here when ready.</div>
      </section>
    );
  }
  if (check.status !== "done") {
    return (
      <section className="card po-summary" aria-label="Axon's check">
        <div className="po-lost">Not checked</div>
        <div className="po-sub">{check.reason ?? "This paper could not be checked."}</div>
      </section>
    );
  }
  const t = estimateTotals(regions);
  return (
    <section className="card po-summary" aria-label="Axon's estimate">
      <div className="po-lost">
        {t.checked ? <>About {numMark(t.estimated)} of {numMark(t.max)}</> : "No question could be checked"}
      </div>
      <div className="po-sub">Axon&rsquo;s estimate · {check.paper_label} · {t.checked} of {regions.size} questions checked</div>
      <div className="subnote po-note">
        Not a teacher&rsquo;s mark. Axon read the published mark scheme for this paper and estimated each answer. A teacher may mark it differently.
      </div>
    </section>
  );
}

export function SchemeCheckQuestion({ result }: { result: RegionCheck }) {
  if (!result.can_check) {
    return (
      <div className="qfield">
        <div className="k">Axon&rsquo;s check</div>
        <div className="v empty">{result.reason ?? "This question could not be checked."}</div>
      </div>
    );
  }
  return (
    <div className="qfield">
      <div className="k">Axon&rsquo;s estimate</div>
      <div className="v">
        <span className="qmarks">
          {numMark(result.estimated_marks ?? 0)}<small>/{numMark(result.max_marks ?? 0)}</small>
        </span>{" "}
        <span className={"conf " + result.confidence}>{CONF_LABEL[result.confidence]}</span>
      </div>
      {result.what_was_right && (
        <div className="v" style={{ marginTop: 9 }}><b>What earned credit.</b>{" "}<MathText text={result.what_was_right} /></div>
      )}
      {result.what_was_missing.length > 0 && (
        <div className="v" style={{ marginTop: 9 }}>
          <b>What was missing.</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {result.what_was_missing.map((m, i) => <li key={i}><MathText text={m} /></li>)}
          </ul>
        </div>
      )}
      {result.do_this_next && (
        <div className="v" style={{ marginTop: 9 }}><b>Do this next.</b>{" "}<MathText text={result.do_this_next} /></div>
      )}
      <div className="subnote" style={{ marginTop: 9 }}>
        An estimate from the published mark scheme, not a teacher&rsquo;s mark.
      </div>
    </div>
  );
}
