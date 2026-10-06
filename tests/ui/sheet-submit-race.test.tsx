import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { SheetProvider, useSheetControls } from "../../src/ui/components/SheetProvider";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(yes => { resolve = yes; });
  return { promise, resolve };
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function Harness({ pending, started }: { pending: ReturnType<typeof deferred>; started: ReturnType<typeof deferred> }) {
  const { openSheet } = useSheetControls();
  const navigate = useNavigate();
  return <>
    <button onClick={() => openSheet({
      title: "What kind of paper is this?",
      choices: [{ label: "Test / Exam", value: "test" }],
      onChoice: async () => {
        started.resolve();
        await pending.promise;
        navigate("/library/paper-1");
      },
    })}>Send</button>
    <LocationProbe />
  </>;
}

test("paper type choice removes the route-backed overlay before the long submit can navigate", async () => {
  const pending = deferred();
  const started = deferred();
  render(
    <MemoryRouter initialEntries={["/scan"]}>
      <SheetProvider>
        <Routes>
          <Route path="/scan" element={<Harness pending={pending} started={started} />} />
          <Route path="/library/:paperId" element={<><div>Paper destination</div><LocationProbe /></>} />
        </Routes>
      </SheetProvider>
    </MemoryRouter>,
  );

  await userEvent.click(screen.getByText("Send"));
  expect(screen.getByText("What kind of paper is this?")).toBeTruthy();
  expect(screen.getByTestId("location").textContent).toMatch(/\?sheet=/);

  await userEvent.click(screen.getByText("Test / Exam"));
  await act(async () => { await started.promise; });

  // The submit is deliberately still unresolved here. The old implementation
  // kept the sheet mounted and its ?sheet= history entry alive until this
  // promise finished, which allowed destination navigation to strand the
  // overlay and required repeated Back presses.
  await waitFor(() => expect(screen.queryByText("What kind of paper is this?")).toBeNull());
  expect(screen.getByTestId("location").textContent).toBe("/scan");

  await act(async () => pending.resolve());
  expect(await screen.findByText("Paper destination")).toBeTruthy();
  expect(screen.getByTestId("location").textContent).toBe("/library/paper-1");
  expect(screen.queryByText("What kind of paper is this?")).toBeNull();
});
