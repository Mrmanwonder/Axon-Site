const scenario = new URLSearchParams(location.search).get("scenario");
const wait = () => new Promise(resolve => setTimeout(resolve, 2000));
const scopeHousehold = scenario === "student-scope-household";
const scopeStudents = [
  { id: "student-a", first_name: "Alpha", guardian_id: "guardian", programme_id: null, stage_id: null, class_level: 11 },
  { id: "student-b", first_name: "Beta", guardian_id: "guardian", programme_id: null, stage_id: null, class_level: 12 },
];
const testScopeKey = "axon.e2e.student-scope.active";
const testSignedOutKey = "axon.e2e.student-scope.signed-out";
const testTraceKey = "axon.e2e.student-scope.trace";

function trace(event: string) {
  if (!scopeHousehold) return;
  const previous = JSON.parse(localStorage.getItem(testTraceKey) ?? "[]") as string[];
  previous.push(event);
  localStorage.setItem(testTraceKey, JSON.stringify(previous));
}

function activeTestScope() {
  return scopeHousehold ? localStorage.getItem(testScopeKey) : null;
}
export const sb = {
  from: (table: string) => ({
    select: () => ({
      eq: () => table === "student"
        ? { order: async () => ({
            data: scopeHousehold
              ? scopeStudents
              : [{ id: "student", first_name: "Sam", programme_id: null, stage_id: null }],
          }) }
        : Promise.resolve({ data: [{ subject: "physics" }] }),
      in: async () => ({
        data: table === "student_subject"
          ? (scopeHousehold
              ? scopeStudents.map(student => ({
                  student_id: student.id,
                  subject: student.id === "student-a" ? "Physics" : "Chemistry",
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
  if (scopeHousehold && localStorage.getItem(testSignedOutKey) === "1") return null;
  return {};
}
export const currentGuardian = async () => ({
  id: "guardian",
  contact: scopeHousehold ? "parent@example.test" : undefined,
});
export const studentScopeState = async () => {
  const studentId = activeTestScope();
  trace(`scope-state:${studentId ?? "none"}`);
  return studentId
    ? { active: true, student_id: studentId, remaining_seconds: 1200 }
    : { active: false, student_id: null, remaining_seconds: 0 };
};
export const setStudentScope = async (studentId: string) => {
  if (scopeHousehold) {
    localStorage.setItem(testScopeKey, studentId);
    trace(`scope-set:${studentId}`);
  }
  return { active: true, student_id: studentId, remaining_seconds: 1800 };
};
export const clearStudentScope = async () => {
  if (scopeHousehold) {
    trace(`scope-clear:${activeTestScope() ?? "none"}`);
    localStorage.removeItem(testScopeKey);
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
  if (scopeHousehold) {
    await clearStudentScope();
    localStorage.setItem(testSignedOutKey, "1");
    trace("sign-out");
  }
};
export const parentModeState = async () => {
  trace("parent-mode:fresh");
  return { fresh: true, amrPresent: true, remainingSeconds: 300 };
};
export const sendParentCode = async () => ({ sent: true });
export const unlockWithCode = async () => ({ outcome: "unlocked" as const });
export async function listPapers(studentId?: string) {
  if (!scopeHousehold) {
    await wait();
    return { data: [], stale: false };
  }
  const active = activeTestScope();
  trace(`paper-read:${studentId ?? "none"}:scope=${active ?? "none"}`);
  if (!studentId || studentId !== active) throw new Error("student scope mismatch");
  return {
    data: [{
      id: studentId === "student-a" ? "paper-a" : "paper-b",
      student_id: studentId,
      type: "unit_test",
      tier: "tier_1",
      date_taken: "2026-09-27",
      subject: studentId === "student-a" ? "Physics" : "Chemistry",
    }],
    stale: false,
  };
}
export const paperProgress = async () => new Map();
export const watchLibrary = () => () => {};
export const analyticsReadiness = async () => ({ data: { papers_counted: 1, questions_counted: 2, has_enough_data: false }, stale: scenario === "cached" });
export const lossByCause = async () => ({ data: {} });
export const needsCheck = async () => ({ data: { count: 0, papers: 0 } });
export const unreadablePages = async () => ({ data: [] });
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
