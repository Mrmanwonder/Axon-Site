import React from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../../src/ui/components/ToastProvider";
import PaperDifficultyPrompt from "../../src/ui/components/PaperDifficultyPrompt";
import "../../src/ui/styles/app.css";
import "../../src/ui/styles/system.css";
document.documentElement.dataset.theme = new URLSearchParams(location.search).get("theme") ?? "dark";
createRoot(document.getElementById("root")!).render(<ToastProvider><h1>Paper difficulty test fixture</h1><PaperDifficultyPrompt paperId="paper" studentId="student" ready /></ToastProvider>);
