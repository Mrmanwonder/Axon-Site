import "../../src/ui/styles/app.css";
import "../../src/ui/styles/system.css";
import "../../src/ui/styles/shell.css";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../src/ui/components/ToastProvider";
import { SheetProvider } from "../../src/ui/components/SheetProvider";
import { AppProvider } from "../../src/ui/data/AppProvider";
import PaperOverview from "../../src/ui/pages/PaperOverview";
import QuestionDetail from "../../src/ui/pages/QuestionDetail";
import ReviewSheet from "../../src/ui/scan/ReviewSheet";
const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get("theme") ?? "dark";
document.documentElement.dataset.motion = "reduce";
const path = params.get("view") === "question" ? "/library/fixture/a" : "/library/fixture";
createRoot(document.getElementById("root")!).render(<MemoryRouter initialEntries={[path]}><ToastProvider><AppProvider><SheetProvider><main>
  {params.get("view") === "review" ? <ReviewSheet /> : <Routes><Route path="/library/:paperId" element={<PaperOverview />} /><Route path="/library/:paperId/:qId" element={<QuestionDetail />} /></Routes>}
</main></SheetProvider></AppProvider></ToastProvider></MemoryRouter>);
