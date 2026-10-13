import { describe, expect, it } from "vitest";
import { layerNote } from "../../src/ui/onboarding/chrome";
import { purposeNote } from "../../src/notice.js";

// AXO-268: the long weekly-summary note is shown as its opening clause plus a
// disclosure. Nothing is dropped: lead and detail together are the stored words.
describe("layerNote", () => {
  it("splits the weekly summary note without losing a word", () => {
    const note = purposeNote("weekly_parent_digest", "en");
    const layered = layerNote(note)!;
    expect(layered.lead).toBe("One email a week, to you.");
    expect(layered.detail.startsWith("Your child's first name")).toBe(true);
    expect(`${layered.lead.slice(0, -1)}: ${layered.detail[0].toLowerCase()}${layered.detail.slice(1)}`).toBe(note);
  });

  it("leaves short notes alone", () => {
    expect(layerNote(purposeNote("store_papers", "en"))).toBeNull();
    expect(layerNote(purposeNote("improve_extraction", "en"))).toBeNull();
  });
});
