import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("../../src/ui/data/AppProvider", () => ({ useApp: () => ({ profileStale: false }) }));
vi.mock("../../src/ui/shell/TabNav", () => ({ default: () => <nav aria-label="Primary" /> }));
vi.mock("../../src/ui/shell/Header", () => ({ default: ({ title }: { title: string }) => <header>{title}</header> }));
vi.mock("../../src/ui/shell/ThemeToggle", () => ({ default: () => null }));
vi.mock("../../src/ui/scan/ReviewSheet", () => ({ default: () => null }));

import AppShell from "../../src/ui/shell/AppShell";

test("route transitions update the title and move focus to main content", async () => {
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<><h1>Home screen</h1><Link to="/library/paper">Open paper</Link></>} />
          <Route path="library/:paperId" element={<h1>Paper screen</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

  await waitFor(() => expect(document.title).toBe("Home · Axon"));
  expect(document.activeElement).toBe(screen.getByRole("main"));
  await userEvent.click(screen.getByRole("link", { name: "Open paper" }));
  await screen.findByRole("heading", { name: "Paper screen" });
  await waitFor(() => expect(document.title).toBe("Library · Axon"));
  expect(document.activeElement).toBe(screen.getByRole("main"));
});
