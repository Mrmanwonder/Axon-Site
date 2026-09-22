import { createRoot } from "react-dom/client";
import { DraftAlert, DraftsButton } from "../../src/ui/components/ScanDrafts";

type TestWindow = Window & typeof globalThis & {
  __scanDraftsTest?: {
    opens: number;
    resumes: string[];
    remount: () => void;
    unmount: () => void;
  };
};

export function mountScanDraftsTest(root: HTMLElement, draft: { id: string; pages: number }) {
  const reactRoot = createRoot(root);
  const state = {
    opens: 0,
    resumes: [] as string[],
    unmount: () => reactRoot.unmount(),
    remount: () => {
      reactRoot.render(
        <>
          <DraftsButton count={1} onOpen={() => { state.opens += 1; }} />
          <DraftAlert draft={draft} onResume={(id) => { state.resumes.push(id); }} />
        </>,
      );
    },
  };
  (window as TestWindow).__scanDraftsTest = state;
  state.remount();
}
