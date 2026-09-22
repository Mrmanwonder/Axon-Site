import { useApp } from "../data/AppProvider";
import { useParentMode } from "../data/useParentMode";
import { useNavigate } from "react-router-dom";
export default function ProfileChooser() {
  const { profiles, student, selectStudent } = useApp();
  const { guard } = useParentMode();
  const navigate = useNavigate();
  return <section aria-label="Student profile"><h2>Choose a student</h2><div className="list">
    {profiles.map(profile => <button key={profile.id} className="srow noicon" type="button" aria-pressed={profile.id === student?.id}
      onClick={() => guard(async () => { await selectStudent(profile.id); navigate("/"); })}>{profile.first_name}</button>)}
  </div></section>;
}
