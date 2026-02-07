import React from "react";
import type { LineCoverage } from "../../../../resources/coverage.resource";

export interface CoverageData {
  percentage?: number | null;
  totalStatements?: number | null;
  coveredStatements?: number | null;
  details?: string | null;
  lines?: LineCoverage[];
}

export interface CoverageVisualizationProps {
  coverage: CoverageData | null | undefined;
  filePath?: string | null;
  compact?: boolean;
}

const getCoverageColor = (percentage: number) => {
  if (percentage >= 100) return "#66bb6a"; // Lighter green for dark theme
  if (percentage >= 80) return "#ffa726"; // Lighter orange for dark theme
  return "#ef5350"; // Lighter red for dark theme
};

const getCoverageLevel = (percentage: number) => {
  if (percentage >= 100) return { label: "excellent", icon: "✓" };
  if (percentage >= 80) return { label: "good", icon: "○" };
  if (percentage >= 50) return { label: "partial", icon: "◐" };
  return { label: "low", icon: "✗" };
};

export const CoverageVisualization: React.FC<CoverageVisualizationProps> = ({
  coverage,
  filePath,
  compact = false,
}) => {
  if (!coverage) {
    return (
      <div className="coverage-visualization coverage-visualization--no-data">
        <div className="coverage-visualization__no-data-icon">📊</div>
        <span className="coverage-visualization__label">
          No coverage data available
        </span>
      </div>
    );
  }

  const percentage = coverage.percentage ?? 0;
  const totalStatements = coverage.totalStatements ?? 0;
  const coveredStatements = coverage.coveredStatements ?? 0;
  const lines = coverage.lines || [];
  const coverageColor = getCoverageColor(percentage);
  const coverageLevel = getCoverageLevel(percentage);

  const coveredLines = lines.filter((line) => line.covered).length;

  if (compact) {
    return (
      <div className="coverage-visualization coverage-visualization--compact">
        <div className="coverage-visualization__percentage-compact">
          <span>{coverageLevel.icon}</span>
          <span style={{ color: coverageColor }}>{percentage}%</span>
        </div>
        <div className="coverage-visualization__bar-container">
          <div className="coverage-visualization__bar-backdrop">
            <div
              className="coverage-visualization__bar"
              style={{
                width: `${percentage}%`,
                backgroundColor: coverageColor,
              }}
            />
          </div>
        </div>
        <span className="coverage-visualization__statements-compact">
          {coveredLines}/{lines.length} lines
        </span>
      </div>
    );
  }

  return (
    <div className="coverage-visualization">
      <div className="coverage-visualization__header">
        <h4 className="coverage-visualization__title">
          <span className="coverage-visualization__title-icon">
            {coverageLevel.icon}
          </span>
          Code Coverage
        </h4>
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
              color: coverageColor,
              backgroundColor: `${coverageColor}15`,
            }}
          >
            <span className="coverage-visualization__percentage-text">
              {percentage}%
            </span>
            <div className="coverage-visualization__percentage-label">
              {coverageLevel.label.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="coverage-visualization__details">
          <div className="coverage-visualization__metrics-grid">
            <div className="coverage-visualization__metric coverage-visualization__metric--primary">
              <div className="coverage-visualization__metric-header">
                <span className="coverage-visualization__metric-icon">✓</span>
                <span className="coverage-visualization__metric-label">
                  Covered
                </span>
              </div>
              <span className="coverage-visualization__metric-value">
                {coveredStatements}
              </span>
            </div>

            <div className="coverage-visualization__metric coverage-visualization__metric--danger">
              <div className="coverage-visualization__metric-header">
                <span className="coverage-visualization__metric-icon">✗</span>
                <span className="coverage-visualization__metric-label">
                  Missed
                </span>
              </div>
              <span className="coverage-visualization__metric-value">
                {totalStatements - coveredStatements}
              </span>
            </div>

            {lines.length > 0 && (
              <>
                <div className="coverage-visualization__metric">
                  <div className="coverage-visualization__metric-header">
                    <span className="coverage-visualization__metric-icon">
                      L
                    </span>
                    <span className="coverage-visualization__metric-label">
                      Lines
                    </span>
                  </div>
                  <span className="coverage-visualization__metric-value">
                    {coveredLines}/{lines.length}
                  </span>
                </div>

                <div className="coverage-visualization__metric">
                  <div className="coverage-visualization__metric-header">
                    <span className="coverage-visualization__metric-icon">
                      T
                    </span>
                    <span className="coverage-visualization__metric-label">
                      Total
                    </span>
                  </div>
                  <span className="coverage-visualization__metric-value">
                    {totalStatements}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="coverage-visualization__progress-section">
            <div className="coverage-visualization__progress-label">
              Coverage Progress
            </div>
            <div className="coverage-visualization__progress-bar">
              <div className="coverage-visualization__progress-backdrop">
                <div
                  className="coverage-visualization__progress-fill"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: coverageColor,
                  }}
                />
              </div>
              <div className="coverage-visualization__progress-percentage">
                {percentage}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {lines.length > 0 && (
        <div className="coverage-visualization__line-details">
          <div className="coverage-visualization__line-details-header">
            <span>Line Coverage</span>
            <span className="coverage-visualization__line-summary">
              {coveredLines}/{lines.length} lines
            </span>
          </div>
          <div className="coverage-visualization__lines-grid">
            {lines.slice(0, 20).map((line) => (
              <div
                key={line.line}
                className={`coverage-visualization__line ${
                  line.covered
                    ? "coverage-visualization__line--covered"
                    : "coverage-visualization__line--uncovered"
                }`}
                title={`Line ${line.line}: ${line.hits} hits`}
              >
                <span className="coverage-visualization__line-number">
                  {line.line}
                </span>
                <span className="coverage-visualization__line-status">
                  {line.covered ? "✓" : "✗"}
                </span>
                <span className="coverage-visualization__line-hits">
                  {line.hits}
                </span>
              </div>
            ))}
            {lines.length > 20 && (
              <div className="coverage-visualization__lines-more">
                +{lines.length - 20} more
              </div>
            )}
          </div>
        </div>
      )}

      {coverage.details && (
        <details className="coverage-visualization__raw-details">
          <summary className="coverage-visualization__raw-details-toggle">
            Raw Data
          </summary>
          <div className="coverage-visualization__raw-details-content">
            <pre>{coverage.details}</pre>
          </div>
        </details>
      )}
    </div>
  );
};
