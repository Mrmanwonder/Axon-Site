import { useParams } from "react-router-dom";
import RouteStub from "../components/RouteStub";

/* A real location rather than a sheet: it has its own header, its own scroll
   and a save action, and it must survive a reload mid-review. */
export default function PaperReview() {
  const { draftId } = useParams();
  return (
    <RouteStub
      title="Review"
      note="Fullscreen paper review. Everything here stays editable, even after it is auto-filled. Screen content is ported in the next pass."
      params={{ draftId }}
    />
  );
}
