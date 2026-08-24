import { useParams } from "react-router-dom";
import RouteStub from "../components/RouteStub";

/* Milestone 1 in CLAUDE.md — "question detail screen, hardcoded data, fully
   polished" — and still unbuilt. It exercises the whole design language, so it
   is the one screen that should not be sketched in passing. */
export default function QuestionDetail() {
  const { paperId, qId } = useParams();
  return (
    <RouteStub
      title="Question"
      note="Not yet designed. This is milestone 1 and it exercises the whole design language, so it gets a dedicated pass rather than a sketch inside a port."
      params={{ paperId, qId }}
    />
  );
}
