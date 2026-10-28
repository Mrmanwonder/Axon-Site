# AXON Engineering Specification

# Volume II — Component Specification

## Navigation and shell

- App shell
- Tab/navigation controls
- Theme toggle
- Route loading boundary
- Route error boundary

## Paper library

- Paper card/list row
- Subject/status metadata
- Search/filter controls
- Empty/error/loading states

## Scanner

- Camera viewport
- Capture control
- Capture guidance
- Page tray
- Preparing/failed/retake page state
- Quality/review sheet
- Submit state

## Review

- Question row/card
- Confidence/review indicator
- Answer block
- Teacher-mark evidence
- Confirmation/correction controls

## Question detail

- Question/answer evidence
- Marks awarded / available
- Explanation block
- Corrected-working grounding state
- Source/evidence affordances where applicable

## Insights

- Trusted aggregate metric
- Trend/pattern presentation
- Empty/insufficient-evidence state

## Account/settings

- Profile chooser/editor
- Privacy and analytics controls
- Billing controls
- Appearance controls
- Dialog/sheet primitives

## Shared interaction requirements

Components must:
- expose accessible names and keyboard behavior,
- support dark mode,
- support reduced motion,
- avoid blocking content with overlays/docks,
- use short responsive transitions,
- never represent an uncertain model output as confirmed data.
