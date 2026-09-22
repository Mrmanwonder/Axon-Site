/* ═══════════════════════════════════════════════════════════════════════════
   LIBRARY — the archive

   The Library deliberately follows the original Axon reference surface: a
   large title, search, horizontally-scrollable filters, count + sort, then one
   dense paper list. The controls below are real controls rather than static
   prototype chips, while keeping the visual language of the reference.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../data/AppProvider";
import { paperTypeLabel, PAPER_STATUS, statusKeyForRun } from "../data/modules";
import { paths } from "../app/paths";
import PressBox from "../components/PressBox";
import Chevron from "../components/Chevron";
import AppDropdown from "../components/AppDropdown";
import type { AppDropdownOption } from "../components/AppDropdown";

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

export default function Library() {
  const { papers, papersLoaded, papersStale, papersError, progress } = useApp();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("any");
  const [type, setType] = useState("all");
  const [tier, setTier] = useState("any");
  const [sort, setSort] = useState<SortMode>("recent");

  const subjects = useMemo(
    () => [...new Set(papers.map((paper) => paper.subject).filter((value): value is string => typeof value === "string" && value.trim().length > 0))].sort(),
    [papers],
  );

  const types = useMemo(
    () => [...new Set(papers.map((paper) => paper.type))].sort((a, b) => paperTypeLabel(a).localeCompare(paperTypeLabel(b))),
    [papers],
  );

  const filteredPapers = useMemo(() => {
    const now = new Date();
    const normalizedQuery = query.trim().toLocaleLowerCase();

    const result = papers.filter((paper) => {
      if (subject !== "all" && paper.subject !== subject) return false;
      if (type !== "all" && paper.type !== type) return false;
      if (tier !== "any" && paper.tier !== tier) return false;

      const taken = new Date(paper.date_taken);
      if (!Number.isNaN(taken.getTime())) {
        if (dateFilter === "30" && now.getTime() - taken.getTime() > 30 * 86_400_000) return false;
        if (dateFilter === "90" && now.getTime() - taken.getTime() > 90 * 86_400_000) return false;
        if (dateFilter === "year" && taken.getFullYear() !== now.getFullYear()) return false;
      }

      if (normalizedQuery) {
        const searchable = [
          paper.subject ?? "",
          paperTypeLabel(paper.type),
          new Date(paper.date_taken).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        ].join(" ").toLocaleLowerCase();
        if (!searchable.includes(normalizedQuery)) return false;
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
  }, [papers, query, subject, dateFilter, type, tier, sort]);

  const subjectOptions: AppDropdownOption[] = [
    { value: "all", label: "All subjects" },
    ...subjects.map((item) => ({ value: item, label: item })),
  ];
  const dateOptions: AppDropdownOption[] = [
    { value: "any", label: "Any date" },
    { value: "30", label: "Last 30 days" },
    { value: "90", label: "Last 90 days" },
    { value: "year", label: "This year" },
  ];
  const typeOptions: AppDropdownOption[] = [
    { value: "all", label: "All types" },
    ...types.map((item) => ({ value: item, label: paperTypeLabel(item) })),
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

  return (
    <>
      <div className="greet">
        <h1>Library</h1>
      </div>

      <div className="searchwrap">
        <div className="search">
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search questions, chapters, concepts"
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
          {papersLoaded
            ? <>{filteredPapers.length} paper{filteredPapers.length === 1 ? "" : "s"}{papersStale ? " · offline copy" : ""}</>
            : "Loading your papers…"}
        </span>
        <AppDropdown
          ariaLabel="Sort library"
          value={sort}
          options={sortOptions}
          onChange={(value) => setSort(value as SortMode)}
          variant="sort"
          align="right"
        />
      </div>

      <div className="list" aria-busy={!papersLoaded || undefined}>
        {!papersLoaded && (
          <div className="srow noicon" aria-hidden="true">
            <div className="lbl" style={{ width: "100%" }}>
              <div className="skel" style={{ width: "54%" }} />
              <div className="skel" style={{ width: "34%", marginTop: 8 }} />
            </div>
          </div>
        )}

        {/* An empty library and a library we could not read are different
            states; never turn a failed read into a confident empty result. */}
        {papersLoaded && !papers.length && papersError && (
          <div className="srow noicon">
            <div className="lbl">
              We couldn&rsquo;t load your papers
              <small>Your papers are safe — this is us failing to read them, not them being gone. Try again in a moment.</small>
            </div>
          </div>
        )}

        {papersLoaded && !papers.length && !papersError && (
          <div className="srow noicon">
            <div className="lbl">
              Nothing here yet
              <small>Add a paper and it&rsquo;ll show up, readable even offline</small>
            </div>
          </div>
        )}

        {!!papers.length && !filteredPapers.length && (
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
          const run = progress.get(p.id);
          const statusKey = run ? statusKeyForRun(run.status) : null;
          const status = statusKey ? PAPER_STATUS[statusKey] : null;
          const lost = marksLost(p as Record<string, unknown>);
          const date = new Date(p.date_taken).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

          const meta = (
            <>
              <Thumb />
              <div className="b">
                <div className="t1">{p.subject ? `${p.subject} · ` : ""}{paperTypeLabel(p.type)}</div>
                <div className="t2">
                  <span>{pages ? `${pages} page${pages === 1 ? "" : "s"}` : "Paper"}</span>
                  <span>·</span>
                  <span>{date}</span>
                </div>
                <div className="t2" style={{ marginTop: 6 }}>
                  <span className={"tier " + (p.tier === "tier_2" ? "t2" : "t1")}>
                    {p.tier === "tier_2" ? "Scheme-matched" : "Teacher's marks"}
                  </span>
                  {status
                    ? <span className={"tier " + (status.tone === "wait" ? "t1" : "uns")}>{status.label}</span>
                    : (!questions && <span className="tier uns">Not read yet</span>)}
                </div>
              </div>
              <div className="lost" aria-label={lost === null ? "Marks lost unavailable" : `${lost} marks lost`}>
                {lost === null ? "—" : Number.isInteger(lost) ? lost : lost.toFixed(1)}
                <small>lost</small>
              </div>
            </>
          );

          if (status) {
            return (
              <PressBox
                key={p.id}
                as="button"
                type="button"
                className="row"
                data-interactive=""
                onClick={() => navigate(paths.scan)}
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
              to={paths.paper(p.id)}
              className="row"
              data-interactive=""
            >
              {meta}
              <Chevron />
            </PressBox>
          );
        })}
      </div>

      <div className="subnote">Search matches paper subjects, types and dates.</div>
    </>
  );
}
