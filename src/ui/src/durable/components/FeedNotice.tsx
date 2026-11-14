import { timeAgo } from "../format";

export function FeedNotice({
  label,
  loading,
  error,
  updatedAt,
  now,
  onRetry,
}: {
  label: string;
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
  now: number;
  onRetry: () => void;
}) {
  if (!loading && !error) return null;
  return (
    <div
      className={`feed-notice${error ? " stale" : ""}`}
      role={error ? "alert" : "status"}
    >
      <span>
        <strong>
          {error ? `${label} unavailable` : `Loading ${label.toLowerCase()}…`}
        </strong>
        {error ? (
          <span>
            {error}
            {updatedAt !== null
              ? ` Showing data from ${timeAgo(
                  new Date(updatedAt).toISOString(),
                  now
                )}.`
              : " No data loaded yet."}
          </span>
        ) : null}
      </span>
      {error ? (
        <button type="button" className="btn ghost small" onClick={onRetry}>
          Retry {label.toLowerCase()}
        </button>
      ) : null}
    </div>
  );
}
