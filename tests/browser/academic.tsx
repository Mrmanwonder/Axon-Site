import React from "react";
import { createRoot } from "react-dom/client";
import AcademicText from "../../src/ui/components/AcademicText";
import "../../src/ui/styles/tokens.css";
import "../../src/ui/styles/system.css";
document.documentElement.dataset.theme = new URLSearchParams(location.search).get("theme") === "light" ? "light" : "dark";
const long = String.raw`\mathrm{Var}(X)=\frac{32460}{120}-\left(\frac{642}{120}\right)^2+\frac{32460}{120}-\left(\frac{642}{120}\right)^2+\frac{32460}{120}-\left(\frac{642}{120}\right)^2`;
// A fraction numerator is one unbreakable box; the equality chain above may wrap.
const wide = String.raw`\frac{32460+32460+32460+32460+32460+32460+32460+32460}{120}`;
const style = document.createElement("style");
style.textContent = "body{margin:0;padding:20px;background:var(--bg);color:var(--label);font:17px/1.5 sans-serif}main{max-width:920px;margin:auto}section{min-width:0;padding:16px;margin:16px 0;border:1px solid var(--hairline)}";
document.head.append(style);
createRoot(document.getElementById("root")!).render(<>
  <h1>Academic content fixture</h1>
  <section aria-label="Inline working"><AcademicText text={long} /></section>
  <section aria-label="Display working"><AcademicText text={"\\[" + long + "\\]"} /></section>
  <section aria-label="Wide inline fraction"><AcademicText text={"\\(" + wide + "\\)"} /></section>
  <section aria-label="Short expression"><AcademicText text={"\\(x^2\\)"} /></section>
  <section aria-label="Probability distribution"><AcademicText text={"X | 0 | 1 | 2 | 3\nP | 1/4 | 3/8 | 1/4 | 1/8"} /></section>
  <section aria-label="Wide table"><AcademicText text={"X | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11\nP | 1/12 | 1/12 | 1/12 | 1/12 | 1/12 | 1/12 | 1/12 | 1/12 | 1/12 | 1/12 | 1/12 | 1/12"} /></section>
</>);
