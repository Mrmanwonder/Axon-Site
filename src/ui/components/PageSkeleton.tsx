import type { CSSProperties, ReactNode } from "react";

export type PageSkeletonVariant =
  | "home"
  | "library"
  | "insights"
  | "paper"
  | "question"
  | "review"
  | "scan"
  | "settings"
  | "onboarding"
  | "legal";

type BlockProps = {
  width?: string;
  height?: string;
  radius?: string;
  className?: string;
};

function Block({
  width = "100%",
  height = "12px",
  radius = "999px",
  className = "",
}: BlockProps) {
  return (
    <span
      className={`page-skeleton__block ${className}`}
      style={{
        "--sk-width": width,
        "--sk-height": height,
        "--sk-radius": radius,
      } as CSSProperties}
    />
  );
}

function PageTitle({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="page-skeleton__greet">
      <Block width="38%" height="34px" radius="10px" />
      {subtitle && <Block width="58%" height="12px" />}
    </div>
  );
}

function SectionTitle({ width = "25%" }: { width?: string }) {
  return (
    <div className="page-skeleton__section-title">
      <Block width={width} height="10px" />
    </div>
  );
}

function Chips({ count = 4 }: { count?: number }) {
  const widths = ["104px", "92px", "116px", "86px", "108px"];
  return (
    <div className="page-skeleton__chips">
      {Array.from({ length: count }, (_, i) => (
        <Block key={i} width={widths[i % widths.length]} height="32px" radius="11px" />
      ))}
    </div>
  );
}

function ListRow({
  thumb = false,
  score = false,
  compact = false,
}: {
  thumb?: boolean;
  score?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`page-skeleton__row${compact ? " is-compact" : ""}`}>
      {thumb && <Block width="44px" height="56px" radius="8px" className="page-skeleton__thumb" />}
      <div className="page-skeleton__row-copy">
        <Block width="62%" height="15px" />
        <Block width="42%" height="10px" />
        {!compact && (
          <div className="page-skeleton__row-meta">
            <Block width="72px" height="20px" radius="7px" />
            <Block width="82px" height="20px" radius="7px" />
          </div>
        )}
      </div>
      {score && (
        <div className="page-skeleton__score">
          <Block width="28px" height="18px" />
          <Block width="24px" height="8px" />
        </div>
      )}
      {!score && <Block width="7px" height="12px" radius="3px" className="page-skeleton__chevron" />}
    </div>
  );
}

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`page-skeleton__surface ${className}`}>{children}</div>;
}

function HomeSkeleton() {
  return (
    <>
      <div className="page-skeleton__greet">
        <Block width="74px" height="10px" />
        <Block width="42%" height="34px" radius="10px" />
      </div>
      <Chips count={3} />
      <Surface className="page-skeleton__next">
        <Block width="68px" height="9px" />
        <Block width="88%" height="22px" radius="8px" />
        <Block width="63%" height="22px" radius="8px" />
      </Surface>
      <SectionTitle width="24%" />
      <div className="page-skeleton__list">
        <ListRow score />
        <ListRow score />
        <ListRow score />
      </div>
    </>
  );
}

function LibrarySkeleton() {
  return (
    <>
      <PageTitle subtitle={false} />
      <div className="page-skeleton__search">
        <Block width="18px" height="18px" radius="50%" />
        <Block width="62%" height="13px" />
      </div>
      <Chips count={4} />
      <div className="page-skeleton__list-meta">
        <Block width="68px" height="10px" />
        <Block width="98px" height="30px" radius="11px" />
      </div>
      <div className="page-skeleton__list">
        <ListRow thumb score />
        <ListRow thumb score />
        <ListRow thumb score />
        <ListRow thumb score />
      </div>
    </>
  );
}

