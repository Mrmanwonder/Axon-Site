const scenario = new URLSearchParams(location.search).get("scenario");
const wait = () => new Promise(resolve => setTimeout(resolve, 2000));
export const sb = {
  from: (table: string) => ({
    select: () => ({
      eq: () => table === "student"
        ? { order: async () => ({ data: [{ id: "student", first_name: "Sam", programme_id: null, stage_id: null }] }) }
        : Promise.resolve({ data: [{ subject: "physics" }] }),
      in: async () => ({
        data: table === "student_subject"
          ? [{
              student_id: "student",
              subject: "physics",
              subject_offering_id: null,
              selected_level: null,
              display_name_snapshot: null,
              external_code_snapshot: null,
            }]
          : [],
        error: null,
      }),
    }),
  }),
};
export async function currentSession() { if (scenario === "auth-error") throw new Error("Auth unavailable"); return {}; }
export const currentGuardian = async () => ({ id: "guardian" });
export const studentScopeState = async () => ({ active: false, student_id: null, remaining_seconds: 0 });
export const setStudentScope = async (studentId: string) => ({ active: true, student_id: studentId, remaining_seconds: 1800 });
export const clearStudentScope = async () => true;
export const takeProviderError = () => null;
export const onAuthChange = () => ({ data: { subscription: { unsubscribe() {} } } });
export const readLocal = () => ({ theme: "dark", text_size: "m", reduce_motion: true });
export const loadPrefs = async () => readLocal();
export const savePrefs = async () => readLocal();
export async function readConsentState() { if (scenario === "consent-error") throw new Error("Ledger unavailable"); return {}; }
export const recordConsent = async () => {};
export const withdrawConsent = async () => {};
export const signOut = async () => {};
export async function listPapers() { await wait(); return { data: [], stale: false }; }
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
