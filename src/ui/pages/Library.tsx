/* ═══════════════════════════════════════════════════════════════════════════
   LIBRARY — the archive

   The Library deliberately follows the original Axon reference surface: a
   large title, search, horizontally-scrollable filters, count + sort, then one
   dense paper list. The controls below are real controls rather than static
   prototype chips, while keeping the visual language of the reference.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../data/AppProvider";
import { paperTypeLabel, providerKeyForStudent, retryFailedPaper, searchLibrary } from "../data/modules";
import { isPartialTotal } from "../data/paperTotals";
import type { LibrarySearchHit, Paper } from "../data/modules";
import { paperPresentation } from "../data/paperPresentation";
import { subjectPresentation } from "../data/subjectPresentation";
import PressBox from "../components/PressBox";
import Chevron from "../components/Chevron";
import AppDropdown from "../components/AppDropdown";
import type { AppDropdownOption } from "../components/AppDropdown";
import PageSkeleton from "../components/PageSkeleton";
import { useToast } from "../components/ToastProvider";
import { useOptionalScan } from "../scan/ScanProvider";

/** The stacked lines that stand in for a page thumbnail until a real crop
    exists. Decorative. */
function Thumb() {
  return (
    <div className="thumb" aria-hidden="true">
      <div className="ln" style={{ top: 8 }} />
      <div className="ln" style={{ top: 16, right: 16 }} />
      <div className="ln" style={{ top: 24 }} />
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.9" />
      <path d="M15.9 15.9 21 21" />
    </svg>
  );
}

type CountRow = { count: number }[] | undefined;
type DateFilter = "any" | "30" | "90" | "year";
type SortMode = "recent" | "oldest" | "lost";
type SearchState =
  | { state: "idle"; hits: LibrarySearchHit[] }
  | { state: "loading"; hits: LibrarySearchHit[] }
  | { state: "ready"; hits: LibrarySearchHit[] }
  | { state: "failed"; hits: LibrarySearchHit[]; error: string };

const DAY_MS = 86_400_000;

function dateBounds(filter: DateFilter) {
  const now = new Date();
  if (filter === "any") return { dateFrom: null, dateTo: null };
  if (filter === "year") {
    return {
      dateFrom: `${now.getFullYear()}-01-01`,
      dateTo: `${now.getFullYear()}-12-31`,
    };
  }
  const days = filter === "30" ? 30 : 90;
  const from = new Date(now.getTime() - days * DAY_MS);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: now.toISOString().slice(0, 10),
  };
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function marksLost(paper: Record<string, unknown>): number | null {
  const awarded = numeric(paper.total_awarded);
  const available = numeric(paper.total_available) ?? numeric(paper.stated_maximum);
  if (awarded === null || available === null) return null;
  return Math.max(0, available - awarded);
}

/** Subject names compare without case or a trailing syllabus code. */
export function sameSubject(a: string, b: string): boolean {
  const norm = (x: string) => x.replace(/·.*$/, "").trim().toLowerCase();
  return norm(a) === norm(b);
}

/** The reader's reason, cut to one plain clause for a list row. */
function shortReason(reason: string): string {
  if (/no marking/i.test(reason)) return "no marking found";
  const first = reason.split(/(?<=\.)\s/)[0].replace(/\.$/, "");
  return first.length > 48 ? first.slice(0, 47) + "…" : first.charAt(0).toLowerCase() + first.slice(1);
}

