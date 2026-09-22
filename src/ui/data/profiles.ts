import { sb } from "./modules";
import type { Student } from "./modules";
import { readThrough } from "../../cache.js";

export async function loadProfiles(guardianId: string): Promise<{ data: Student[]; stale: boolean }> {
  return readThrough(`profiles:${guardianId}`, async () => {
    const { data, error } = await sb.from("student").select("*").eq("guardian_id", guardianId).order("created_at", { ascending: true });
    if (error) throw error;
    return Promise.all((data ?? []).map(async (student: Student) => {
      const result = await sb.from("student_subject").select("subject").eq("student_id", student.id);
      if (result.error) throw result.error;
      return { ...student, subjects: (result.data ?? []).map((row: { subject: string }) => row.subject) };
    }));
  });
}

export function selectedProfile(guardianId: string, students: Student[]) {
  let id: string | null = null;
  try { id = localStorage.getItem(`axon.active_student_id:${guardianId}`); } catch { /* Selection remains available for this session. */ }
  return students.find(student => student.id === id) ?? (students.length === 1 ? students[0] : null);
}
