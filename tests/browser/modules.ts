const scenario = new URLSearchParams(location.search).get("scenario");
const HOUSEHOLD = scenario === "student-scope-household";
const wait = () => new Promise(resolve => setTimeout(resolve, 2000));
let householdScope = HOUSEHOLD
  ? (sessionStorage.getItem("axon.test.household.scope") ?? "student-a")
  : null;
export const sb = {
  from: (table: string) => ({
    select: () => ({
      eq: () => table === "student"
        ? { order: async () => ({ data: HOUSEHOLD
          ? [
              { id: "student-a", first_name: "Alpha", programme_id: null, stage_id: null },
              { id: "student-b", first_name: "Beta", programme_id: null, stage_id: null },
            ]
          : [{ id: "student", first_name: "Sam", programme_id: null, stage_id: null }] }) }
        : Promise.resolve({ data: [{ subject: "physics" }] }),
      in: async () => ({
        data: table === "student_subject"
          ? (HOUSEHOLD
            ? ["student-a", "student-b"].map(student_id => ({
                student_id,
                subject: "physics",
                subject_offering_id: null,
                selected_level: null,
                display_name_snapshot: null,
                external_code_snapshot: null,
              }))
            : [{
                student_id: "student",
                subject: "physics",
                subject_offering_id: null,
                selected_level: null,
                display_name_snapshot: null,
                external_code_snapshot: null,
              }])
          : [],
        error: null,
      }),
    }),
  }),
};
export async function currentSession() {
  if (scenario === "auth-error") throw new Error("Auth unavailable");
  if (HOUSEHOLD && sessionStorage.getItem("axon.test.household.signed-out") === "1") return null;
  return {};
}
export const currentGuardian = async () => ({ id: "guardian" });
export const studentScopeState = async () => HOUSEHOLD && householdScope
  ? { active: true, student_id: householdScope, remaining_seconds: 1800 }
  : { active: false, student_id: null, remaining_seconds: 0 };
export const setStudentScope = async (studentId: string) => {
  if (HOUSEHOLD) {
    householdScope = studentId;
    sessionStorage.setItem("axon.test.household.scope", studentId);
  }
  return { active: true, student_id: studentId, remaining_seconds: 1800 };
};
export const clearStudentScope = async () => {
  if (HOUSEHOLD) {
    householdScope = null;
    sessionStorage.removeItem("axon.test.household.scope");
  }
  return true;
};
export const takeProviderError = () => null;
export const onAuthChange = () => ({ data: { subscription: { unsubscribe() {} } } });
export const readLocal = () => ({ theme: "dark", text_size: "m", reduce_motion: true });
export const loadPrefs = async () => readLocal();
export const savePrefs = async () => readLocal();
export async function readConsentState() { if (scenario === "consent-error") throw new Error("Ledger unavailable"); return {}; }
export const recordConsent = async () => {};
export const withdrawConsent = async () => {};
export const signOut = async () => {
  if (!HOUSEHOLD) return;
  await clearStudentScope();
  const { LocalDataService } = await import("../../src/local-data.js");
  await LocalDataService.clearAll();
  sessionStorage.setItem("axon.test.household.signed-out", "1");
};
// `insights`: six marked Physics and Mathematics papers with repeating causes, for judging the Insights screen.
const INSIGHT_PAPERS = [
  ["ip1", "Physics", "2026-05-12", 40, 27], ["ip2", "Mathematics", "2026-06-02", 50, 38], ["ip3", "Physics", "2026-07-08", 40, 29],
  ["ip4", "Mathematics", "2026-08-11", 50, 41], ["ip5", "Physics", "2026-09-03", 40, 33], ["ip6", "Physics", "2026-09-24", 40, 34],
].map(([id, subject, date, available, awarded]) => ({
  id, subject, type: "unit_test", tier: "tier_1", date_taken: date, created_at: date,
  total_available: available, total_awarded: awarded, total_partial: false, student_attempt: [{ count: 6 }],
}));
function insightFixture() {
  const attempts: Record<string, unknown>[] = []; const losses: Record<string, unknown>[] = [];
  const add = (paper: string, n: number, label: string, max: number, got: number, loss?: Record<string, unknown>, blank = false) => {
    const id = `${paper}-a${n}`;
    attempts.push({ id, paper_id: paper, question_label: label, max_marks: max, marks_awarded: got, question_order: n, answer_blank: blank });
    if (loss) losses.push({ id: `${id}-l`, attempt_id: id, marks_lost: max - got, created_at: "2026-09-25T00:00:00Z", concepts: null, loss_reasons: null, depends_on_parts: null, command_word: null, do_this_next: null, ...loss });
  };
  for (const p of INSIGHT_PAPERS) {
    const physics = p.subject === "Physics";
    add(p.id, 0, "1(a)", 2, 2);
    add(p.id, 1, "1(b)", 3, 1, physics
      ? { cause: "keyword_miss", command_word: "Explain", concepts: ["Newton's second law"], do_this_next: "Name the law in your first sentence, then apply it to this situation.",
          loss_reasons: [{ cause: "keyword_miss", marks: 2, error_type: "presentation" }] }
      : { cause: "procedural_slip", command_word: "Calculate", concepts: ["Expected value"], do_this_next: "Round only the final answer, to 3 significant figures.",
          loss_reasons: [{ cause: "procedural_slip", marks: 2, error_type: "final_answer" }] });
    add(p.id, 2, "2", 4, 4);
    add(p.id, 3, "3(a)", 6, 3, { cause: "incomplete", command_word: "Describe", concepts: physics ? ["Energy transfers"] : ["Variance"], do_this_next: "Make one point per mark: six marks means six separate, linked statements.", depends_on_parts: physics ? [] : ["2"] });
    add(p.id, 4, "3(b)", 8, 6, { cause: "conceptual_gap", command_word: "Explain", concepts: physics ? ["Momentum"] : ["Normal distribution"] });
    const blank = p.id === "ip3" || p.id === "ip5";
    add(p.id, 5, "4", 3, blank ? 0 : 3, blank ? { cause: "timed_out" } : undefined, blank);
  }
  return { attempts, losses };
}
export async function listPapers() { await wait(); return { data: scenario === "insights" ? INSIGHT_PAPERS : [], stale: false }; }
export const insightEvidence = async () => ({ data: scenario === "insights" ? insightFixture() : { attempts: [], losses: [] }, stale: scenario === "cached" });
export const paperProgress = async () => new Map();
export const watchLibrary = () => () => {};
// `patterns`: the shape of a real account on 4 Oct 2026 (4 papers, 25 confirmed questions, 9 marks with a cause).
export const analyticsReadiness = async () => scenario === "patterns"
  ? { data: { papers_counted: 4, questions_counted: 25, has_enough_data: true }, stale: false }
  : { data: { papers_counted: 1, questions_counted: 2, has_enough_data: false }, stale: scenario === "cached" };
