import PressBox from "../components/PressBox";
import { hapticTick } from "../lib/haptics";
import "../styles/onboarding-intro.css";

/**
 * Signed-out introduction. The orbital light is an abstract visual metaphor,
 * not paper data, a progress indicator or a claim about a student's results.
 * A single action enters the guardian-owned setup flow.
 */
export default function Intro({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="ob-intro">
      <header className="ob-intro-brand" aria-label="Axon">
        <span className="ob-intro-symbol" aria-hidden="true">
          <img src="/axon-logo.svg" alt="" width="28" height="28" />
        </span>
        <span>Axon</span>
      </header>

      <div className="ob-intro-scene" aria-hidden="true">
        <div className="ob-intro-atmosphere" />
        <div className="ob-intro-horizon" />
        <div className="ob-intro-light" />
      </div>

      <div className="ob-intro-bottom">
        <div className="ob-intro-story">
          <span className="ob-intro-eyebrow">A clearer way to learn from a marked paper</span>
          <h1>See where the <em>marks went.</em></h1>
          <p>Scan a paper your teacher has marked. Axon helps you understand the answers, the marks and what to do differently next time.</p>
        </div>
        <div className="ob-intro-actions">
          <PressBox as="button" type="button" className="btn ob-intro-continue" onClick={() => { hapticTick(); onContinue(); }}>
            <span>Continue</span>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4.5 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </PressBox>
          <p className="ob-intro-footnote">A parent or guardian sets up the account and gives consent before we process student papers.</p>
        </div>
      </div>
    </div>
  );
}
