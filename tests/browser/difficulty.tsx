import React from "react";
import { createRoot } from "react-dom/client";
import QuestionDifficultyHint from "../../src/ui/components/QuestionDifficultyHint";
import "../../src/ui/styles/app.css";
import "../../src/ui/styles/system.css";
createRoot(document.getElementById("root")!).render(<><h1>Question difficulty test fixture</h1><QuestionDifficultyHint attemptId="attempt" /></>);
