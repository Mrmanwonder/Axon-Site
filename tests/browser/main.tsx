import React from "react";
import { createRoot } from "react-dom/client";
import { SheetProvider, useSheetControls } from "../../src/ui/components/SheetProvider";
import { ToastProvider } from "../../src/ui/components/ToastProvider";
import { createMemoryRouter, MemoryRouter, RouterProvider, useNavigate, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "../../src/ui/data/AppProvider";
import Library from "../../src/ui/pages/Library";
import Home from "../../src/ui/pages/Home";
import Insights from "../../src/ui/pages/Insights";
import SyllabusDetail from "../../src/ui/pages/SyllabusDetail";
import AppRouteErrorBoundary from "../../src/ui/pages/AppRouteErrorBoundary";
import NotFound from "../../src/ui/pages/NotFound";
import TabNav from "../../src/ui/shell/TabNav";
import Disclose from "../../src/ui/components/Disclose";
import AnswerBlockView from "../../src/ui/components/AnswerBlock";
import ReviewSheet from "../../src/ui/scan/ReviewSheet";
import PaperOverview from "../../src/ui/pages/PaperOverview";
import { Route, Routes } from "react-router-dom";
import Scan from "../../src/ui/pages/Scan";
import { ExamSettings } from "../../src/ui/components/ExamPlan";
const params = new URLSearchParams(location.search);
// Views that judge layout load the app's real stylesheets; the behaviour-only views stay unstyled.
if (params.get("view") === "audit-motion" || params.get("view") === "paper" || params.get("view") === "scan-screen" || params.get("scenario") === "insights" || params.get("scenario") === "insights-early" || params.get("scenario")?.startsWith("exams") || params.get("styled") === "1") {
  await Promise.all([
    import("../../src/ui/styles/app.css"), import("../../src/ui/styles/system.css"),
    import("../../src/ui/styles/shell.css"), import("../../src/ui/styles/performance.css"),
  ]);
}
function DialogDemo() {
  const { openSheet } = useSheetControls();
  const navigate = useNavigate(); const location = useLocation();
  return <><h1>Dialog test</h1><p>{location.pathname}</p><button onClick={() => openSheet({ title: "Enter your answer", input: { id: "answer", label: "Your answer" }, primary: "Save answer", onConfirm: async () => { await new Promise(resolve => setTimeout(resolve, 400)); navigate("/saved"); } })}>Open dialog</button><button>Background control</button></>;
}
function NavDemo() {
  const location = useLocation();
  return <><p data-testid="route">{location.pathname}</p><TabNav /></>;
}
function AuditMotionDemo() {
  return <div style={{ maxWidth: 720, width: "100%" }}><Disclose label="Show reasoning">
    {Array.from({ length: 8 }, (_, i) => <p key={i}>The explanation follows the student's working, checking each transformation against the marked source. A long sentence wraps as the viewport and text size change, and every line must remain visible inside the open reasoning panel.</p>)}
  </Disclose></div>;
}
function AnswerDemo() {
  const [picked, setPicked] = React.useState<number | null>(null);
  return <><AnswerBlockView
    block={{ source_space: "page_pixels_v1", notation_profile: "math", raw_text: "x + 1", lines: [{ role: "working", segments: [{ type: "prose", text: "x + 1", annotations: [], bbox: { page: 2, x: 0, y: 0, w: 10, h: 10 } }] }] }}
    rawText="x + 1" recognition={true} onPick={segment => setPicked(segment?.bbox?.page ?? null)}
  /><output aria-label="Selected source page">{picked ?? "none"}</output></>;
}

function StudentScopeHouseholdDemo() {
  const { gate, student, selectStudent, signOutNow } = useApp();
  return <section aria-label="Student scope household test">
    <p data-testid="household-gate">{gate}</p>
    <p data-testid="household-student">{student?.id ?? "none"}</p>
    <button type="button" onClick={() => void selectStudent("student-a").catch(() => {})}>Switch A</button>
    <button type="button" onClick={() => void selectStudent("student-b").catch(() => {})}>Switch B</button>
    <button type="button" onClick={() => void signOutNow()}>Sign out household</button>
  </section>;
}

function Boom(): never { throw new Error("Intentional route failure"); }
function Screen() {
  const { gate, consentResource } = useApp();
  if (gate !== "ready") return <p role="status">{gate}</p>;
  return <><p role="status">Consent {consentResource.state}</p>{params.get("view") === "home" ? <Home /> : params.get("view") === "exam-settings" ? <ExamSettings /> : params.get("view") === "insights"
    ? <Routes><Route path="/insights/syllabus/:offeringId" element={<SyllabusDetail />} /><Route path="*" element={<Insights />} /></Routes>
    : <Library />}</>;
}
const root = createRoot(document.getElementById("root")!);
if (params.get("view") === "scan-screen") {
  await Promise.all([import("../../src/ui/styles/tokens.css"), import("../../src/ui/styles/scanner.css")]);
  document.documentElement.dataset.theme = params.get("theme") === "light" ? "light" : "dark";
  const style = document.createElement("style");
  // No real camera here: a flat, lit surface stands in for the picture.
  style.textContent = "#scanVideo{background:radial-gradient(120% 90% at 50% 40%,#3a3d34,#17181a)!important}"
    + "body{margin:0;background:var(--bg)}[data-screen=scan]{position:fixed;inset:0}";
  document.head.append(style);
  root.render(<MemoryRouter initialEntries={["/scan"]}><ToastProvider><AppProvider><SheetProvider>
    <main className="view on" data-screen="scan"><Scan /></main></SheetProvider></AppProvider></ToastProvider></MemoryRouter>);
} else if (params.get("view") === "nav") {
  const router = createMemoryRouter([{ path: "*", element: <ToastProvider><AppProvider><SheetProvider><NavDemo /></SheetProvider></AppProvider></ToastProvider> }], {
    initialEntries: [params.get("route") ?? "/"],
  });
  root.render(<RouterProvider router={router} />);
} else if (params.get("view") === "route-errors") {
  const router = createMemoryRouter([{
    path: "/", errorElement: <AppRouteErrorBoundary />, children: [
      { path: "boom", element: <Boom /> },
      { path: "*", element: <NotFound /> },
    ],
  }], { initialEntries: [params.get("route") ?? "/missing"] });
  root.render(<RouterProvider router={router} />);
} else {
  root.render(<React.StrictMode><MemoryRouter initialEntries={[params.get("route") ?? "/"]}><ToastProvider><AppProvider><SheetProvider><main>{params.get("view") === "dialog" ? <DialogDemo /> : params.get("view") === "nav" ? <NavDemo /> : params.get("view") === "audit-motion" ? <AuditMotionDemo /> : params.get("view") === "answer" ? <AnswerDemo /> : params.get("view") === "paper" ? <Routes><Route path="/library/:paperId" element={<PaperOverview />} /></Routes> : params.get("view") === "review" ? <ReviewSheet /> : params.get("view") === "student-scope-household" ? <StudentScopeHouseholdDemo /> : <Screen />}</main></SheetProvider></AppProvider></ToastProvider></MemoryRouter></React.StrictMode>);
}
