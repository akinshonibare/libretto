/**
 * Theme-aware logo mark — fills with currentColor and uses var(--paper) for the
 * page-cream tone, so it tints with whichever palette is active.
 *
 * Source: imported from the Libretto design system bundle (assets/logo-mark.svg).
 */
export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="60" height="60" rx="13" fill="currentColor" opacity="0.06" />
      <rect x="2" y="2" width="60" height="60" rx="13" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <rect x="14" y="12" width="36" height="44" rx="3" fill="currentColor" opacity="0.95" />
      <rect x="20" y="20" width="24" height="2" fill="var(--paper)" opacity="0.7" />
      <rect x="20" y="26" width="24" height="2" fill="var(--paper)" opacity="0.7" />
      <rect x="20" y="32" width="18" height="2" fill="var(--paper)" opacity="0.7" />
      <rect x="20" y="40" width="24" height="2" fill="var(--accent)" />
      <rect x="20" y="46" width="14" height="2" fill="var(--paper)" opacity="0.7" />
    </svg>
  );
}
