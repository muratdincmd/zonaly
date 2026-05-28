import { useTranslation } from "react-i18next";

import { invoke } from "@tauri-apps/api/core";

import pkg from "../../package.json";
import { useScale } from "../hooks/useScale";

function ExternalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    void invoke("open_url", { url: href });
  };
  return (
    <a
      href={href}
      className={className}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleClick(e as unknown as React.MouseEvent);
      }}
      tabIndex={0}
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className="footer-gh-icon"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
        0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
        -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
        .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
        -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0
        1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
        1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01
        1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function AppFooter() {
  const { t } = useTranslation();
  const { scale, increase, decrease } = useScale();

  return (
    <footer className="app-footer">
      <div className="footer-inner">
      {/* Left: version + author */}
      <div className="footer-left">
        <ExternalLink
          href="https://github.com/muratdincmd/zonaly/releases"
          className="footer-link"
        >
          v{pkg.version}
        </ExternalLink>
        <span className="footer-sep">·</span>
        <ExternalLink
          href="https://github.com/muratdincmd"
          className="footer-link footer-author"
        >
          <GitHubIcon />
          muratdincmd
        </ExternalLink>
      </div>

      {/* Right: scale control */}
      <div className="scale-control" aria-label={t("footer.scaleLabel")}>
        <button
          type="button"
          className="scale-btn"
          onClick={decrease}
          disabled={scale <= 70}
          aria-label={t("footer.decrease")}
        >
          −
        </button>
        <span className="scale-value">{scale}%</span>
        <button
          type="button"
          className="scale-btn"
          onClick={increase}
          disabled={scale >= 150}
          aria-label={t("footer.increase")}
        >
          +
        </button>
      </div>
      </div>
    </footer>
  );
}
