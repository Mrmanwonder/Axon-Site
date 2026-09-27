import React from "react";
import { createRoot } from "react-dom/client";
import { SheetProvider, useSheetControls } from "../../src/ui/components/SheetProvider";
import { ToastProvider } from "../../src/ui/components/ToastProvider";
import { createMemoryRouter, MemoryRouter, RouterProvider, useNavigate, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "../../src/ui/data/AppProvider";
import Library from "../../src/ui/pages/Library";
import Home from "../../src/ui/pages/Home";
import Insights from "../../src/ui/pages/Insights";
import AppRouteErrorBoundary from "../../src/ui/pages/AppRouteErrorBoundary";
import NotFound from "../../src/ui/pages/NotFound";
import TabNav from "../../src/ui/shell/TabNav";
import AnswerBlockView from "../../src/ui/components/AnswerBlock";
import ReviewSheet from "../../src/ui/scan/ReviewSheet";
import ProfileChooser from "../../src/ui/components/ProfileChooser";
const params = new URLSearchParams(location.search);
function DialogDemo() {
  const { openSheet } = useSheetControls();
  const navigate = useNavigate(); const location = useLocation();
  return <><h1>Dialog test</h1><p>{location.pathname}</p><button onClick={() => openSheet({ title: "Enter your answer", input: { id: "answer", label: "Your answer" }, primary: "Save answer", onConfirm: async () => { await new Promise(resolve => setTimeout(resolve, 400)); navigate("/saved"); } })}>Open dialog</button><button>Background control</button></>;
}
function NavDemo() {
  const location = useLocation();
  return <><p data-testid="route">{location.pathname}</p><TabNav /></>;
}
function AnswerDemo() {
  return <AnswerBlockView
    block={{ notation_profile: "math", raw_text: "x + 1", lines: [{ role: "working", segments: [{ type: "prose", text: "x + 1", annotations: [], bbox: { x: 0, y: 0, w: 10, h: 10 } }] }] }}
    rawText="x + 1" recognition={true}
  />;
}
function Boom(): never { throw new Error("Intentional route failure"); }

function StudentScopeHouseholdDemo() {
  const { gate, student, papersResource, signOutNow } = useApp();

  if (gate === "loading") return <p role="status">scope-loading</p>;
  if (gate === "boot_error") return <p role="status">scope-boot-error</p>;
  if (gate === "onboarding") {
    return <>
      <p role="status">signed-out</p>
      <button type="button" onClick={() => {
        localStorage.removeItem("axon.e2e.student-scope.signed-out");
        location.reload();
      }}>Sign in again</button>
    </>;
  }
  if (gate === "choose_profile") {
    return <>
      <p role="status">choose-profile</p>
      <ProfileChooser />
    </>;
  }

  return <>
    <p data-testid="active-student">{student?.id ?? "none"}</p>
    <p data-testid="paper-state">
      {papersResource.state}:{papersResource.data?.map(paper => paper.id).join(",") ?? "none"}
    </p>
    <ProfileChooser />
    <button type="button" onClick={() => void signOutNow()}>Sign out test</button>
  </>;
}

function Screen() {
  const { gate, consentResource } = useApp();
  if (gate !== "ready") return <p role="status">{gate}</p>;
  return <><p role="status">Consent {consentResource.state}</p>{params.get("view") === "home" ? <Home /> : params.get("view") === "insights" ? <Insights /> : <Library />}</>;
}
const root = createRoot(document.getElementById("root")!);
if (params.get("view") === "route-errors") {
  const router = createMemoryRouter([{
    path: "/", errorElement: <AppRouteErrorBoundary />, children: [
      { path: "boom", element: <Boom /> },
      { path: "*", element: <NotFound /> },
    ],
  }], { initialEntries: [params.get("route") ?? "/missing"] });
  root.render(<RouterProvider router={router} />);
} else {
  root.render(<React.StrictMode><MemoryRouter initialEntries={[params.get("route") ?? "/"]}><ToastProvider><AppProvider><SheetProvider><main>{params.get("view") === "dialog" ? <DialogDemo /> : params.get("view") === "nav" ? <NavDemo /> : params.get("view") === "answer" ? <AnswerDemo /> : params.get("view") === "review" ? <ReviewSheet /> : params.get("view") === "student-scope" ? <StudentScopeHouseholdDemo /> : <Screen />}</main></SheetProvider></AppProvider></ToastProvider></MemoryRouter></React.StrictMode>);
}
