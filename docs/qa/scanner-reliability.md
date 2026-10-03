# Scanner acceptance and reproducible evidence

The scanner implementation and a synthetic browser pass do not establish physical
camera reliability. AXO-11 stays open until AXO-45, AXO-46 and AXO-47 contain actual
hardware evidence, and AXO-48 reviews the aggregate results. AXO-67 additionally
requires a representative device performance trace. AXO-70 requires a real run
from capture through processing, review and commit.

## Automated checks

```sh
npm test
npx vitest run tests/ui/scanner-hardware.test.tsx tests/ui/scan-lifecycle.test.tsx
npm run build
npx playwright test tests/e2e/camera.spec.ts tests/e2e/scanner-viewfinder.spec.ts
```

The hardware fault tests use the production capture controller with only browser
and hardware boundaries stubbed. They cover capability/control hangs, playback
failure, permission request races, stop/restart ownership, worker transfer failure,
native still timeout/throw/decode fallback, and subsequent manual shots. They do
not emulate sensor optics, camera drivers or iOS background suspension.

The Chromium canvas-stream fixture runs the actual worker, detector (scanic ML),
whole-page lock, quality gate and Auto capture. It checks a held synthetic page and an empty desk.
Its latency is a cloud-rendering measurement, not an Android/iPhone benchmark.
The preview must remain untransformed (AXO-90 removed display stabilisation).

## Physical protocol

Use low-, mid- and high-range Android Chrome plus iPhone Safari. Record the exact
model, OS, browser version and deployed commit for every set. Do not combine builds
or devices into one file. Use non-personal sample pages and keep diagnostic images
local unless explicitly selected for issue evidence.

For each scenario below, run 20 trials, observing for at least 10 seconds each.
Start the trial clock when the camera is live and the intended scene is presented.
Record first *confirmed live* lock and a correctly framed, accepted Auto capture.
Continue observing after capture to detect unwanted duplicate captures. A manual
shutter must never count as an Auto success. If the scene is not capture-ready,
set expectation to `lock-only`; if it contains no document, use `reject`.

| Packet | Scenarios / evidence |
| --- | --- |
| AXO-45 | Small/far (`lock-only`), close, portrait, landscape, rotation/skew on each device class |
| AXO-46 | Partial/off-frame, rapid motion, dropped frames, autofocus breathing, low light, hand shadow, phone shadow, glare, clipped highlights, false rectangular object, screen, textured background, brief detector miss |
| AXO-47 | Background/foreground, lock/unlock, route away/back, pinch zoom, Auto off/on, manual while Auto enabled, no post-shutter fake lock, only confirmed live Auto, stalled native still demotion |
| AXO-67 | Profile detector/overlay callbacks, long tasks and dropped frames; record whether worker or fallback was used |
| AXO-70 | Record the run identifier from a real multi-page scan through upload, processing, correction and committed paper, without DB repair |

For transient motion/lighting trials, distinguish the adverse phase from recovery:
start a separate acquisition trial once a fully visible, capture-ready page is
presented again. Never demand successful capture of a deliberately unreadable
page. Record refusal/guidance and any erroneous lock/capture in the owning issue.

Proposed budgets for review (not previously agreed hardware acceptance):

- Acquisition p95 <= 3000 ms; timed-out/missing locks remain in the denominator.
- Correct Auto capture within 10000 ms in >=95% of capture-ready trials.
- Zero false captures; zero false locks on hard negatives.
- At least 20 trials per device/scenario; review every failure independently.

Create a child bug for each reproducible failure with scenario, device, build,
steps and minimal evidence. Re-run that scenario and baseline acquisition after
its fix. A green report does not automatically close any Linear issue.

## Trial format and report

A trial's `null` means the event was not observed. Omitted measurements are errors.
`correctAutoCaptureMs` requires a preceding confirmed lock. Incorrect crops,
unwanted duplicate captures and captures of negative scenes increment
`falseAutoCaptures`. For partial pages expected to be refused, use `lock-only`
only if a live lock is expected; otherwise use `reject` and document the reason.

This is a format illustration, **not observed evidence**:

```json
{
  "schemaVersion": 1,
  "source": "physical",
  "build": "DEPLOYED_COMMIT_SHA",
  "device": "MODEL_AND_DEVICE_CLASS",
  "os": "OS_VERSION",
  "browser": "BROWSER_VERSION",
  "trials": [
    {
      "id": "portrait-01",
      "scenario": "portrait-close",
      "expectation": "auto",
      "observationMs": 10000,
      "firstLockMs": null,
      "correctAutoCaptureMs": null,
      "falseAutoCaptures": 0
    }
  ]
}
```

Optionally provide integer `droppedFrames` and `totalFrames` together when actually
measured. Capture presentation timestamps can be inspected using a recording or
a temporary local controller callback. Never infer dropped frames from detector
cadence: detection intentionally runs slower than preview rendering.

```sh
node bench/scanner-reliability.mjs actual-device-trials.json > device-report.json
```

The report groups by scenario and expectation. Percentiles describe successful
lock samples only; acquisition timeouts, capture timeouts, false locks and false
captures remain separate. Synthetic sources remain labelled synthetic. The
`meetsProposedBudget` field is a per-scenario check, not a complete device matrix or
approval to release.
