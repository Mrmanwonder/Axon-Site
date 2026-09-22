import { useEffect, useState } from "react";
import {
  ANALYTICS_CONSENT_EVENT,
  getAnalyticsConsent,
  setAnalyticsConsent,
  type AnalyticsConsent,
} from "../lib/analytics";

export default function CookieConsent() {
  const [choice, setChoice] = useState<AnalyticsConsent>(() => getAnalyticsConsent());

  useEffect(() => {
    const sync = () => setChoice(getAnalyticsConsent());
    window.addEventListener(ANALYTICS_CONSENT_EVENT, sync);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, sync);
  }, []);

  if (choice !== null) return null;

  return (
    <aside className="cookie-consent" aria-label="Analytics choice">
      <div className="cookie-consent__copy">
        <strong>Axon uses necessary storage to keep the app working.</strong>
        <span>
          With your choice, we also use PostHog analytics to understand reliability and product use.
          Analytics is optional and is off until you allow it. <a href="/cookies">Read the Cookie Policy</a>.
        </span>
      </div>
      <div className="cookie-consent__actions">
        <button type="button" className="cookie-consent__secondary"
                onClick={() => { setAnalyticsConsent(false); setChoice("denied"); }}>
          Necessary only
        </button>
        <button type="button" className="cookie-consent__primary"
                onClick={() => { setAnalyticsConsent(true); setChoice("granted"); }}>
          Allow analytics
        </button>
      </div>
    </aside>
  );
}
