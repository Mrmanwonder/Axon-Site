import PressBox from "./PressBox";
import { DeleteSymbol, ShareSymbol } from "./MaterialSymbols";

/**
 * Compact detail-page actions.
 *
 * Share is optional because AXO-89 deliberately does not copy a private
 * /library URL and call that sharing. The button appears only once the
 * capability-backed share flow exists. Delete can ship independently because
 * its server authority and cleanup path already exist.
 */
export default function ResourceActions({
  resourceLabel,
  onShare,
  shareActive = false,
  onDelete,
}: {
  resourceLabel: "paper" | "question";
  onShare?: () => void;
  /** null means the server state could not be established yet. */
  shareActive?: boolean | null;
  onDelete?: () => void;
}) {
  return (
    <div className="resourceactions" aria-label={`${resourceLabel} actions`}>
      {onShare && (
        <PressBox
          as="button"
          type="button"
          className={"resourceaction" + (shareActive === true ? " active" : shareActive === null ? " unknown" : "")}
          aria-label={`Share ${resourceLabel}`}
          aria-pressed={shareActive === null ? "mixed" : shareActive}
          onClick={onShare}
          data-interactive=""
        >
          <ShareSymbol />
        </PressBox>
      )}
      {onDelete && (
        <PressBox
          as="button"
          type="button"
          className="resourceaction danger"
          aria-label={`Delete ${resourceLabel}`}
          onClick={onDelete}
          data-interactive=""
        >
          <DeleteSymbol />
        </PressBox>
      )}
    </div>
  );
}