export const lossByCause = async () => ({ data: scenario === "patterns" ? { incomplete: 6, misread_question: 2, procedural_slip: 1 } : {} });
export const needsCheck = async () => ({ data: { count: 0, papers: 0 } });
export const unreadablePages = async () => ({ data: [] });
export const providerKeyForStudent = (s?: { provider_key?: string | null } | null) => s?.provider_key ?? null;
export const paperTypeLabel = () => "Test paper";
export const paperTypesFor = () => [{ value: "unit_test", label: "Class test" }];
export const PROVIDER_KEYS = ["cambridge", "cbse", "ib"];
export const providerLabel = (key: string) => ({ cambridge: "Cambridge", cbse: "CBSE", ib: "IB Diploma" } as Record<string, string>)[key] ?? key;
export const getProgrammes = async () => [];
export const getStages = async () => [];
export const getSubjectOfferings = async () => [];
export const filterSubjectOfferings = (rows: unknown[]) => rows;
export const defaultLevelFor = () => null;
export const legacyCurriculumForStudent = () => ({ providerKey: "cambridge", programmeKey: "cambridge_as", stageKey: "cambridge_as" });

export const statusKeyForRun = () => null;
export const PAPER_STATUS = {};
export const retryFailedPaper = async () => ({ retry: "started", queued: true, run_id: "run-retry" });
export const searchLibrary = async () => [];
export const AVATAR_PRESETS = [{
  kind: "gradient",
  key: "dreamBloom",
  title: "Dream bloom",
  type: "volumetric",
  c: ["#eee", "#aaa", "#222", "#fff"],
}];
export const avatarRenderFor = () => ({
  kind: "gradient",
  preset: "dreamBloom",
  background: "#ddd",
  color: "#111",
  glyph: null,
});
export const avatarStyleFor = avatarRenderFor;
export const initialFor = (name?: string) => name?.trim().charAt(0).toUpperCase() || "?";

// Paper overview fixture (AXO-135). The pictured Class test: grouped parts plus bare c, d, b.
const mk = (id: string, label: string, awarded: number | null, max: number, over: Record<string, unknown> = {}) => ({
  id, question_label: label, question_text: null, student_answer: "x", answer_block: null,
  marks_awarded: awarded, max_marks: max, marks_source: "teacher_pen", teacher_remark: null,
  extraction_confidence: "confirmed", student_confirmed_at: null, mark_loss_event: [], ...over,
});
export const readPaper = async () => ({
  stale: scenario === "cached", offline: false,
  data: {
    id: "paper-1", type: "unit_test", tier: "tier_1", date_taken: "2026-09-07", subject: null,
    reported_total: 27, stated_maximum: 27, total_awarded: 19, total_available: 27,
    total_basis: "printed", total_partial: false, reconciled: true, paper_page: [], page_unreadable: [],
    question_region: [],
    student_attempt: [
      mk("a1", "1(a)(i)", 2, 2, { question_text: "State what is meant by the term standard deviation and why a small value indicates the readings are close to the mean." }),
      mk("a2", "1(a)(ii)", 1, 2, { question_text: "Calculate the mean of the five readings." }),
      mk("a3", "1(a)(iii)", 2, 3),
      mk("a4", "c", 3, 3),
      mk("a5", "d", 2, 4, { extraction_confidence: "unsure" }),
      mk("a6", "b", null, 2),
      mk("a7", "2(a)", 4, 6, { extraction_confidence: "likely" }),
    ],
  },
});
export const deletePaper = async () => ({ deleted: true, paper_id: "paper-1" });
export const activeAcademicShare = async () => null;
export const academicShareUrl = (token: string) => `https://example.invalid/share#token=${token}`;
export const createAcademicShare = async () => ({ share_id: "s", resource_type: "paper", expires_at: "2099-01-01", token: "t" });
export const presentAcademicShare = async () => "copied";
export const revokeAcademicShare = async () => ({ revoked: true });