function InsightsSkeleton() {
  return (
    <>
      <PageTitle />
      <Chips count={4} />
      <div className="page-skeleton__insights-grid">
        <section>
          <SectionTitle width="22%" />
          <Surface className="page-skeleton__coverage">
            <div className="page-skeleton__split">
              <Block width="116px" height="13px" />
              <Block width="92px" height="10px" />
            </div>
            <Block width="100%" height="7px" radius="4px" />
            <Block width="88%" height="11px" />
            <Block width="66%" height="11px" />
          </Surface>
        </section>
        <section>
          <SectionTitle width="18%" />
          <Surface className="page-skeleton__chart-card">
            <div className="page-skeleton__split">
              <Block width="46%" height="12px" />
              <Block width="30%" height="10px" />
            </div>
            <div className="page-skeleton__bars">
              {[36, 64, 48, 78, 56, 70].map((height, i) => (
                <Block key={i} width="11%" height={`${height}px`} radius="6px 6px 0 0" />
              ))}
            </div>
          </Surface>
        </section>
        <section>
          <SectionTitle width="34%" />
          <Surface>
            <Block width="100%" height="10px" radius="5px" />
            <div className="page-skeleton__cause-grid">
              {[0, 1, 2, 3].map((i) => (
                <div key={i}>
                  <Block width="8px" height="8px" radius="3px" />
                  <Block width={i % 2 ? "72%" : "82%"} height="10px" />
                  <Block width="20px" height="10px" />
                </div>
              ))}
            </div>
          </Surface>
        </section>
      </div>
    </>
  );
}

function PaperSkeleton() {
  return (
    <>
      <PageTitle />
      <Surface className="page-skeleton__score-card">
        <Block width="44%" height="12px" />
        <div className="page-skeleton__score-total">
          <Block width="62px" height="28px" radius="8px" />
          <Block width="38px" height="18px" radius="6px" />
        </div>
      </Surface>
      <SectionTitle width="22%" />
      <div className="page-skeleton__list">
        <ListRow compact />
        <ListRow compact />
        <ListRow compact />
        <ListRow compact />
        <ListRow compact />
      </div>
    </>
  );
}

function QuestionCardSkeleton({ review = false }: { review?: boolean }) {
  return (
    <Surface className="page-skeleton__question-card">
      <div className="page-skeleton__qhead">
        <Block width="32%" height="16px" />
        <Block width="74px" height="22px" radius="7px" />
        <Block width="42px" height="22px" radius="7px" />
      </div>
      <Block width="100%" height="176px" radius="12px" className="page-skeleton__crop" />
      <div className="page-skeleton__field">
        <Block width="84px" height="9px" />
        <Block width="92%" height="13px" />
        <Block width="76%" height="13px" />
        <Block width="54%" height="13px" />
      </div>
      <div className="page-skeleton__field">
        <Block width="128px" height="9px" />
        <Block width="86%" height="13px" />
        <Block width="64%" height="13px" />
      </div>
      {review && (
        <div className="page-skeleton__actions">
          <Block width="112px" height="38px" radius="13px" />
          <Block width="92px" height="38px" radius="13px" />
          <Block width="128px" height="38px" radius="13px" />
        </div>
      )}
    </Surface>
  );
}

function QuestionSkeleton() {
  return (
    <>
      <div className="page-skeleton__review-head">
        <Block width="36px" height="36px" radius="50%" />
        <Block width="34%" height="15px" />
        <span />
      </div>
      <QuestionCardSkeleton />
    </>
  );
}

function ReviewSkeleton() {
  return (
    <>
      <div className="page-skeleton__review-head">
        <Block width="36px" height="36px" radius="50%" />
        <Block width="36%" height="15px" />
        <Block width="52px" height="24px" radius="8px" />
      </div>
      <div className="page-skeleton__review-scroll">
        <QuestionCardSkeleton review />
        <QuestionCardSkeleton review />
      </div>
    </>
  );
}

function ScanSkeleton() {
  return (
    <div className="page-skeleton__scan">
      <div className="page-skeleton__scan-top">
        <Block width="38px" height="38px" radius="50%" />
        <Block width="70px" height="30px" radius="999px" />
      </div>
      <div className="page-skeleton__viewfinder" aria-hidden="true" />
      <Block width="148px" height="28px" radius="999px" className="page-skeleton__scan-hint" />
      <div className="page-skeleton__scan-controls">
        <Block width="46px" height="46px" radius="50%" />
        <span className="page-skeleton__shutter"><i /></span>
        <Block width="46px" height="46px" radius="50%" />
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <>
      <PageTitle subtitle={false} />
      <Surface className="page-skeleton__profile-card">
        <Block width="48px" height="48px" radius="50%" />
        <div>
          <Block width="112px" height="15px" />
          <Block width="164px" height="10px" />
        </div>
      </Surface>
      <SectionTitle width="18%" />
      <Surface className="page-skeleton__avatar-row">
        {[0, 1, 2, 3, 4].map((i) => (
          <Block key={i} width="42px" height="42px" radius="50%" />
        ))}
      </Surface>
      <SectionTitle width="18%" />
      <div className="page-skeleton__list">
        <ListRow compact />
        <ListRow compact />
        <ListRow compact />
        <ListRow compact />
      </div>
      <SectionTitle width="16%" />
      <div className="page-skeleton__list">
        <ListRow compact />
        <ListRow compact />
      </div>
    </>
  );
}

