import clsx from "clsx";

export function LogoMark({ className = "size-8" }) {
  return (
    <svg viewBox="0 0 64 64" className={clsx("shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id="sp-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3DDC84" />
          <stop offset="0.55" stopColor="#16B67A" />
          <stop offset="1" stopColor="#0E9E8A" />
        </linearGradient>
        <linearGradient id="sp-logo-fg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E3F7EF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#sp-logo-bg)" />
      <g transform="translate(32 35) scale(1.15) translate(-32 -35)">
        {/* Headset */}
        <path d="M14 32a18 18 0 0 1 36 0" fill="none" stroke="url(#sp-logo-fg)" strokeWidth="4.8" strokeLinecap="round" />
        <rect x="8.5" y="27.5" width="9" height="15" rx="4.5" fill="url(#sp-logo-fg)" />
        <rect x="46.5" y="27.5" width="9" height="15" rx="4.5" fill="url(#sp-logo-fg)" />
        {/* Speech bubble */}
        <path
          d="M31.5 21.5c9.1 0 16.2 5.6 16.2 12.6S40.6 46.7 31.5 46.7c-2 0-3.9-.3-5.6-.8l-8.3 4.5 2.4-7.6c-3-2.3-4.8-5.3-4.8-8.7 0-7 7.2-12.6 16.3-12.6Z"
          fill="url(#sp-logo-fg)"
          stroke="#17B27A"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="24.3" cy="34" r="2.5" fill="#12A06E" />
        <circle cx="31.5" cy="34" r="2.5" fill="#12A06E" />
        <circle cx="38.7" cy="34" r="2.5" fill="#12A06E" />
        {/* Navigation badge */}
        <circle cx="47" cy="47" r="10" fill="url(#sp-logo-fg)" stroke="#17B27A" strokeWidth="1.8" />
        <path d="M52.2 41.8 41.9 45.9l4.6 1.4 1.4 4.6Z" fill="#12A06E" stroke="#12A06E" strokeWidth="1.2" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function Logo({ collapsed = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className="size-8" />
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-ink">SupportPilot</div>
          <div className="text-[11px] font-medium text-muted">AI customer support</div>
        </div>
      )}
    </div>
  );
}
