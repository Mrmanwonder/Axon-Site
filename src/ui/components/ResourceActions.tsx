import PressBox from "./PressBox";
import MaterialSymbol from "./MaterialSymbol";
import "../styles/resource-actions.css";

/**
 * Detail-page commands: callers own the authenticated share/delete flows and
 * consequence sheets. AXO-98 removed the redundant action-time Parent Mode
 * gate; this visual component adds no authority or success claims. Busy state
 * is supplied only by the caller performing the operation. Unknown sharing
 * remains actionable so the existing handler can check authoritative state.
 */
export default function ResourceActions({
  resourceLabel,
  onShare,
  shareActive = false,
  onDelete,
  shareBusy = false,
  deleteBusy = false,
  disabled = false,
}: {
  resourceLabel: "paper" | "question";
  onShare?: () => void;
  /** null means the server state could not be established yet. */
  shareActive?: boolean | null;
  onDelete?: () => void;
  shareBusy?: boolean;
  deleteBusy?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="resourceactions material-actions" role="group" aria-label={`${resourceLabel} actions`}>
      {onShare && (
        <PressBox
          as="button"
          type="button"
          className={"resourceaction material-action" + (shareActive === true ? " active" : shareActive === null ? " unknown" : "")}
          aria-label={`Share ${resourceLabel}`}
          aria-pressed={shareActive === null ? "mixed" : shareActive}
          aria-busy={shareBusy || undefined}
          title={shareActive === null
            ? `Share ${resourceLabel} · Sharing status will be checked when you open this action`
            : shareActive ? `Manage sharing for this ${resourceLabel}` : `Share ${resourceLabel}`}
          disabled={disabled || shareBusy || deleteBusy}
          onClick={onShare}
          data-interactive=""
        >
          <MaterialSymbol name="share" />
          <span className="material-action-label">{shareBusy ? "Sharing…" : shareActive === true ? "Shared" : "Share"}</span>
        </PressBox>
      )}
      {onDelete && (
        <PressBox
          as="button"
          type="button"
          className="resourceaction material-action danger"
          aria-label={`Delete ${resourceLabel}`}
          aria-busy={deleteBusy || undefined}
          title={`Delete ${resourceLabel} · See what will be removed`}
          disabled={disabled || deleteBusy || shareBusy}
          onClick={onDelete}
          data-interactive=""
        >
          <MaterialSymbol name="delete" />
          <span className="material-action-label">{deleteBusy ? "Deleting…" : "Delete"}</span>
        </PressBox>
      )}
    </div>
  );
}
