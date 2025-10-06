import React from "react";

export interface CoverageData {
  percentage?: number | null;
  totalStatements?: number | null;
  coveredStatements?: number | null;
  details?: string | null;
}

export interface CoverageVisualizationProps {
  coverage: CoverageData | null | undefined;
  filePath?: string | null;
  compact?: boolean;
}

export const CoverageVisualization: React.FC<CoverageVisualizationProps> = ({
  coverage,
  filePath,
  compact = false,
}) => {
  if (!coverage) {
    return (
      <div className="coverage-visualization coverage-visualization--no-data">
        <span className="coverage-visualization__label">No coverage data available</span>
      </div>
    );
  }

  const percentage = coverage.percentage ?? 0;
  const totalStatements = coverage.totalStatements ?? 0;
  const coveredStatements = coverage.coveredStatements ?? 0;

  const getCoverageColor = (pct: number): string => {
    if (pct >= 100) return "#2e7d32"; // green
    if (pct >= 80) return "#ef6c00"; // orange
    return "#c62828"; // red
  };

  const getCoverageLevel = (pct: number): string => {
    if (pct >= 100) return "excellent";
    if (pct >= 80) return "good";
    if (pct >= 50) return "partial";
    return "low";
  };

  const coverageColor = getCoverageColor(percentage);
  const coverageLevel = getCoverageLevel(percentage);

  if (compact) {
    return (
      <div className="coverage-visualization coverage-visualization--compact">
        <div className="coverage-visualization__percentage-compact">
          <span
            className="coverage-visualization__percentage-text"
            style={{ color: coverageColor }}
          >
            {percentage}%
          </span>
        </div>
        <div className="coverage-visualization__bar-container">
          <div
            className="coverage-visualization__bar coverage-visualization__bar--covered"
            style={{
              width: `${percentage}%`,
              backgroundColor: coverageColor
            }}
          />
        </div>
        <span className="coverage-visualization__statements-compact">
          {coveredStatements}/{totalStatements}
        </span>
      </div>
    );
  }

  return (
    <div className={`coverage-visualization coverage-visualization--${coverageLevel}`}>
      <div className="coverage-visualization__header">
        <h4 className="coverage-visualization__title">Code Coverage</h4>
        {filePath && (
          <div className="coverage-visualization__file-path">{filePath}</div>
        )}
      </div>

      <div className="coverage-visualization__main">
        <div className="coverage-visualization__percentage-section">
          <div
            className="coverage-visualization__percentage-circle"
            style={{
              borderColor: coverageColor,
              color: coverageColor
            }}
          >
            <span className="coverage-visualization__percentage-text">
              {percentage}%
            </span>
          </div>
          <div className="coverage-visualization__level">
            {coverageLevel.charAt(0).toUpperCase() + coverageLevel.slice(1)} Coverage
          </div>
        </div>

        <div className="coverage-visualization__details">
          <div className="coverage-visualization__metric">
            <span className="coverage-visualization__metric-label">
              Statements Covered:
            </span>
            <span className="coverage-visualization__metric-value">
              {coveredStatements} / {totalStatements}
            </span>
          </div>

          <div className="coverage-visualization__metric">
            <span className="coverage-visualization__metric-label">
              Statements Missed:
            </span>
            <span className="coverage-visualization__metric-value">
              {totalStatements - coveredStatements}
            </span>
          </div>

          <div className="coverage-visualization__progress-section">
            <div className="coverage-visualization__progress-label">
              Coverage Progress
            </div>
            <div className="coverage-visualization__progress-bar">
              <div
                className="coverage-visualization__progress-fill"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: coverageColor
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {coverage.details && (
        <details className="coverage-visualization__raw-details">
          <summary className="coverage-visualization__raw-details-toggle">
            Raw Coverage Data
          </summary>
          <pre className="coverage-visualization__raw-details-content">
            {coverage.details}
          </pre>
        </details>
      )}
    </div>
  );
};