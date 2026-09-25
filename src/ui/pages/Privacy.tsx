import LegalPage from "./LegalPage";

const email = "support@axonstudy.online";

export default function Privacy() {
  return (
    <LegalPage kind="privacy">
      <section aria-labelledby="privacy-intro">
        <h2 id="privacy-intro">1. Who we are and what this policy covers</h2>
        <p>
          Axon ("Axon", "we", "us" or "our") operates the Axon study service at axonstudy.online.
          This Privacy Policy explains how we collect, use, disclose, store, protect and delete
          personal information when a parent or guardian creates an account, creates a student
          profile, scans or uploads marked academic work, uses Axon's AI-assisted study features,
          purchases a subscription, contacts support or otherwise uses the service.
        </p>
        <p>
          Axon's current product is designed for Cambridge (CAIE) students in Classes 9–12,
          corresponding to IGCSE through A Level. Under the current account model, the authenticated
          account is controlled by a parent or guardian and the associated student profile is for a
          student under 18.
        </p>
        <p>
          For privacy questions, requests and complaints, contact <a href={"mailto:" + email}>{email}</a>.
          Axon does not currently publish a registered postal office address. Where applicable law
          requires information or rights beyond this Policy, the mandatory law prevails.
        </p>
      </section>

      <section aria-labelledby="privacy-role">
        <h2 id="privacy-role">2. Axon's privacy role</h2>
        <p>
          For ordinary consumer use of Axon, Axon determines the purposes and means of the processing
          described in this Policy and acts as the controller, business, data fiduciary or equivalent
          responsible organisation under applicable privacy law. If a school or other institution
          later provides Axon under a separate written agreement, the parties' privacy roles may differ
          and that agreement and any institution-specific notice will supplement this Policy.
        </p>
      </section>

      <section aria-labelledby="privacy-data">
        <h2 id="privacy-data">3. Information we collect</h2>

        <h3>Parent or guardian account information</h3>
        <p>
          We may process the account holder's name, email address or phone number, authentication
          provider, account identifiers, sign-in and one-time-code events, consent records, security
          state, subscription state and account preferences. If Google sign-in is selected,
          we receive the information made available by that provider according to the sign-in flow.
        </p>

        <h3>Student profile information</h3>
        <p>
          A student profile can include first name, Cambridge stage or class level, subjects, syllabus
          codes, avatar choice and identifiers needed to associate the profile with the guardian
          account. Axon's present profile flow does not ask for a school, home address or student
          photograph.
        </p>

        <h3>Uploaded papers and academic content</h3>
        <p>
          When a paper is photographed, scanned or uploaded, we may process the original image or file,
          handwriting, printed questions, student answers, teacher comments and annotations, marks,
          page numbers, subject and paper metadata and other content visible on the page. The pipeline
          may create enhanced images, page crops, question regions, transcriptions, OCR results,
          structure data, provenance records and document-quality findings.
        </p>
        <p>
          Uploaded work can incidentally contain names, candidate numbers, school names, signatures or
          other identifiers. Users should avoid uploading personal information that is not needed for
          the requested study feature and should obscure unnecessary identifiers where practical.
        </p>

        <h3>Study records and derived information</h3>
        <p>
          Axon may store study history, question attempts, marks entered or confirmed by a person,
          mark-loss events, review corrections, unreadable-page findings, repeated learning patterns,
          progress and readiness indicators, explanations and other information derived from the
          student's papers and interactions with Axon.
        </p>

        <h3>AI-generated information</h3>
        <p>
          Axon uses OCR, computer vision, machine-learning systems, multimodal models and large language
          models ("LLMs"). These systems may create transcriptions, question mappings, classifications,
          subject identification, inferred learning causes, explanations, reflections, analyses,
          conclusions, summaries, recommendations, trends and other generated material ("AI Output").
          We may store AI Output and its provenance where needed to provide the service, support review,
          investigate errors and maintain a reliable record of what the service showed.
        </p>

        <h3>Device, log and security information</h3>
        <p>
          We and our infrastructure providers may process browser and device type, operating system,
          app version, IP or network information, timestamps, request metadata, security events,
          authentication events, error and exception information and operational logs. We do not
          require precise device location for Axon's ordinary study features.
        </p>

        <h3>Analytics information</h3>
        <p>
          Axon integrates PostHog for optional product analytics. If analytics is allowed, PostHog may
          receive product usage events, page or route views, interactions, browser or device information,
          exceptions and masked session-replay information. Axon's configuration masks text and input
          fields in session replay. We also prohibit custom analytics events from deliberately including
          student names, email addresses, paper or answer text, authentication tokens, raw database IDs
          or uploaded document content.
        </p>

        <h3>Billing information</h3>
        <p>
          Paid plans use Stripe-hosted Checkout and Stripe's customer portal. Card details are entered
          on Stripe's service rather than into an Axon card form. Axon may receive customer and
          subscription identifiers, selected plan, payment or subscription status, billing timestamps,
          transaction metadata and other information needed to administer the subscription.
        </p>

        <h3>Support information</h3>
        <p>
          If you contact support, we process the contact details, correspondence and any diagnostic
          information, screenshots or files you choose to provide. Do not send student papers or other
          sensitive material to support unless it is reasonably necessary to resolve the issue.
        </p>
      </section>

      <section aria-labelledby="privacy-sources">
        <h2 id="privacy-sources">4. Where information comes from</h2>
        <p>
          We obtain information directly from the parent or guardian; from the student using the
          guardian-controlled account; from uploaded or scanned material; from supported authentication
          and payment providers; automatically from browsers, devices and infrastructure; and from
          information generated by Axon's processing. We do not intentionally purchase student profiles
          from data brokers.
        </p>
      </section>

      <section aria-labelledby="privacy-uses">
        <h2 id="privacy-uses">5. How we use information</h2>
        <p>We process information as reasonably necessary to:</p>
        <ul>
          <li>create, authenticate, secure and administer accounts and student profiles;</li>
          <li>store, scan, enhance, extract, transcribe, classify and organise marked papers;</li>
          <li>associate teacher-provided or human-confirmed marks with questions and source regions;</li>
          <li>generate requested explanations, reflections, analyses and study insights;</li>
          <li>show historical patterns and progress across papers where the product feature permits;</li>
          <li>preserve provenance, corrections and review history so users can see what an insight was based on;</li>
          <li>provide offline or cached functions, preferences and requested notifications;</li>
          <li>process subscriptions, billing state and customer support;</li>
          <li>detect fraud, abuse, account compromise and security incidents;</li>
          <li>debug failures, monitor reliability and maintain the service;</li>
          <li>keep consent, transaction and compliance records where reasonably required;</li>
          <li>exercise or defend legal rights and comply with valid legal obligations; and</li>
          <li>improve extraction or other optional features only where the applicable consent or other lawful basis permits it.</li>
        </ul>
      </section>

      <section aria-labelledby="privacy-bases">
        <h2 id="privacy-bases">6. Legal bases and consent</h2>
        <p>
          The legal basis depends on the processing and the law that applies. We may rely on performance
          of a contract or steps requested before a contract; consent; parent or guardian consent where
          legally required; compliance with legal obligations; legitimate interests where permitted and
          not overridden by the individual's rights; security and fraud-prevention grounds; and other
          lawful grounds available under applicable law.
        </p>
        <p>
          Where Axon relies on consent, the request is intended to be specific to the relevant purpose
          and recorded in Axon's consent ledger. Optional purposes are not meant to be pre-enabled.
          Consent may be withdrawn for future processing through the available controls or by contacting
          us, subject to processing already lawfully performed and records we are permitted or required
          to retain.
        </p>
      </section>

      <section aria-labelledby="privacy-children">
        <h2 id="privacy-children">7. Children, students and guardian consent</h2>
        <p>
          Axon is designed for students and therefore applies heightened protections to student data.
          Under the current product model, a parent or legal guardian controls the authenticated
          account and creates the profile for a student under 18. A student must not impersonate an
          adult or guardian to bypass an age, consent or account requirement.
        </p>
        <p>
          Where applicable law requires verifiable parental consent or verification of the consenting
          adult's identity, adulthood or relationship to the child before covered processing begins,
          Axon must complete the legally required verification before relying on that verified consent.
          Axon will not treat a development stub, unchecked declaration or cosmetic screen as legal
          verification.
        </p>
        <p>
          In the United States, where the Children's Online Privacy Protection Act ("COPPA") applies,
          Axon will obtain verifiable parental consent before collecting, using or disclosing personal
          information online from a child under 13 unless a legal exception applies. In the EEA and UK,
          where processing relies on a child's consent to an online service, the applicable local
          parental-consent age and verification requirements apply. In India, Axon will apply the
          Digital Personal Data Protection framework to the extent its relevant provisions are in force
          and applicable to the processing.
        </p>
        <p>
          Axon does not use student academic content for third-party behavioural advertising and does
          not intentionally sell student personal information.
        </p>
      </section>

      <section aria-labelledby="privacy-ai">
        <h2 id="privacy-ai">8. AI processing and model providers</h2>
        <p>
          Some study features require relevant text, instructions, images or page crops to be processed
          by external AI infrastructure. Axon currently routes model requests through OpenRouter, which
          can route a request to an eligible underlying model provider selected for the relevant
          processing stage.
        </p>
        <p>
          Axon's current model client is configured by default to request zero-data-retention endpoints
          and deny provider data collection or training for those requests. Model routing, provider
          availability and provider terms can change. Axon therefore does not promise that a particular
          third-party model or provider will always be used. Any deliberate change that would materially
          permit an AI provider to retain or train on identifiable student material must receive privacy
          review and any notice or consent required by law before the affected processing is used.
        </p>
        <p>
          Temporary signed access links may be used to make a paper image available to an AI request.
          Access is intended to be limited in duration and scope to the relevant processing task.
        </p>
      </section>

      <section aria-labelledby="privacy-accuracy">
        <h2 id="privacy-accuracy">9. AI accuracy and human review</h2>
        <p>
          OCR and AI systems are probabilistic. They can misread handwriting, associate text with the
          wrong question, infer the wrong subject or cause, miss context, produce an incorrect
          explanation or generate information that is incomplete, misleading or fabricated. A detailed
          or confident AI response is not proof that it is correct.
        </p>
        <p>
          Axon is designed as a study-support service, not an official examiner, admissions system,
          disciplinary system or awarding body. Axon does not intend to use AI Output as the sole basis
          for a decision producing legal or similarly significant effects for a student. Official marks,
          admissions, discipline and equivalent high-stakes decisions should be made by the responsible
          human or institution.
        </p>
      </section>

      <section aria-labelledby="privacy-providers">
        <h2 id="privacy-providers">10. Service providers and recipients</h2>
        <p>Axon currently uses or may use the following categories of providers to operate the service:</p>
        <ul>
          <li><strong>Supabase</strong> for authentication, database services and application infrastructure;</li>
          <li><strong>Cloudflare</strong> for network, delivery, worker and/or object-storage infrastructure;</li>
          <li><strong>OpenRouter and eligible routed model providers</strong> for AI processing;</li>
          <li><strong>Stripe</strong> for hosted payments and subscription management;</li>
          <li><strong>Google</strong> when the user chooses Google authentication; and</li>
          <li><strong>PostHog</strong> for optional product analytics when analytics is enabled.</li>
        </ul>
        <p>
          Providers receive information only to the extent reasonably necessary for their role, subject
          to Axon's configuration, agreements and the provider's applicable terms. We may also disclose
          information when reasonably necessary to comply with a valid legal obligation or court order,
          protect users or the service, investigate abuse or security incidents, enforce legal rights,
          or complete a corporate restructuring or transfer subject to applicable safeguards.
        </p>
      </section>

      <section aria-labelledby="privacy-sale">
        <h2 id="privacy-sale">11. Sale, sharing and advertising</h2>
        <p>
          Axon does not rent student personal information. Axon does not intentionally sell student
          personal information for monetary consideration, and it does not use the contents of a
          student's uploaded papers, handwriting, answers, marks or generated study profile to deliver
          third-party behavioural advertising. If our practices materially change, we will update this
          Policy and implement any legally required opt-out or consent mechanism before the new practice
          begins.
        </p>
        <p>
          The guardian account holder may deliberately create a time-limited, revocable read-only link
          to one saved paper or one saved question. Anyone who receives a valid link can view the
          academic snapshot selected for that link until it expires, is revoked or the underlying work
          is deleted. The shared view is designed not to include the guardian's or student's account
          contact details, unrelated papers or profiles, internal model logs or signed private paper
          image URLs. Because a recipient can copy or further disclose information they can see, the
          guardian should share a link only with an intended recipient and should stop sharing if the
          link is no longer needed or may have reached someone unintended.
        </p>
      </section>

      <section aria-labelledby="privacy-cookies">
        <h2 id="privacy-cookies">12. Cookies, browser storage and analytics choices</h2>
        <p>
          Axon uses browser storage and similar technologies for authentication, security, consent
          choices, preferences, drafts, caching and offline functionality. These technologies can be
          necessary to provide features the user requests.
        </p>
        <p>
          PostHog analytics is optional. Axon does not initialise PostHog unless the browser has recorded
          an "Allow analytics" choice. Users can decline analytics without losing the core study service
          and can later change the choice from Settings. More information is in the Cookie & Similar
          Technologies Policy.
        </p>
      </section>

      <section aria-labelledby="privacy-transfers">
        <h2 id="privacy-transfers">13. International processing and transfers</h2>
        <p>
          Axon's infrastructure and providers may process information in countries other than the
          country in which the user lives. Axon does not promise that all information remains in one
          country. Where applicable law restricts international transfers, Axon will use a recognised
          legal mechanism or other safeguard required for the relevant transfer, such as an adequacy
          mechanism, approved contractual clauses or another permitted arrangement.
        </p>
      </section>

      <section aria-labelledby="privacy-retention">
        <h2 id="privacy-retention">14. Retention</h2>
        <p>
          We keep personal information only for as long as reasonably necessary for the purpose for
          which it was collected, including providing the account and study features, maintaining
          security, resolving disputes and meeting legitimate legal, tax, accounting and compliance
          requirements.
        </p>
        <p>
          Account and study data may be retained while the account remains active. Uploaded paper
          objects and derived study records are intended to be removed when the relevant data is
          deleted, subject to technical backup cycles, incident-preservation needs and records that
          lawfully must remain. Security, billing, support, consent and transaction records may be kept
          longer where their purpose requires it. We use retention criteria rather than inventing a
          fixed period where the production system does not yet enforce a single maximum for that
          category.
        </p>
      </section>

      <section aria-labelledby="privacy-delete">
        <h2 id="privacy-delete">15. Deletion and account closure</h2>
        <p>
          The account holder can request deletion through Axon's account controls or by contacting
          support. Axon's current deletion flow is designed to remove stored paper objects before the
          authentication account is released, reducing the risk that private files become orphaned.
        </p>
        <p>
          Deletion may not remove every technical copy instantly. Limited information can remain for a
          period in backups, security systems, payment records or legally required records. Axon may
          retain a minimised or de-identified record needed to demonstrate historical consent,
          withdrawal or compliance where applicable law permits that retention.
        </p>
      </section>

      <section aria-labelledby="privacy-export">
        <h2 id="privacy-export">16. Access and export</h2>
        <p>
          Axon provides an in-product data export for available account records. Some technical records
          and stored paper files may exist in systems that are not included in a one-click client-side
          export. A legal access request is therefore not limited to the contents of that automated file.
          Contact <a href={"mailto:" + email}>{email}</a> for a privacy-rights request.
        </p>
      </section>

      <section aria-labelledby="privacy-rights">
        <h2 id="privacy-rights">17. Privacy rights</h2>
        <p>
          Depending on applicable law, an individual may have rights to know or access personal
          information; obtain a copy; correct inaccurate information; request deletion; withdraw
          consent; object to or restrict certain processing; receive portable data; opt out of covered
          sale, sharing, targeted advertising or profiling; limit certain uses of sensitive personal
          information; appeal a privacy-request decision; receive information about certain automated
          processing; and complain to a regulator.
        </p>
        <p>
          Not every right applies in every jurisdiction or circumstance. We may take reasonable steps
          to verify the requester's identity and authority. A parent, guardian or authorised agent may
          act for another person where applicable law permits and the authority can be established.
          We will respond within the timeframe required by the law that applies.
        </p>
      </section>

      <section aria-labelledby="privacy-eea">
        <h2 id="privacy-eea">18. EEA, UK and Switzerland</h2>
        <p>
          Where the GDPR, UK GDPR or materially equivalent law applies, users may have rights of access,
          rectification, erasure, restriction, objection and data portability and the right to withdraw
          consent. They may also complain to the competent supervisory authority. When Axon relies on
          legitimate interests, the interest is assessed against the rights and reasonable expectations
          of the affected individual, with particular care for children.
        </p>
      </section>

      <section aria-labelledby="privacy-us">
        <h2 id="privacy-us">19. United States state privacy rights</h2>
        <p>
          If a comprehensive U.S. state privacy law applies to Axon and to the relevant processing,
          residents receive the rights and disclosures required by that law. This may include rights to
          access, delete and correct information, obtain portability, opt out of covered sale or sharing,
          targeted advertising or certain profiling, limit covered sensitive-data uses, use an
          authorised agent and appeal a denied request. Axon does not claim that every state statute
          applies to Axon merely because this Policy describes those rights.
        </p>
        <p>
          Where legally required, Axon will honour a recognised browser-based opt-out preference signal
          for the processing to which the signal legally applies.
        </p>
      </section>

      <section aria-labelledby="privacy-india">
        <h2 id="privacy-india">20. India</h2>
        <p>
          To the extent India's Digital Personal Data Protection Act, 2023 and the Digital Personal
          Data Protection Rules, 2025 are in force and apply to the processing, Axon will provide the
          required notice, use a lawful ground for processing, honour applicable data-principal rights,
          implement reasonable security safeguards and satisfy applicable child-data and parental-
          consent obligations. Because the Indian framework has staged commencement provisions, Axon
          applies each requirement according to its legal commencement and applicability rather than
          claiming that every provision is already operative for every activity.
        </p>
      </section>

      <section aria-labelledby="privacy-security">
        <h2 id="privacy-security">21. Security</h2>
        <p>
          Axon uses technical and organisational safeguards intended to reduce the risk of unauthorised
          access, loss or misuse. Current safeguards include authenticated requests, database row-level
          access controls, private storage, HTTPS transport, short-lived upload or download capabilities
          where appropriate, separation of public and privileged credentials, model-request controls
          and provenance records. No internet-connected service can guarantee absolute security.
        </p>
      </section>

      <section aria-labelledby="privacy-breach">
        <h2 id="privacy-breach">22. Security incidents</h2>
        <p>
          If we discover a security incident affecting personal information, we will investigate,
          contain and remediate it as appropriate. Where applicable law requires notification to users,
          regulators or other authorities, Axon will make that notification in the legally required
          circumstances and timeframe.
        </p>
      </section>

      <section aria-labelledby="privacy-sensitive">
        <h2 id="privacy-sensitive">23. Sensitive information</h2>
        <p>
          Axon's ordinary study functions do not require health, biometric, genetic, religious,
          political, sexual, criminal or similarly sensitive information. Users should not upload
          unnecessary sensitive information. If Axon introduces a feature that intentionally requires a
          legally protected sensitive category, we will assess the processing and provide any additional
          notice, consent or safeguard required before using that feature.
        </p>
      </section>

      <section aria-labelledby="privacy-improve">
        <h2 id="privacy-improve">24. De-identified information and product improvement</h2>
        <p>
          Axon may create aggregated, anonymised or de-identified information for reliability testing,
          statistics, security, research and product development where the resulting information no
          longer constitutes personal information under applicable law. Removing a direct name does not
          by itself make information anonymous if it can still reasonably be linked to a person.
        </p>
        <p>
          Where a product-improvement activity is presented as optional consent, such as using
          appropriately de-identified corrections to improve extraction, Axon will respect the recorded
          consent choice.
        </p>
      </section>

      <section aria-labelledby="privacy-third">
        <h2 id="privacy-third">25. Third-party services and links</h2>
        <p>
          A third-party site or service may have its own privacy practices when it acts independently,
          including on a separate Google, Stripe or other provider domain. Axon is not responsible
          for an independent third party's separate processing, but remains responsible for Axon's own
          obligations when it appoints a provider to process information on Axon's behalf.
        </p>
      </section>

      <section aria-labelledby="privacy-changes">
        <h2 id="privacy-changes">26. Changes to this Policy</h2>
        <p>
          We may update this Policy to reflect changes in the service, providers, security practices or
          law. The date at the top identifies the current version. Where a change is material, we will
          provide additional notice where appropriate. Where a materially new purpose legally requires
          fresh consent, Axon will request that consent rather than silently treating an earlier consent
          as covering the new purpose.
        </p>
      </section>

      <section aria-labelledby="privacy-contact">
        <h2 id="privacy-contact">27. Contact and complaints</h2>
        <p>
          Privacy, support and rights requests can be sent to <a href={"mailto:" + email}>{email}</a>.
          If applicable law gives you the right to complain to a privacy or data-protection regulator,
          nothing in this Policy limits that right.
        </p>
      </section>
    </LegalPage>
  );
}
