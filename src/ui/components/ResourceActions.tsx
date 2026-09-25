import PressBox from "./PressBox";

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15V3" />
      <path d="m7.5 7.5 4.5-4.5 4.5 4.5" />
      <path d="M5 11.5v6.75A2.75 2.75 0 0 0 7.75 21h8.5A2.75 2.75 0 0 0 19 18.25V11.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 7h15" />
      <path d="M9.25 7V4.75h5.5V7" />
      <path d="m6.5 7 .65 12h9.7l.65-12" />
      <path d="M10 10.5v5" />
      <path d="M14 10.5v5" />
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
  shareActive?: boolean;
  onDelete?: () => void;
}) {
  return (
    <div className="resourceactions" aria-label={`${resourceLabel} actions`}>
      {onShare && (
        <PressBox
          as="button"
          type="button"
          className={"resourceaction" + (shareActive ? " active" : "")}
          aria-label={`Share ${resourceLabel}`}
          aria-pressed={shareActive}
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