function LegalSkeleton() {
  return (
    <div className="page-skeleton__legal">
      <div className="page-skeleton__legal-header">
        <Block width="68px" height="22px" radius="7px" />
        <Block width="104px" height="44px" radius="16px" />
      </div>
      <div className="page-skeleton__legal-content">
        <Block width="76px" height="10px" />
        <Block width="82%" height="52px" radius="12px" />
        <Block width="132px" height="12px" />
        {[0, 1, 2, 3].map((section) => (
          <div className="page-skeleton__legal-section" key={section}>
            <Block width={section % 2 ? "38%" : "46%"} height="24px" radius="8px" />
            <Block width="96%" height="12px" />
            <Block width="91%" height="12px" />
            <Block width={section % 2 ? "72%" : "84%"} height="12px" />
          </div>
        ))}
      </div>
    </div>
  );
}

function OnboardingSkeleton() {
  return (
    <div className="page-skeleton__onboarding">
      <div className="page-skeleton__wordmark">
        <Block width="24px" height="24px" radius="7px" />
        <Block width="52px" height="14px" />
      </div>
      <Block width="88%" height="36px" radius="10px" />
      <Block width="70%" height="36px" radius="10px" />
      <div className="page-skeleton__onboarding-copy">
        <Block width="92%" height="13px" />
        <Block width="84%" height="13px" />
        <Block width="58%" height="13px" />
      </div>
      <Surface className="page-skeleton__onboarding-panel">
        <Block width="34%" height="11px" />
        <Block width="90%" height="14px" />
        <Block width="74%" height="14px" />
      </Surface>
      <Block width="100%" height="50px" radius="18px" />
    </div>
  );
}

function SkeletonBody({ variant }: { variant: PageSkeletonVariant }) {
  switch (variant) {
    case "library":
      return <LibrarySkeleton />;
    case "insights":
      return <InsightsSkeleton />;
    case "paper":
      return <PaperSkeleton />;
    case "question":
      return <QuestionSkeleton />;
    case "review":
      return <ReviewSkeleton />;
    case "scan":
      return <ScanSkeleton />;
    case "settings":
      return <SettingsSkeleton />;
    case "onboarding":
      return <OnboardingSkeleton />;
    case "legal":
      return <LegalSkeleton />;
    default:
      return <HomeSkeleton />;
  }
}

export function skeletonVariantForPath(pathname: string): PageSkeletonVariant {
  if (pathname === "/privacy" || pathname === "/terms" || pathname === "/cookies") return "legal";
  if (pathname.startsWith("/scan/review/")) return "review";
  if (pathname === "/scan" || pathname.startsWith("/scan/")) return "scan";
  if (pathname === "/insights") return "insights";
  if (pathname === "/settings") return "settings";
  if (pathname.startsWith("/library/")) {
    const parts = pathname.split("/").filter(Boolean);
    return parts.length >= 3 ? "question" : "paper";
  }
  if (pathname === "/library") return "library";
  return "home";
}

export default function PageSkeleton({
  variant,
  label,
  standalone = false,
}: {
  variant: PageSkeletonVariant;
  label: string;
  standalone?: boolean;
}) {
  return (
    <div
      className={`page-skeleton page-skeleton--${variant}${standalone ? " is-standalone" : ""}`}
      role="status"
      aria-label={label}
      aria-live="polite"
      aria-busy="true"
      data-skeleton={variant}
    >
      <span className="sr-only">{label}</span>
      {standalone && !["scan", "review", "legal"].includes(variant) && (
        <div className="page-skeleton__chrome" aria-hidden="true">
          <Block width="84px" height="18px" />
          <Block width="36px" height="36px" radius="50%" />
        </div>
      )}
      <div className="page-skeleton__content" aria-hidden="true">
        <SkeletonBody variant={variant} />
      </div>
      {standalone && !["scan", "review", "onboarding", "legal"].includes(variant) && (
        <div className="page-skeleton__tabbar" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i}>
              <Block width="22px" height="22px" radius="7px" />
              <Block width={i === 1 ? "42px" : "34px"} height="7px" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
