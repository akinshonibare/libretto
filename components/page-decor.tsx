/**
 * Subtle abstract background — fixed behind every page, pointer-events: none.
 * Two layers:
 *   1. A faint paper-grain (SVG noise) for tactile texture.
 *   2. A handful of slow, hand-drawn-looking curves and ruler marks at
 *      ~5-7% opacity, drawn with currentColor so they tint with whichever
 *      palette is active.
 *
 * Stays subtle on purpose — the design system says "Moleskine, not CMS".
 * Not a gradient or full-bleed image; just enough to break the flat paper.
 */
export function PageDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden text-[var(--foreground)]"
    >
      {/* Paper grain — a small repeated noise tile for tactile texture. */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.025] mix-blend-multiply"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="libretto-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#libretto-grain)" />
      </svg>

      {/* Editorial flourishes — three regions, one per visual third of the page.
          Each uses currentColor at low opacity. Very subtle. */}
      <svg
        className="absolute -right-32 -top-24 h-[420px] w-[420px] opacity-[0.06]"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Slow, sweeping curves like ink-pen practice strokes */}
        <path
          d="M 20 320 C 80 200, 220 180, 340 80"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M 40 360 C 120 260, 260 240, 380 140"
          stroke="currentColor"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
        <circle cx="340" cy="80" r="3" fill="currentColor" />
        <circle cx="20" cy="320" r="2.5" fill="currentColor" />
      </svg>

      <svg
        className="absolute -left-24 top-[40%] h-[360px] w-[360px] opacity-[0.05]"
        viewBox="0 0 360 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* A loose spiral / arc cluster — nothing geometric, like a margin doodle */}
        <path
          d="M 80 100 Q 200 60, 280 180 T 200 320"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        {/* a few ruler tick marks suggesting notebook lines */}
        <g stroke="currentColor" strokeWidth="0.8" strokeLinecap="round">
          <line x1="20" y1="50" x2="60" y2="50" />
          <line x1="20" y1="70" x2="48" y2="70" />
          <line x1="20" y1="90" x2="60" y2="90" />
          <line x1="20" y1="110" x2="40" y2="110" />
        </g>
      </svg>

      <svg
        className="absolute -bottom-32 right-1/4 h-[480px] w-[480px] opacity-[0.045]"
        viewBox="0 0 480 480"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* A long, languid curve along the page-bottom — feels like marginalia */}
        <path
          d="M 0 360 C 120 280, 280 380, 480 220"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M 0 400 C 140 320, 300 420, 480 280"
          stroke="currentColor"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeDasharray="2 6"
        />
        <circle cx="480" cy="220" r="2.5" fill="currentColor" />
      </svg>
    </div>
  );
}
