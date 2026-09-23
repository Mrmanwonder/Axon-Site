import { sb } from "./modules";
import type { Student, SubjectSelection } from "./modules";
import { readThrough } from "../../cache.js";

export async function loadProfiles(guardianId: string): Promise<{ data: Student[]; stale: boolean }> {
  return readThrough(`profiles:${guardianId}:curriculum-v2`, async () => {
    const { data, error } = await sb
      .from("student")
      .select("*")
      .eq("guardian_id", guardianId)
      .order("created_at", { ascending: true });
    if (error) throw error;

    return Promise.all((data ?? []).map(async (student: Student) => {
      const [subjectResult, programmeResult, stageResult] = await Promise.all([
        sb.from("student_subject")
          .select("subject,subject_offering_id,selected_level,display_name_snapshot,external_code_snapshot")
          .eq("student_id", student.id),
        student.programme_id
          ? sb.from("curriculum_programme").select("key,label,provider_id").eq("id", student.programme_id).single()
          : Promise.resolve({ data: null, error: null }),
        student.stage_id
          ? sb.from("curriculum_stage").select("key,label,school_year_label").eq("id", student.stage_id).single()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (subjectResult.error) throw subjectResult.error;
      if (programmeResult.error) throw programmeResult.error;
      if (stageResult.error) throw stageResult.error;

      let provider: { key: string; name: string } | null = null;
      if (programmeResult.data?.provider_id) {
        const providerResult = await sb.from("curriculum_provider")
          .select("key,name")
          .eq("id", programmeResult.data.provider_id)
          .single();
        if (providerResult.error) throw providerResult.error;
        provider = providerResult.data;
      }

      const subjectSelections: SubjectSelection[] = (subjectResult.data ?? []).map((row: {
        subject: string;
        subject_offering_id: string | null;
        selected_level: "SL" | "HL" | null;
        display_name_snapshot: string | null;
        external_code_snapshot: string | null;
      }) => ({
        offering_id: row.subject_offering_id ?? "",
        subject: row.display_name_snapshot ?? row.subject,
        external_code: row.external_code_snapshot,
        level: row.selected_level,
      })).sort((a, b) => a.subject.localeCompare(b.subject));

      return {
        ...student,
        programme_key: programmeResult.data?.key ?? null,
        programme_label: programmeResult.data?.label ?? null,
        provider_key: provider?.key ?? null,
        provider_label: provider?.name ?? null,
        stage_key: stageResult.data?.key ?? null,
        stage_label: stageResult.data?.label ?? null,
        school_year_label: stageResult.data?.school_year_label ?? null,
        subjects: subjectSelections.map((row) => row.subject),
        subjectSelections,
      };
    }));
  });
}

export function selectedProfile(guardianId: string, students: Student[]) {
  let id: string | null = null;
  try { id = localStorage.getItem(`axon.active_student_id:${guardianId}`); } catch { /* Selection remains available for this session. */ }
  return students.find(student => student.id === id) ?? (students.length === 1 ? students[0] : null);
}
