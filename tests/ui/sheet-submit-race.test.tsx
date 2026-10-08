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

// The paper-type sheet that first needed this is gone (council D7); the
// behaviour is now opt-in for any choice that navigates when it finishes.
function Harness({ pending, started }: { pending: ReturnType<typeof deferred>; started: ReturnType<typeof deferred> }) {
  const { openSheet } = useSheetControls();
  const navigate = useNavigate();
  return <>
    <button onClick={() => openSheet({
      title: "Move this paper",
      choices: [{ label: "Move it", value: "move" }],
      dismissBeforeChoice: true,
      onChoice: async () => {
        started.resolve();
        await pending.promise;
        navigate("/library/paper-1");
      },
    })}>Send</button>
    <LocationProbe />
  </>;
}

test("a long choice that navigates removes the route-backed overlay first", async () => {
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
  expect(screen.getByText("Move this paper")).toBeTruthy();
  expect(screen.getByTestId("location").textContent).toMatch(/\?sheet=/);

  await userEvent.click(screen.getByText("Move it"));
  await act(async () => { await started.promise; });

  await waitFor(() => expect(screen.queryByText("Move this paper")).toBeNull());
  expect(screen.getByTestId("location").textContent).toBe("/scan");

  await act(async () => pending.resolve());
  expect(await screen.findByText("Paper destination")).toBeTruthy();
  expect(screen.getByTestId("location").textContent).toBe("/library/paper-1");
  expect(screen.queryByText("Move this paper")).toBeNull();
});
