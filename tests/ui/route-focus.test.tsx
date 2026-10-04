import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Link, createMemoryRouter, RouterProvider } from "react-router-dom";

vi.mock("../../src/ui/data/AppProvider", () => ({ useApp: () => ({ profileStale: false }) }));
vi.mock("../../src/ui/shell/TabNav", () => ({ default: () => <nav aria-label="Primary" /> }));
vi.mock("../../src/ui/shell/Header", () => ({ default: ({ title }: { title: string }) => <header>{title}</header> }));
vi.mock("../../src/ui/shell/ThemeToggle", () => ({ default: () => null }));
vi.mock("../../src/ui/scan/ReviewSheet", () => ({ default: () => null }));

import AppShell from "../../src/ui/shell/AppShell";

test("a slow route shows its destination skeleton immediately instead of leaving the previous page idle", async () => {
  let complete!: () => void;
  const pending = new Promise<void>(resolve => { complete = resolve; });
  const router = createMemoryRouter([{ element: <AppShell />, children: [
    { index: true, element: <><h1>Home screen</h1><Link to="/library">Library</Link></> },
    { path: "library", lazy: async () => { await pending; return { Component: () => <h1>Loaded library</h1> }; } },
  ] }]);
  render(<RouterProvider router={router} />);
  await userEvent.click(screen.getByRole("link", { name: "Library" }));
  expect(screen.getByRole("status", { name: "Opening Library" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Home screen" })).toBeNull();
  await act(async () => complete());
  expect(await screen.findByRole("heading", { name: "Loaded library" })).toBeTruthy();
});

test("route transitions update the title and move focus to main content", async () => {
  const router = createMemoryRouter([{ element: <AppShell />, children: [
    { index: true, element: <><h1>Home screen</h1><Link to="/library/paper">Open paper</Link></> },
    { path: "library/:paperId", element: <h1>Paper screen</h1> },
  ] }]);
  render(<RouterProvider router={router} />);

  await waitFor(() => expect(document.title).toBe("Home · Axon"));
  expect(document.activeElement).toBe(screen.getByRole("main"));
  await userEvent.click(screen.getByRole("link", { name: "Open paper" }));
  await screen.findByRole("heading", { name: "Paper screen" });
  await waitFor(() => expect(document.title).toBe("Library · Axon"));
  expect(document.activeElement).toBe(screen.getByRole("main"));
});
