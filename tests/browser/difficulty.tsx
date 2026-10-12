import React from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../../src/ui/components/ToastProvider";
import PaperDifficultyPrompt from "../../src/ui/components/PaperDifficultyPrompt";
import QuestionDifficultyHint from "../../src/ui/components/QuestionDifficultyHint";
import "../../src/ui/styles/app.css";
import "../../src/ui/styles/system.css";

// One fixture page for both difficulty features: ?view=question renders the
// question hint (AXO-191); otherwise the paper prompt (AXO-190).
const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get("theme") ?? "dark";
const root = createRoot(document.getElementById("root")!);
if (params.get("view") === "question") {
  root.render(<><h1>Question difficulty test fixture</h1><QuestionDifficultyHint attemptId="attempt" /></>);
} else {
  root.render(<ToastProvider><h1>Paper difficulty test fixture</h1><PaperDifficultyPrompt paperId="paper" studentId="student" ready /></ToastProvider>);
}
