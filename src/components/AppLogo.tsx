export function AppLogo() {
  return (
    <div className="app-logo" aria-label="Zonaly">
      {/* Icon mark — mirrors scripts/icon.svg at small scale */}
      <svg
        className="app-logo-icon"
        viewBox="0 0 1024 1024"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="logo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4338ca" />
          </linearGradient>
        </defs>
        <rect width="1024" height="1024" rx="224" ry="224" fill="url(#logo-bg)" />
        {/* Globe arcs */}
        <ellipse cx="512" cy="512" rx="270" ry="270"
          fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="22" />
        <ellipse cx="512" cy="512" rx="270" ry="112"
          fill="none" stroke="rgba(255,255,255,0.11)" strokeWidth="18" />
        <ellipse cx="512" cy="512" rx="112" ry="270"
          fill="none" stroke="rgba(255,255,255,0.11)" strokeWidth="18" />
        {/* Z lettermark */}
        <g fill="none" stroke="white" strokeWidth="82"
           strokeLinecap="round" strokeLinejoin="round">
          <line x1="310" y1="312" x2="714" y2="312" />
          <line x1="714" y1="312" x2="310" y2="712" />
          <line x1="310" y1="712" x2="714" y2="712" />
        </g>
      </svg>

      {/* Wordmark: "Zon" normal + "aly" accented */}
      <span className="app-logo-wordmark">
        <span className="app-logo-zon">Zon</span>
        <span className="app-logo-aly">aly</span>
      </span>
    </div>
  );
}
