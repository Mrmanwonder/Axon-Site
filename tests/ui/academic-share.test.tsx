import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SheetProvider } from "../../src/ui/components/SheetProvider";
import { ToastProvider } from "../../src/ui/components/ToastProvider";
import ResourceActions from "../../src/ui/components/ResourceActions";

const fixture = vi.hoisted(() => ({
  active: vi.fn(),
  create: vi.fn(),
  revoke: vi.fn(),
  present: vi.fn(),
}));

vi.mock("../../src/ui/data/modules", () => ({
  activeAcademicShare: fixture.active,
  createAcademicShare: fixture.create,
  revokeAcademicShare: fixture.revoke,
  academicShareUrl: (token: string) => `https://axonstudy.online/share#token=${token}`,
  presentAcademicShare: fixture.present,
}));


import { useAcademicShare } from "../../src/ui/data/useAcademicShare";

function Harness() {
  const { activeShare, shareStatusKnown, requestShare } = useAcademicShare({
    resourceType: "paper",
    resourceId: "paper-1",
    title: "Shared paper from Axon",
  });
  return (
    <ResourceActions
      resourceLabel="paper"
      onShare={requestShare}
      shareActive={shareStatusKnown ? !!activeShare : null}
    />
  );
}

function mount() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <SheetProvider>
          <Harness />
        </SheetProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  fixture.active.mockResolvedValue(null);
  fixture.create.mockResolvedValue({
    share_id: "share-1",
    resource_type: "paper",
    token: "a".repeat(64),
    expires_at: "2026-09-26T07:00:00Z",
  });
  fixture.revoke.mockResolvedValue(true);
  fixture.present.mockResolvedValue("shared");
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
});

test("unknown share status stays visibly unknown and never mints until the server can answer", async () => {
  fixture.active.mockRejectedValue(new Error("offline"));

  mount();

  const trigger = await screen.findByRole("button", { name: "Share paper" });
  await waitFor(() => expect(trigger.getAttribute("aria-pressed")).toBe("mixed"));

  await userEvent.click(trigger);

  await waitFor(() => expect(fixture.active).toHaveBeenCalledTimes(2));
  expect(fixture.create).not.toHaveBeenCalled();
  expect(await screen.findByText("We can’t check whether this paper is already shared right now.")).toBeTruthy();
  expect(trigger.getAttribute("aria-pressed")).toBe("mixed");
});

test("Share uses the authenticated owner session, mints a 24-hour capability, then uses a second explicit Share-link tap", async () => {
  mount();

  const trigger = await screen.findByRole("button", { name: "Share paper" });
  await waitFor(() => expect(trigger.getAttribute("aria-pressed")).toBe("false"));

  await userEvent.click(trigger);

  await waitFor(() => expect(fixture.create).toHaveBeenCalledWith({
    resourceType: "paper",
    resourceId: "paper-1",
    expiresMinutes: 1440,
  }));

  const dialog = await screen.findByRole("dialog", { name: "Share this paper" });
  expect(dialog.textContent).toContain("Anyone with this link can read only this saved paper.");
  expect(dialog.textContent).toContain("expires in 24 hours");
  expect(dialog.textContent).toContain("does not include the student's profile");

  expect(screen.getByRole("button", { name: "Share paper" }).getAttribute("aria-pressed")).toBe("true");

  await userEvent.click(within(dialog).getByRole("button", { name: "Share link" }));

  await waitFor(() => expect(fixture.present).toHaveBeenCalledWith({
    url: "https://axonstudy.online/share#token=" + "a".repeat(64),
    title: "Shared paper from Axon",
    text: "A read-only paper shared from Axon.",
    preferNative: true,
  }));
  expect(await screen.findByText("Share sheet opened.")).toBeTruthy();
});

test("the newly-created link can be revoked from the same share flow", async () => {
  mount();

  await userEvent.click(await screen.findByRole("button", { name: "Share paper" }));
  const dialog = await screen.findByRole("dialog", { name: "Share this paper" });

  await userEvent.click(within(dialog).getByRole("button", { name: "Stop sharing" }));

  await waitFor(() => expect(fixture.revoke).toHaveBeenCalledWith("share-1"));
  expect(await screen.findByText("Sharing stopped.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Share paper" }).getAttribute("aria-pressed")).toBe("false");
});

test("an existing active share can be stopped without creating a replacement", async () => {
  fixture.active.mockResolvedValue({
    share_id: "old-share",
    resource_type: "paper",
    expires_at: "2026-09-25T22:00:00Z",
  });

  mount();

  const trigger = await screen.findByRole("button", { name: "Share paper" });
  await waitFor(() => expect(trigger.getAttribute("aria-pressed")).toBe("true"));
  await userEvent.click(trigger);

  const dialog = await screen.findByRole("dialog", { name: "This paper is already shared" });
  expect(dialog.textContent).toContain("the original link cannot be shown again");

  await userEvent.click(within(dialog).getByRole("button", { name: "Stop sharing" }));

  await waitFor(() => expect(fixture.revoke).toHaveBeenCalledWith("old-share"));
  expect(fixture.create).not.toHaveBeenCalled();
  expect(await screen.findByText("Sharing stopped.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Share paper" }).getAttribute("aria-pressed")).toBe("false");
});

