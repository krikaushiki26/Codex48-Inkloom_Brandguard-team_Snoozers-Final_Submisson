
import { useEffect, useState } from "react";
import api from "./api.js";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = [
  "#23866b",
  "#e6a23c",
  "#d9534f",
  "#7586a8",
];

function MetricCard({ title, value, description }) {
  return (
    <div className="analytics-metric-card">
      <p className="analytics-metric-title">{title}</p>
      <h2>{value}</h2>
      <small>{description}</small>
    </div>
  );
}

function Analytics() {
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [violations, setViolations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  async function loadAnalytics() {
    setLoading(true);
    setError("");

    try {
      const [
        summaryResponse,
        trendsResponse,
        violationsResponse,
      ] = await Promise.all([
        api.get("/analytics/summary"),
        api.get("/analytics/trends"),
        api.get("/analytics/violations"),
      ]);

      setSummary(summaryResponse.data);
      setTrends(trendsResponse.data);
      setViolations(violationsResponse.data);

    } catch (err) {
      console.error("Analytics loading failed:", err);

      setError(
        err.response?.data?.detail ||
        "Could not load analytics. Please check your access and backend connection."
      );

    } finally {
      setLoading(false);
    }
  }

  async function downloadReport() {
    setDownloading(true);
    setError("");

    try {
      const response = await api.get(
        "/analytics/report.csv",
        {
          responseType: "blob",
        }
      );

      const file = new Blob(
        [response.data],
        { type: "text/csv" }
      );

      const url = window.URL.createObjectURL(file);
      const link = document.createElement("a");

      link.href = url;
      link.download = "inkloom_brandguard_analytics.csv";

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Report download failed:", err);

      setError(
        err.response?.data?.detail ||
        "Could not download the analytics report."
      );

    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="analytics-page">
        <p>Loading Brand Risk Analytics...</p>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="analytics-page">
        <h2>Brand Risk Analytics</h2>

        <p className="error-message" role="alert">
          {error}
        </p>

        <button
          type="button"
          onClick={loadAnalytics}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="analytics-page">
        <h2>Brand Risk Analytics</h2>
        <p>No analytics data is available.</p>
      </div>
    );
  }

  const reviews = summary.reviews || {};

  const riskScore = summary.average_risk_score;
  const riskLevel = summary.risk_level || "Not available";

  const reviewData = [
    {
      name: "Pending",
      value: reviews.pending || 0,
    },
    {
      name: "Approved",
      value: reviews.approved || 0,
    },
    {
      name: "Changes requested",
      value: reviews.changes_requested || 0,
    },
    {
      name: "Rejected",
      value: reviews.rejected || 0,
    },
  ].filter((item) => item.value > 0);

  const severityData = [
    {
      name: "High",
      count: summary.high_severity_flags || 0,
    },
    {
      name: "Medium",
      count: summary.medium_severity_flags || 0,
    },
    {
      name: "Low",
      count: summary.low_severity_flags || 0,
    },
  ];

  const riskColor =
    riskLevel === "Low"
      ? "#23866b"
      : riskLevel === "Moderate"
      ? "#e6a23c"
      : riskLevel === "High"
      ? "#d97732"
      : riskLevel === "Critical"
      ? "#d9534f"
      : "#7586a8";

  return (
    <div className="analytics-page">

      {/* HEADER */}

      <div className="analytics-header">
        <div>
          <h2>Brand Risk Analytics</h2>

          <p>
            Monitor content compliance, brand violations
            and human review performance.
          </p>
        </div>

        <div className="analytics-header-actions">
          <button
            type="button"
            onClick={loadAnalytics}
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={downloadReport}
            disabled={downloading}
          >
            {downloading
              ? "Downloading..."
              : "Download CSV Report"}
          </button>
        </div>
      </div>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {/* MAIN METRICS */}

      <div className="analytics-metrics-grid">

        <MetricCard
          title="Total Content Checks"
          value={summary.total_checks}
          description="Saved compliance checks"
        />

        <MetricCard
          title="Average Compliance"
          value={
            summary.average_compliance_score === null
              ? "N/A"
              : `${summary.average_compliance_score}/100`
          }
          description="Average compliance score"
        />

        <MetricCard
          title="High Severity Flags"
          value={summary.high_severity_flags}
          description="High-priority violations"
        />

        <MetricCard
          title="AI-Enabled Checks"
          value={summary.ai_enabled_checks}
          description="Successful AI analysis requests"
        />

      </div>

      {/* BRAND RISK SCORE */}

      <section className="analytics-section">
        <h3>Brand Risk Score</h3>

        <p>
          An overall risk indicator calculated from
          the average compliance score.
        </p>

        <div className="analytics-metrics-grid">

          <div className="analytics-metric-card">
            <p className="analytics-metric-title">
              Average Risk Score
            </p>

            <h2>
              {riskScore === null || riskScore === undefined
                ? "N/A"
                : `${riskScore}/100`}
            </h2>

            <small>
              Higher scores indicate greater risk.
            </small>
          </div>

          <div className="analytics-metric-card">
            <p className="analytics-metric-title">
              Overall Risk Level
            </p>

            <h2 style={{ color: riskColor }}>
              {riskLevel}
            </h2>

            <small>
              Based on average risk score.
            </small>
          </div>

        </div>
      </section>

      {/* COMPLIANCE AND RISK TRENDS */}

      <section className="analytics-section">
        <h3>Compliance and Risk Trends</h3>

        <p>
          Monthly average compliance and brand risk scores.
        </p>

        {trends.length === 0 ? (
          <p className="analytics-empty">
            No historical check data available yet.
          </p>
        ) : (
          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis dataKey="month" />

                <YAxis domain={[0, 100]} />

                <Tooltip />

                <Legend />

                <Line
                  type="monotone"
                  dataKey="average_score"
                  name="Compliance Score"
                  stroke="#23866b"
                  strokeWidth={3}
                  activeDot={{ r: 7 }}
                />

                <Line
                  type="monotone"
                  dataKey="average_risk_score"
                  name="Brand Risk Score"
                  stroke="#d9534f"
                  strokeWidth={3}
                  activeDot={{ r: 7 }}
                />

              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* COMMON VIOLATIONS AND SEVERITY */}

      <div className="analytics-charts-grid">

        <section className="analytics-section">
          <h3>Common Brand Violations</h3>

          {violations.length === 0 ? (
            <p className="analytics-empty">
              No violations recorded yet.
            </p>
          ) : (
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={violations}
                  layout="vertical"
                  margin={{ left: 20, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis type="number" />

                  <YAxis
                    type="category"
                    dataKey="issue_type"
                    width={130}
                  />

                  <Tooltip />

                  <Bar
                    dataKey="count"
                    name="Detected"
                    fill="#23866b"
                    radius={[0, 5, 5, 0]}
                  />

                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="analytics-section">
          <h3>Violation Severity</h3>

          {severityData.every((item) => item.count === 0) ? (
            <p className="analytics-empty">
              No severity data recorded yet.
            </p>
          ) : (
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={severityData}>
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis dataKey="name" />

                  <YAxis allowDecimals={false} />

                  <Tooltip />

                  <Bar
                    dataKey="count"
                    name="Violations"
                    fill="#23866b"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

      </div>

      {/* HUMAN REVIEW PERFORMANCE */}

      <section className="analytics-section">
        <h3>Human Review Performance</h3>

        <p>
          Overview of approval decisions and pending submissions.
        </p>

        <div className="analytics-review-summary">

          <MetricCard
            title="Approval Rate"
            value={`${summary.approval_rate ?? 0}%`}
            description="Percentage of processed reviews approved"
          />

          <MetricCard
            title="Rejection Rate"
            value={`${summary.rejection_rate ?? 0}%`}
            description="Percentage of processed reviews rejected"
          />

          <MetricCard
            title="Processed Reviews"
            value={summary.processed_reviews ?? 0}
            description="Reviews with a final decision"
          />

          <MetricCard
            title="Changes Requested"
            value={summary.changes_requested ?? 0}
            description="Submissions returned for corrections"
          />

        </div>

        <div className="analytics-review-summary">

          <MetricCard
            title="Total Reviews"
            value={summary.total_reviews}
            description="All submitted reviews"
          />

          <MetricCard
            title="Approved"
            value={reviews.approved || 0}
            description="Approved submissions"
          />

          <MetricCard
            title="Pending"
            value={reviews.pending || 0}
            description="Awaiting review"
          />

          <MetricCard
            title="Rejected"
            value={reviews.rejected || 0}
            description="Rejected submissions"
          />

        </div>

        {reviewData.length > 0 && (
          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={reviewData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {reviewData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>

                <Tooltip />

                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {reviewData.length === 0 && (
          <p className="analytics-empty">
            No human reviews have been submitted yet.
          </p>
        )}

      </section>

      {/* DISCLAIMER */}

      <p className="analytics-disclaimer">
        Brand Risk Score is calculated as 100 minus the
        compliance score. It is an indicative metric,
        not a calibrated probability of brand risk.
        AI analysis is counted only when an AI request succeeds.
        Approval and rejection rates use processed reviews only.
        Human review remains important.
      </p>

    </div>
  );
}

export default Analytics;