export default function Library() {
  const { papers, papersError, papersResource, progressResource, refreshLibrary, student } = useApp();
  const providerKey = providerKeyForStudent(student);

  const navigate = useNavigate();
  const toast = useToast();
  const sends = useOptionalScan()?.sends ?? [];
  const [retrying, setRetrying] = useState<Set<string>>(() => new Set());

  const retryPaper = async (paperId: string) => {
    if (retrying.has(paperId)) return;
    setRetrying(current => new Set(current).add(paperId));
    try {
      const result = await retryFailedPaper(paperId);
      if (result.retry === "started") toast("Retry started.");
      else if (result.retry === "already_in_progress") toast("This paper is already being retried.");
      else toast("This paper can’t be retried from its saved pages.", "warn");
      await refreshLibrary();
    } catch (error) {
      toast((error as Error).message || "Retry could not start. Try again.", "warn");
      await refreshLibrary();
    } finally {
      setRetrying(current => {
        const next = new Set(current);
        next.delete(paperId);
        return next;
      });
    }
  };

  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("any");
  const [type, setType] = useState("all");
  const [tier, setTier] = useState("any");
  const [sort, setSort] = useState<SortMode>("recent");
  const [searchRevision, setSearchRevision] = useState(0);
  const [searchState, setSearchState] = useState<SearchState>({ state: "idle", hits: [] });
  const normalizedQuery = query.trim();

  const verifiedSubjects = useMemo(() => {
    const byId = new Map<string, string>();
    for (const paper of papers) {
      if (!paper.subject_offering_id || !paper.subject_display_snapshot) continue;
      const code = paper.subject_external_code_snapshot?.trim();
      byId.set(
        paper.subject_offering_id,
        code ? `${paper.subject_display_snapshot} · ${code}` : paper.subject_display_snapshot,
      );
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [papers]);

  const types = useMemo(
    () => [...new Set(papers.map((paper) => paper.type))].sort((a, b) => paperTypeLabel(a, providerKey).localeCompare(paperTypeLabel(b, providerKey))),
    [papers],
  );

  const selectedOfferingId = subject.startsWith("subject:") ? subject.slice("subject:".length) : null;
  const selectedSubjectName = subject.startsWith("name:") ? subject.slice("name:".length) : null;
  // Private search filters by the canonical offering; a subject chosen by name
  // maps to the verified offering with that name when one exists.
  const searchOfferingId = selectedOfferingId
    ?? (selectedSubjectName ? verifiedSubjects.find(([, label]) => sameSubject(selectedSubjectName, label))?.[0] ?? null : null);
  const selectedSubjectState = subject === "unknown"
    ? "unknown"
    : subject === "suggested"
      ? "suggested"
      : "all";

  useEffect(() => {
    if (!normalizedQuery) {
      setSearchState({ state: "idle", hits: [] });
      return;
    }

    let cancelled = false;
    const previousHits = searchState.hits;
    setSearchState({ state: "loading", hits: previousHits });
    const timer = window.setTimeout(() => {
      const bounds = dateBounds(dateFilter);
      void searchLibrary({
        query: normalizedQuery,
        subjectOfferingId: searchOfferingId,
        subjectState: selectedSubjectState,
        paperType: type === "all" ? null : type,
        tier: tier === "any" ? null : tier,
        ...bounds,
        limit: 250,
      }).then((hits) => {
        if (!cancelled) setSearchState({ state: "ready", hits });
      }).catch((error) => {
        if (!cancelled) {
          setSearchState({
            state: "failed",
            hits: previousHits,
            error: error instanceof Error ? error.message : "Search could not be completed.",
          });
        }
      });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // searchState.hits is intentionally excluded: it is retained only while a
    // newer request is pending and must never retrigger that request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    normalizedQuery,
    searchOfferingId,
    selectedSubjectState,
    type,
    tier,
    dateFilter,
    searchRevision,
  ]);

  const hitByPaper = useMemo(
    () => new Map(searchState.hits.map((hit) => [hit.paper_id, hit])),
    [searchState.hits],
  );

  const filteredPapers = useMemo(() => {
    if (normalizedQuery) {
      if (searchState.state === "idle") return [];
      const byId = new Map(papers.map((paper) => [paper.id, paper]));
      return searchState.hits
        .map((hit) => byId.get(hit.paper_id))
        .filter((paper): paper is Paper => Boolean(paper));
    }

    const now = new Date();
    const result = papers.filter((paper) => {
      if (selectedOfferingId && paper.subject_offering_id !== selectedOfferingId) return false;
      const subjectInfo = subjectPresentation(
        paper,
        undefined,
        progressResource.data?.get(paper.id),
      );
      if (selectedSubjectName && (subjectInfo.state === "unknown" || !sameSubject(selectedSubjectName, subjectInfo.label))) return false;
      if (selectedSubjectState === "unknown" && subjectInfo.state !== "unknown") return false;
      if (selectedSubjectState === "suggested" && subjectInfo.state !== "suggested") return false;
      if (type !== "all" && paper.type !== type) return false;
      if (tier !== "any" && paper.tier !== tier) return false;

      const taken = new Date(paper.date_taken);
      if (!Number.isNaN(taken.getTime())) {
        if (dateFilter === "30" && now.getTime() - taken.getTime() > 30 * DAY_MS) return false;
        if (dateFilter === "90" && now.getTime() - taken.getTime() > 90 * DAY_MS) return false;
        if (dateFilter === "year" && taken.getFullYear() !== now.getFullYear()) return false;
      }
      return true;
    });

    return [...result].sort((a, b) => {
      if (sort === "lost") {
        const aLost = marksLost(a as Record<string, unknown>);
        const bLost = marksLost(b as Record<string, unknown>);
        if (aLost !== null || bLost !== null) return (bLost ?? -1) - (aLost ?? -1);
      }
      const aTime = new Date(a.date_taken).getTime();
      const bTime = new Date(b.date_taken).getTime();
      return sort === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [
    papers,
    normalizedQuery,
    searchState,
    selectedOfferingId,
    selectedSubjectName,
    selectedSubjectState,
    progressResource.data,
    dateFilter,
    type,
    tier,
    sort,
  ]);

  // The student's own subjects, always (owner, 5 Oct 2026). A paper whose
  // subject is not known yet is listed under "No subject yet" only while one
  // exists; the paper itself offers to set it.
  const selections = student?.subject_selections ?? [];
  const studentSubjects = selections.length
    ? selections.map((sel) => ({ id: sel.offering_id as string | null, name: sel.subject }))
    : (student?.subjects ?? []).filter(Boolean).map((name) => ({ id: null as string | null, name }));
  const hasUnknown = papers.some((paper) => subjectPresentation(paper, undefined, progressResource.data?.get(paper.id)).state === "unknown");
  const subjectOptions: AppDropdownOption[] = [
    { value: "all", label: "All subjects" },
    ...studentSubjects.map((sub) => ({ value: sub.id ? `subject:${sub.id}` : `name:${sub.name}`, label: sub.name })),
    ...verifiedSubjects
      .filter(([id, label]) => !studentSubjects.some((sub) => sub.id === id || sameSubject(sub.name, label)))
      .map(([id, label]) => ({ value: `subject:${id}`, label })),
    ...(hasUnknown || subject === "unknown" ? [{ value: "unknown", label: "No subject yet" }] : []),
  ];
  const dateOptions: AppDropdownOption[] = [
    { value: "any", label: "Any date" },
    { value: "30", label: "Last 30 days" },
    { value: "90", label: "Last 90 days" },
    { value: "year", label: "This year" },
  ];
  const typeOptions: AppDropdownOption[] = [
    { value: "all", label: "All types" },
    ...types.map((item) => ({ value: item, label: paperTypeLabel(item, providerKey) })),
  ];
  const tierOptions: AppDropdownOption[] = [
    { value: "any", label: "Any tier" },
    { value: "tier_2", label: "Scheme-matched" },
    { value: "tier_1", label: "Teacher's marks" },
  ];
  const sortOptions: AppDropdownOption[] = [
    { value: "recent", label: "Most recent" },
    { value: "oldest", label: "Oldest first" },
    { value: "lost", label: "Most marks lost" },
  ];

  if (papersResource.state === "loading" && papersResource.data === null) {
    return <PageSkeleton variant="library" label="Loading papers…" />;
  }

  return (
    <>
      <div className="greet">
        <h1>Library</h1>
      </div>

      <div className="searchwrap ph-no-capture" data-private-academic-search="true">
        <div className="search">
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search papers, questions and answers"
            aria-label="Search library"
          />
        </div>
      </div>

      <div className="filterbar" aria-label="Library filters">
        <AppDropdown ariaLabel="Filter by subject" value={subject} options={subjectOptions} onChange={setSubject} selected={subject !== "all"} />
        <AppDropdown ariaLabel="Filter by date" value={dateFilter} options={dateOptions} onChange={(value) => setDateFilter(value as DateFilter)} selected={dateFilter !== "any"} />
        <AppDropdown ariaLabel="Filter by paper type" value={type} options={typeOptions} onChange={setType} selected={type !== "all"} />
        <AppDropdown ariaLabel="Filter by tier" value={tier} options={tierOptions} onChange={setTier} selected={tier !== "any"} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "6px var(--text-gutter) 10px" }}>
        <span style={{ fontSize: 12.5, color: "var(--label-3)", fontWeight: 500 }}>
          {papersResource.data !== null && searchState.state !== "loading" && (
            <>{filteredPapers.length} paper{filteredPapers.length === 1 ? "" : "s"}</>
          )}
          {normalizedQuery && searchState.state === "loading" && <>Searching…</>}

        </span>
        {normalizedQuery
          ? <span style={{ fontSize: 12.5, color: "var(--label-3)", fontWeight: 500 }}>Best match</span>
          : <AppDropdown
              ariaLabel="Sort library"
              value={sort}
              options={sortOptions}
              onChange={(value) => setSort(value as SortMode)}
              variant="sort"
              align="right"
            />}
      </div>

      {papersError && <div role="status">{papersResource.data !== null ? "Last available papers. " : ""}<button onClick={() => void refreshLibrary()}>Retry library</button></div>}
      {normalizedQuery && searchState.state === "failed" && (
        <div role="status" className="subnote">
          {searchState.hits.length
            ? <>Last available matches. Search couldn&rsquo;t reach the private index. </>
            : <>Search couldn&rsquo;t reach the private index. </>}
          <button onClick={() => setSearchRevision((value) => value + 1)}>Try again</button>
        </div>
      )}
      <div className="list">
        {!papers.length && papersError && (

          <div className="srow noicon">
            <div className="lbl">
              We couldn&rsquo;t load your papers
              <small>Your papers are safe — this is us failing to read them, not them being gone. Try again in a moment.</small>
            </div>
          </div>
        )}

        {!papers.length && papersResource.state === "ready" && (

          <div className="srow noicon">
            <div className="lbl">
              Nothing here yet
              <small>Add a paper and it&rsquo;ll show up, readable even offline</small>
            </div>
          </div>
        )}

        {!!papers.length && !filteredPapers.length && searchState.state !== "loading" && searchState.state !== "failed" && (
          <div className="srow noicon">
            <div className="lbl">
              No matching papers
              <small>Try changing the search or one of the filters.</small>
            </div>
          </div>
        )}

        {filteredPapers.map((p) => {
          const pages = (p.paper_page as CountRow)?.[0]?.count ?? 0;
          const questions = (p.student_attempt as CountRow)?.[0]?.count ?? 0;
          const send = sends.find((job) => job.paperId === p.id && ["sending", "waiting", "stuck"].includes(job.phase));
          const base = paperPresentation(p, progressResource);
          // A paper still leaving this phone says so, in pages (owner, 6 Oct 2026).
          const presentation = send ? {
            ...base, canOpen: true, canRetry: false, status: "sending",
            statusLabel: send.phase === "sending"
              ? `Sending · ${send.pages.filter((pg) => pg.sent).length} of ${send.pages.length} pages`
              : send.phase === "waiting" ? "Waiting for a connection to finish sending" : "Waiting to send",
            tone: send.phase === "sending" ? "wait" : "attention",
          } : base;
          const status = { label: presentation.statusLabel, tone: presentation.tone };
          const lost = marksLost(p as Record<string, unknown>);
          const date = new Date(p.date_taken).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

          const subjectInfo = subjectPresentation(
            p,
            hitByPaper.get(p.id),
            progressResource.data?.get(p.id),
          );
          // One title, one line of facts, one status line when there is a
          // status. Explanations live on the paper, not on the card.
          const title = subjectInfo.state === "unknown" ? paperTypeLabel(p.type, providerKey) : subjectInfo.label;
          const facts = [
            subjectInfo.state === "unknown" ? null : paperTypeLabel(p.type, providerKey),
            pages ? `${pages} page${pages === 1 ? "" : "s"}` : null,
            date,
          ].filter(Boolean).join(" · ");
          const statusLine = status
            ? (presentation.status === "rejected" && presentation.reason ? `Not read: ${shortReason(presentation.reason)}` : status.label)
            : (!questions ? "Not read yet" : null);
          const meta = (
            <>
              <Thumb />
              <div className="b">
                <div className="t1">{title}</div>
                <div className="t2">{facts}</div>
                {statusLine && (
                  <div className="lib-status" data-tone={status?.tone ?? "wait"}>
                    <i aria-hidden="true" />{statusLine}
                  </div>
                )}
              </div>
              <div className="lost" aria-label={lost === null ? "Marks lost unavailable" : `${isPartialTotal(p as Record<string, unknown>) ? "at least " : ""}${lost} marks lost`}>
                {lost === null ? "—" : Number.isInteger(lost) ? lost : lost.toFixed(1)}
                <small>{isPartialTotal(p as Record<string, unknown>) ? "lost, at least" : "lost"}</small>
              </div>
            </>
          );

          if (status) {
            if (presentation.canRetry) {
              const busy = retrying.has(p.id);
              return (
                <div className="row library-failed-row" key={p.id}>
                  {meta}
                  <PressBox
                    as="button"
                    type="button"
                    className="paper-retry"
                    disabled={busy}
                    aria-busy={busy}
                    onClick={() => void retryPaper(p.id)}
                  >
                    {busy ? "Retrying…" : "Retry"}
                  </PressBox>
                </div>
              );
            }
            return (
              <PressBox
                key={p.id}
                as="button"
                type="button"
                className="row"
                data-interactive=""
                disabled={!presentation.canOpen}
                onClick={() => navigate(presentation.destination)}
              >
                {meta}
                <Chevron />
              </PressBox>
            );
          }

          return (
            <PressBox
              as={Link}
              key={p.id}
              to={presentation.destination}
              className="row"
              data-interactive=""
            >
              {meta}
              <Chevron />
            </PressBox>
          );
        })}
      </div>

    </>
  );
}
