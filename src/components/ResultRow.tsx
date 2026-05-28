import type { DomainResult } from "../types/domain";

interface Props {
  result: DomainResult;
  onClick?: (result: DomainResult) => void;
}

export function ResultRow({ result, onClick }: Props) {
  const kind = result.status.kind;
  const clickable = kind === "taken" && !!onClick;

  return (
    <div
      className={`row row-${kind}`}
      onClick={clickable ? () => onClick(result) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(result);
              }
            }
          : undefined
      }
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <span className={`dot dot-${kind}`} />
      <span className="domain">
        {result.name}.{result.tld}
      </span>
      {result.status.kind === "error" && (
        <span className="error-msg">{result.status.message}</span>
      )}
    </div>
  );
}
