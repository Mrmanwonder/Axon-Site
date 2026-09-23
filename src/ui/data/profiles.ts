import { sb } from "./modules";
import type { Student, SubjectSelection } from "./modules";
import { readThrough } from "../../cache.js";

type ProgrammeRow = { id: string; provider_id: string; key: string; label: string };
type ProviderRow = { id: string; key: string; name: string };
type StageRow = { id: string; key: string; label: string; school_year_label: string | null };
type SubjectRow = {
  student_id: string;
  subject: string;
  subject_offering_id: string | null;
  selected_level: "SL" | "HL" | null;
  display_name_snapshot: string | null;
  external_code_snapshot: string | null;
};

export async function loadProfiles(guardianId: string): Promise<{ data: Student[]; stale: boolean }> {
  return readThrough(`profiles:${guardianId}`, async () => {
    const { data, error } = await sb.from("student")
      .select("*")
      .eq("guardian_id", guardianId)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const students = (data ?? []) as Student[];
    if (!students.length) return [];

    const ids = students.map(student => student.id);
    const subjectResult = await sb.from("student_subject")
      .select("student_id,subject,subject_offering_id,selected_level,display_name_snapshot,external_code_snapshot")
      .in("student_id", ids);
    if (subjectResult.error) throw subjectResult.error;
    const subjectRows = (subjectResult.data ?? []) as SubjectRow[];

    const programmeIds = [...new Set(students.map(s => s.programme_id).filter(Boolean))] as string[];
    const stageIds = [...new Set(students.map(s => s.stage_id).filter(Boolean))] as string[];

    const [programmeResult, stageResult] = await Promise.all([
      programmeIds.length
        ? sb.from("curriculum_programme").select("id,provider_id,key,label").in("id", programmeIds)
        : Promise.resolve({ data: [], error: null }),
      stageIds.length
        ? sb.from("curriculum_stage").select("id,key,label,school_year_label").in("id", stageIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (programmeResult.error) throw programmeResult.error;
    if (stageResult.error) throw stageResult.error;

    const programmes = (programmeResult.data ?? []) as ProgrammeRow[];
    const stages = (stageResult.data ?? []) as StageRow[];
    const providerIds = [...new Set(programmes.map(row => row.provider_id))];
    const providerResult = providerIds.length
      ? await sb.from("curriculum_provider").select("id,key,name").in("id", providerIds)
      : { data: [], error: null };
    if (providerResult.error) throw providerResult.error;

    const providerById = new Map(((providerResult.data ?? []) as ProviderRow[]).map(row => [row.id, row]));
    const programmeById = new Map(programmes.map(row => [row.id, row]));
    const stageById = new Map(stages.map(row => [row.id, row]));

    return students.map((student): Student => {
      const programme = student.programme_id ? programmeById.get(student.programme_id) : undefined;
      const provider = programme ? providerById.get(programme.provider_id) : undefined;
      const stage = student.stage_id ? stageById.get(student.stage_id) : undefined;
      const rows = subjectRows.filter(row => row.student_id === student.id);
      const selections: SubjectSelection[] = rows
        .filter(row => row.subject_offering_id)
        .map(row => ({
          offering_id: row.subject_offering_id!,
          subject: row.display_name_snapshot ?? row.subject,
          external_code: row.external_code_snapshot,
          level: row.selected_level,
        }));

      return {
        ...student,
        provider_key: provider?.key ?? null,
        provider_label: provider?.name ?? null,
        programme_key: programme?.key ?? null,
        programme_label: programme?.label ?? null,
        stage_key: stage?.key ?? null,
        stage_label: stage?.label ?? null,
        school_year_label: stage?.school_year_label ?? null,
        subjects: rows.map(row => row.display_name_snapshot ?? row.subject),
        subject_selections: selections,
      };
    });
  });
}

export function selectedProfile(guardianId: string, students: Student[]) {
  let id: string | null = null;
  try { id = localStorage.getItem(`axon.active_student_id:${guardianId}`); } catch { /* Selection remains available for this session. */ }
  return students.find(student => student.id === id) ?? (students.length === 1 ? students[0] : null);
}
