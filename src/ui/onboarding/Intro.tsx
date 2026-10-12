import PressBox from "../components/PressBox";
import { hapticTick } from "../lib/haptics";
import "../styles/onboarding-intro.css";

/**
 * Public, signed-out introduction. The illustration is schematic: it contains
 * no example student answers, guessed marks or simulated analysis.
 */
export default function Intro({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="ob-intro" role="region" aria-label="Axon introduction">
      <div className="ob-intro-brand" aria-label="Axon">
        {/* Exact mark paths from public/axon-logo.svg, without its opaque white rect. */}
        <svg className="ob-intro-brandmark" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
          <path d="M79.8891 33.0458C77.6967 35.7454 75.6509 38.4954 74.1467 41.608 73.0556 43.8656 72.429 46.2541 72.408 48.754 72.385 51.4878 73.041 54.0881 74.2464 56.5578 75.8075 59.7568 77.9137 62.5724 80.232 65.2422 81.9745 67.2489 83.7513 69.2259 85.5085 71.2198 85.7157 71.4549 85.8962 71.7135 86 72.0628 85.8547 71.969 85.6962 71.889 85.5657 71.7792 82.5214 69.2483 79.5205 66.6631 76.4272 64.1937 72.7917 61.2915 68.9164 58.7495 64.6101 56.9247 63.7272 56.5506 62.7963 56.2715 61.9528 55.8253 58.0462 53.7588 56.7449 48.7801 59.0295 44.9952 60.09 43.2382 61.6383 42.1372 63.4836 41.4201 66.9754 40.0632 70.1665 38.1784 73.1741 35.9766 75.5465 34.2396 77.8893 32.4599 80.2005 30.6423 82.0061 29.2222 83.7426 27.7143 85.5116 26.2476 85.6227 26.1555 85.7494 26.0821 85.8688 26 85.9045 26.035 85.9403 26.0699 85.9761 26.1049 83.9562 28.4087 81.9364 30.7125 79.8891 33.0458Z" />
          <path d="M20.1109 65.017C22.3033 62.3174 24.3491 59.5674 25.8534 56.4548 26.9444 54.1972 27.571 51.8087 27.592 49.3088 27.615 46.575 26.959 43.9748 25.7536 41.505 24.1925 38.3061 22.0863 35.4904 19.768 32.8206 18.0255 30.8139 16.2488 28.8369 14.4915 26.843 14.2843 26.6079 14.1038 26.3493 14 26 14.1453 26.0938 14.3023 26.1738 14.4343 26.2836 17.4786 28.8145 20.4795 31.3997 23.5728 33.8691 27.2083 36.7713 31.0836 39.3133 35.3899 41.1381 36.2729 41.5122 37.2037 41.7913 38.0473 42.2375 41.9538 44.304 43.2551 49.2827 40.9706 53.0676 39.91 54.8246 38.3617 55.9256 36.5164 56.6427 33.0247 57.9996 29.8335 59.8844 26.826 62.0862 24.4535 63.8232 22.1107 65.6029 19.7995 67.4205 17.9939 68.8406 16.2574 70.3485 14.4884 71.8152 14.3773 71.9073 14.2507 71.9807 14.1313 72.0628 14.0955 72.0278 14.0597 71.9929 14.0239 71.9579 16.0438 69.6541 18.0637 67.3504 20.1109 65.017Z" />
          <path d="M48.9486 53.8727C47.0774 53.489 45.636 51.8351 45.4685 49.9258 45.3006 48.0116 46.4121 46.2325 48.0989 45.4544 50.6613 44.2724 53.1397 45.8618 53.9664 47.5568 55.3978 50.4913 53.2709 53.9478 50.0089 53.9504 49.6715 53.9506 49.334 53.9056 48.9486 53.8727Z" />
        </svg>
        <span>Axon</span>
      </div>

      <section className="ob-intro-story">
        <span className="ob-intro-eyebrow">
          <span className="ob-intro-eyebrow-rule" aria-hidden="true" />
          Made for the way you learn
        </span>
        <h1>See where the <em>marks went.</em></h1>
        <p>Start with a paper your teacher has marked. Understand where marks were lost, and what to do differently next time.</p>
      </section>

      <div className="ob-intro-scene" aria-hidden="true">
        <div className="ob-intro-ambient" />
        <div className="ob-intro-scene-grid" />
        <div className="ob-intro-paper-shadow" />
        <div className="ob-intro-paper">
          <div className="ob-intro-paper-head">
            <span className="ob-intro-paper-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M7 3.5h7l4 4V20.5H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z M14 3.5v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </span>
            <span>MARKED PAPER</span>
            <span className="ob-intro-paper-dots"><i /><i /><i /></span>
          </div>
          <div className="ob-intro-paper-rule" />
          <div className="ob-intro-paper-question">
            <span className="ob-intro-paper-index">01</span>
            <div className="ob-intro-paper-lines">
              <i /><i /><i />
            </div>
          </div>
          <div className="ob-intro-paper-answer">
            <i /><i /><i /><i />
          </div>
          <div className="ob-intro-paper-focus">
            <span className="ob-intro-paper-focus-line" />
            <div><i /><i /></div>
            <span className="ob-intro-paper-focus-dot" />
          </div>
          <div className="ob-intro-paper-footer"><i /><i /></div>
        </div>

        <div className="ob-intro-connection"><span /></div>
        <div className="ob-intro-insight">
          <span className="ob-intro-insight-icon">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="m5 15 5-5 3.3 3.3L19 7.5 M14.5 7.5H19V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="ob-intro-insight-copy">
            <small>AXON EXPLAINS</small>
            <strong>What to do differently</strong>
          </span>
          <span className="ob-intro-insight-arrow" aria-hidden="true">↗</span>
        </div>
      </div>

      <div className="ob-intro-actions">
        <PressBox as="button" type="button" className="btn ob-intro-continue"
                  onClick={() => { hapticTick(); onContinue(); }}>
          <span>Continue</span>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4.5 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.75"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </PressBox>
        <p className="ob-intro-footnote">A parent or guardian sets up the account and gives consent before student papers are processed.</p>
      </div>
    </div>
  );
}
