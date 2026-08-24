/** The disclosure chevron, which appears on every row that leads somewhere.
    Decorative — the row's own text is the accessible name. */
export default function Chevron() {
  return (
    <svg
      className="chev"
      viewBox="0 0 7 12"
      stroke="currentColor"
      strokeWidth="1.8"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 1l5 5-5 5" />
    </svg>
  );
}
