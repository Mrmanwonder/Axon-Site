import PressBox from "./PressBox";

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 14.5V4" />
      <path d="m8.25 7.75 3.75-3.75 3.75 3.75" />
      <path d="M8.5 10.5H8A2 2 0 0 0 6 12.5v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.75 7h14.5" />
      <path d="M9.5 7V5.25a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75V7" />
      <path d="m6.5 7 .7 11.1a1.9 1.9 0 0 0 1.9 1.9h5.8a1.9 1.9 0 0 0 1.9-1.9L17.5 7" />
      <path d="M10.25 10.75v5.5" />
      <path d="M13.75 10.75v5.5" />
    </svg>
  );
}

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
          <ShareIcon />
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
          <TrashIcon />
        </PressBox>
      )}
    </div>
  );
}