test("failed revocation stays visible and keeps the share marked active", async () => {
  fixture.active.mockResolvedValue({
    share_id: "old-share",
    resource_type: "paper",
    expires_at: "2026-09-25T22:00:00Z",
  });
  fixture.revoke.mockResolvedValue(false);

  mount();

  const trigger = await screen.findByRole("button", { name: "Share paper" });
  await waitFor(() => expect(trigger.getAttribute("aria-pressed")).toBe("true"));
  await userEvent.click(trigger);

  const dialog = await screen.findByRole("dialog", { name: "This paper is already shared" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Stop sharing" }));

  expect(await within(dialog).findByRole("alert")).toBeTruthy();
  expect(within(dialog).getByRole("alert").textContent).toContain("This share could not be stopped.");
  expect(screen.getByRole("button", { name: "Share paper" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("dialog", { name: "This paper is already shared" })).toBeTruthy();
});

test("an existing active share can be explicitly replaced with a fresh link", async () => {
  fixture.active.mockResolvedValue({
    share_id: "old-share",
    resource_type: "paper",
    expires_at: "2026-09-25T22:00:00Z",
  });

  mount();

  const trigger = await screen.findByRole("button", { name: "Share paper" });
  await waitFor(() => expect(trigger.getAttribute("aria-pressed")).toBe("true"));
  await userEvent.click(trigger);

  const existing = await screen.findByRole("dialog", { name: "This paper is already shared" });
  await userEvent.click(within(existing).getByRole("button", { name: "Replace link" }));

  await waitFor(() => expect(fixture.create).toHaveBeenCalledWith({
    resourceType: "paper",
    resourceId: "paper-1",
    expiresMinutes: 1440,
  }));

  const fresh = await screen.findByRole("dialog", { name: "Share this paper" }, { timeout: 3000 });
  expect(fresh.textContent).toContain("The previous link has been stopped and replaced.");
});

test("clipboard write begins before the capability request resolves and copies only the minted URL", async () => {
  let resolveCreation!: (value: object) => void;
  fixture.create.mockImplementation(() => new Promise((resolve) => { resolveCreation = resolve; }));
  const items: Array<Record<string, Promise<Blob>>> = [];
  vi.stubGlobal("ClipboardItem", class {
    constructor(data: Record<string, Promise<Blob>>) { items.push(data); }
  });
  const write = vi.fn(async () => { await items[0]["text/plain"]; });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { write } });
  mount();
  const trigger = await screen.findByRole("button", { name: "Share paper" });
  await waitFor(() => expect(trigger.getAttribute("aria-pressed")).toBe("false"));
  await userEvent.click(trigger);
  expect(write).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).toBeNull();

  resolveCreation({
    share_id: "share-1", resource_type: "paper", token: "b".repeat(64),
    expires_at: "2026-09-26T07:00:00Z",
  });
  const blob = await items[0]["text/plain"];
  expect(blob.type).toBe("text/plain");
  const fresh = await screen.findByRole("dialog", { name: "Share this paper" });
  expect(fresh.textContent).toContain("Share link copied.");
  expect(fixture.present).not.toHaveBeenCalled();
  expect(fixture.present).not.toHaveBeenCalled();
});

test("writeText fallback automatically copies the fresh link when promise-backed write is unavailable", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  mount();
  const trigger = await screen.findByRole("button", { name: "Share paper" });
  await waitFor(() => expect(trigger.getAttribute("aria-pressed")).toBe("false"));
  await userEvent.click(trigger);
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(
    "https://axonstudy.online/share#token=" + "a".repeat(64),
  ));
  const fresh = await screen.findByRole("dialog", { name: "Share this paper" });
  expect(fresh.textContent).toContain("Share link copied.");
});

test("denied automatic copy retains an explicit action without claiming success", async () => {
  const writeText = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  mount();
  const trigger = await screen.findByRole("button", { name: "Share paper" });
  await waitFor(() => expect(trigger.getAttribute("aria-pressed")).toBe("false"));
  await userEvent.click(trigger);
  const fresh = await screen.findByRole("dialog", { name: "Share this paper" });
  expect(fresh.textContent).toContain("could not be copied automatically");
  expect(within(fresh).getByRole("button", { name: "Copy link" })).toBeTruthy();
  expect(screen.queryByText("Share link copied.")).toBeNull();
  await userEvent.click(within(fresh).getByRole("button", { name: "Copy link" }));
  await waitFor(() => expect(fixture.present).toHaveBeenCalledTimes(1));
});

test("a failed mint never writes an old or placeholder link", async () => {
  fixture.create.mockRejectedValue(new Error("Mint failed"));
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  mount();
  const trigger = await screen.findByRole("button", { name: "Share paper" });
  await waitFor(() => expect(trigger.getAttribute("aria-pressed")).toBe("false"));
  await userEvent.click(trigger);
  expect(await screen.findByText("Mint failed")).toBeTruthy();
  expect(writeText).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});
