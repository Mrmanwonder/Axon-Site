import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "./AppProvider";
import { deletePaper } from "./modules";
import { useOptionalSheetControls } from "../components/SheetProvider";
import { useToast } from "../components/ToastProvider";
import { paths } from "../app/paths";

/** The one consequence sheet for deleting a paper, shared by the paper screen and
    the screens a failed paper lands on, so a paper that never read can still go. */
export function usePaperDelete() {
  const { removePaperFromLibrary, refreshLibrary } = useApp();
  const sheets = useOptionalSheetControls();
  const toast = useToast();
  const navigate = useNavigate();
  return useCallback((paperId: string) => {
    if (!sheets) return;
    sheets.openSheet({
      title: "Delete this paper",
      body:
        "This permanently removes the saved paper, its pages, questions, explanations and derived data from Axon. It cannot be restored.",
      items: [
        ["Usage logs stay, anonymised.", "We keep which model ran, how long it took and what it cost. The student, paper and page references are removed."],
      ],
      primary: "Delete paper",
      onConfirm: async () => {
        await deletePaper(paperId);
        removePaperFromLibrary(paperId);
        void refreshLibrary();
        toast("Paper deleted.");
        navigate(paths.library, { replace: true });
      },
    });
  }, [sheets, removePaperFromLibrary, refreshLibrary, toast, navigate]);
}
