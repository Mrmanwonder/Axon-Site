import { useParams } from "react-router-dom";
import RouteStub from "../components/RouteStub";

/* This screen does not exist in the prototype. The route resolves and carries
   its param so deep links and history are testable, but no design is invented
   here — see the port report. */
export default function PaperOverview() {
  const { paperId } = useParams();
  return (
    <RouteStub
      title="Paper"
      note="Not yet designed. The prototype has no paper overview screen, so this route resolves and holds its place without inventing one."
      params={{ paperId }}
    />
  );
}
