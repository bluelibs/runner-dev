import { timeAgo } from "../format";

export interface FeedNoticeState {
  label: string;
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
  onRetry: () => void;
}

export function FeedNotices({
  feeds,
  now,
}: {
  feeds: FeedNoticeState[];
  now: number;
}) {
  const active = feeds.filter((feed) => feed.loading || feed.error);
  const failed = active.filter((feed) => feed.error);
  const notices = active.map((feed) => (
    <FeedNotice key={feed.label} {...feed} now={now} />
  ));
  if (failed.length < 2) return <>{notices}</>;
  return (
    <details className="feed-errors">
      <summary>
        <span className="feed-errors-summary">
          <strong role="alert">{failed.length} feeds unavailable</strong>
          <span>{failed.map((feed) => feed.label).join(" · ")}</span>
        </span>
        <span className="feed-errors-toggle" aria-hidden="true">
          <span className="feed-errors-show">View details</span>
          <span className="feed-errors-hide">Hide details</span>
        </span>
      </summary>
      <div className="feed-errors-body">{notices}</div>
    </details>
  );
}

export function FeedNotice({
  label,
  loading,
  error,
  updatedAt,
  now,
  onRetry,
}: FeedNoticeState & { now: number }) {
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
