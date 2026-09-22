import LegalPage from "./LegalPage";

const email = "support@axonstudy.online";

export default function Cookies() {
  return (
    <LegalPage kind="cookies">
      <section><h2>1. Scope</h2>
        <p>
          This Cookie &amp; Similar Technologies Policy explains how Axon uses cookies, local storage,
          browser databases, cache storage, scripts and related technologies when providing the Axon
          service. It should be read together with the Privacy Policy.
        </p>
      </section>

      <section><h2>2. What these technologies are</h2>
        <p>
          Cookies are small pieces of information stored by a browser. Modern web applications can
          also store or access information through local storage, session storage, IndexedDB, cache
          storage and similar mechanisms. Privacy and electronic-communications laws may regulate these
          technologies in similar ways even when they are not technically cookies. We refer to them
          collectively as "Cookies and Similar Technologies".
        </p>
      </section>

      <section><h2>3. Why Axon uses them</h2>
        <p>Axon may use Cookies and Similar Technologies to:</p>
        <ul>
          <li>maintain authentication and session continuity;</li>
          <li>protect accounts, prevent abuse and support security controls;</li>
          <li>remember privacy and analytics choices;</li>
          <li>store display and accessibility preferences;</li>
          <li>preserve drafts and requested application state;</li>
          <li>cache study information for performance or offline use;</li>
          <li>complete authentication or payment flows selected by the user; and</li>
          <li>measure product usage and diagnose reliability problems where optional analytics is allowed.</li>
        </ul>
      </section>

      <section><h2>4. Necessary storage</h2>
        <p>
          Some storage is necessary to provide a feature the user requests or to keep the Service
          secure. This can include authentication state, security information, a record of the user's
          cookie choice, requested preferences, offline application data and drafts. Where applicable
          law permits, necessary storage operates without optional analytics consent because disabling
          it can prevent the requested Service from working correctly.
        </p>
      </section>

      <section><h2>5. Preferences, offline data and local cache</h2>
        <p>
          Axon can use local browser storage and IndexedDB-style caches to remember preferences and
          make previously accessed information available more quickly or offline. A device that stores
          cached study information should be protected against unauthorised access. Clearing browser
          site data may remove locally stored information and preferences.
        </p>
      </section>

      <section><h2>6. Optional PostHog analytics</h2>
        <p>
          Axon currently integrates PostHog for optional product analytics. When a user chooses
          "Allow analytics", Axon may initialise PostHog with autocapture, page or route-view capture,
          page-leave capture, exception capture and masked session replay. PostHog is configured to use
          local storage and cookies for analytics persistence.
        </p>
        <p>
          Axon's current session-replay configuration masks all text and input fields. We also prohibit
          custom analytics events from deliberately containing student names, email addresses, paper
          or answer text, authentication tokens, raw database identifiers or uploaded document data.
          Masking reduces risk but is not an absolute guarantee that no sensitive material could ever
          be captured by a software defect or unexpected page state.
        </p>
      </section>

      <section><h2>7. Analytics is off until allowed</h2>
        <p>
          Axon does not initialise PostHog on a browser that has not recorded an analytics choice. The
          consent panel offers "Necessary only" and "Allow analytics". Choosing "Necessary only" leaves
          PostHog disabled. Choosing "Allow analytics" permits Axon to initialise the analytics client.
          Core scanning and study functions do not require optional analytics.
        </p>
      </section>

      <section><h2>8. Changing the analytics choice</h2>
        <p>
          The analytics choice can be changed later in Axon's Settings screen. Withdrawing analytics
          permission instructs the analytics client to opt out of further capture in that browser.
          Clearing all browser storage may also erase the stored choice, in which case Axon may ask for
          a choice again on a later visit.
        </p>
      </section>

      <section><h2>9. Session replay</h2>
        <p>
          Session replay can reconstruct aspects of how a user interacted with a page. Because Axon is
          an educational service involving students, replay is treated as an analytics feature rather
          than a necessary feature. It is therefore not started before the browser's analytics choice
          permits PostHog. Axon must not intentionally configure replay to expose paper text, student
          answers, marks, credentials or private communications.
        </p>
      </section>

      <section><h2>10. Authentication providers</h2>
        <p>
          If a user chooses Google or another supported identity provider, the provider may use
          its own Cookies and Similar Technologies as part of the sign-in process on its own systems.
          Those technologies may be governed by the provider's own privacy and cookie notices when the
          provider acts independently.
        </p>
      </section>

      <section><h2>11. Stripe and payments</h2>
        <p>
          When a user chooses to purchase or manage a subscription, Axon may redirect the browser to
          Stripe-hosted Checkout or the Stripe Customer Portal. Stripe may use its own Cookies and
          Similar Technologies for checkout operation, fraud prevention, security and payment
          administration under Stripe's applicable notices.
        </p>
      </section>

      <section><h2>12. Cloudflare and security infrastructure</h2>
        <p>
          Cloudflare or other infrastructure used by Axon may process network information and use
          storage mechanisms that are necessary for security, delivery, abuse prevention or reliable
          operation. Where a technology is not legally exempt from consent, Axon will treat it according
          to the consent or objection requirement that applies.
        </p>
      </section>

      <section><h2>13. No student behavioural-advertising cookies</h2>
        <p>
          Axon does not currently use Cookies or Similar Technologies to build behavioural advertising
          profiles from a student's academic content or to deliver third-party behavioural advertising
          based on that content. If this materially changes, Axon will update its notices and implement
          any legally required consent or opt-out mechanism before the new practice begins.
        </p>
      </section>

      <section><h2>14. Categories</h2>
        <p>Axon treats storage and tracking technologies in the following categories:</p>
        <ul>
          <li><strong>Necessary:</strong> authentication, security, consent records and storage needed to provide requested core features.</li>
          <li><strong>Functional:</strong> optional convenience preferences where local law treats them as non-essential.</li>
          <li><strong>Analytics:</strong> PostHog and comparable measurement tools that are not necessary to provide the core study service.</li>
          <li><strong>Advertising:</strong> not currently used for student behavioural advertising.</li>
        </ul>
      </section>

      <section><h2>15. Duration and retention</h2>
        <p>
          Different technologies persist for different periods. Some session state ends when the
          browser session ends; other local preferences and the analytics-consent choice persist until
          changed or cleared so the Service can remember the user's decision. PostHog identifiers,
          events and replay data are subject to Axon's PostHog configuration and applicable provider
          retention settings.
        </p>
        <p>
          Axon does not state a fabricated fixed analytics-retention period where the production
          provider configuration has not been verified to enforce that exact maximum. We review
          retention as part of our privacy and provider configuration and apply applicable legal
          storage-limitation requirements.
        </p>
      </section>

      <section><h2>16. Browser controls</h2>
        <p>
          Browsers commonly allow users to inspect, block or delete cookies and site storage. Blocking
          all browser storage can prevent authentication, offline functionality, preferences or other
          requested features from operating correctly. Browser controls do not necessarily stop
          server-side processing that does not depend on storage on the user's device.
        </p>
      </section>

      <section><h2>17. Global Privacy Control and similar signals</h2>
        <p>
          Where applicable law requires Axon to recognise a legally valid browser-based opt-out
          preference signal such as Global Privacy Control, Axon will honour the signal for the
          processing to which that legal requirement applies. "Do Not Track" is not interpreted
          uniformly across jurisdictions, so Axon follows applicable legal requirements rather than
          claiming a universal technical meaning for that header.
        </p>
      </section>

      <section><h2>18. Children</h2>
        <p>
          Because Axon is designed for students, optional tracking receives heightened scrutiny.
          Student academic content is not used for third-party behavioural advertising. Where law
          requires a parent, guardian or child to consent to optional tracking, Axon will obtain the
          required consent before activating the covered technology.
        </p>
      </section>

      <section><h2>19. Changes to this Policy</h2>
        <p>
          We may update this Policy if our technologies, providers, legal obligations or consent
          practices change. The current revision date appears at the top. A materially new purpose that
          requires consent will not be treated as automatically authorised by an earlier choice.
        </p>
      </section>

      <section><h2>20. Contact</h2>
        <p>
          Questions about cookies, analytics or privacy can be sent to
          <a href={"mailto:" + email}> {email}</a>. Axon does not currently publish a registered postal
          office address.
        </p>
      </section>
    </LegalPage>
  );
}
