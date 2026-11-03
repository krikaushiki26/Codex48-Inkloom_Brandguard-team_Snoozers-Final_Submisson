
import { useState } from "react";

import "./App.css";
import api from "./api.js";

import Auth from "./Auth.jsx";
import BrandRules from "./BrandRules.jsx";
import ReviewQueue from "./ReviewQueue.jsx";
import History from "./History.jsx";
import AdminPanel from "./AdminPanel.jsx";
import Analytics from "./Analytics.jsx";

const pageTitles = {
  Checker: "Content Checker",
  "Brand Rules": "Brand Rules Library",
  "Review Queue": "Human Review Queue",
  History: "Review History",
  Analytics: "Brand Risk Analytics",
  Admin: "Administrator Panel",
};

function App() {
  const [user, setUser] = useState(() => {
    try {
      const token = sessionStorage.getItem("inkloom_token");
      const savedUser = sessionStorage.getItem("inkloom_user");

      if (!token || !savedUser) {
        sessionStorage.removeItem("inkloom_user");
        sessionStorage.removeItem("inkloom_token");
        return null;
      }

      const parsedUser = JSON.parse(savedUser);

      if (!parsedUser || !parsedUser.id || !parsedUser.role) {
        sessionStorage.removeItem("inkloom_user");
        sessionStorage.removeItem("inkloom_token");
        return null;
      }

      return parsedUser;
    } catch (error) {
      console.error("Unable to restore login session:", error);
      sessionStorage.removeItem("inkloom_user");
      sessionStorage.removeItem("inkloom_token");
      return null;
    }
  });

  const [content, setContent] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activePage, setActivePage] = useState("Checker");
  const [submitting, setSubmitting] = useState(false);

  function handleLogin(loginData) {
    const loggedInUser = loginData?.user || loginData;

    if (!loggedInUser || !loggedInUser.id || !loggedInUser.role) {
      setError("Login information is incomplete. Please sign in again.");
      return;
    }

    sessionStorage.setItem("inkloom_user", JSON.stringify(loggedInUser));

    setUser(loggedInUser);
    setActivePage("Checker");
    setError("");
    setMessage("");
    setContent("");
    setResult(null);
  }

  function logOut() {
    sessionStorage.removeItem("inkloom_token");
    sessionStorage.removeItem("inkloom_user");

    setUser(null);
    setContent("");
    setResult(null);
    setError("");
    setMessage("");
    setActivePage("Checker");
  }

  async function checkContent(event) {
    event.preventDefault();

    if (!content.trim()) {
      setError("Please enter some content to check.");
      return;
    }

    setError("");
    setMessage("");
    setResult(null);
    setSubmitting(true);

    try {
      const response = await api.post("/content/check", {
        content: content.trim(),
      });

      setResult(response.data);
    } catch (err) {
      console.error("Content checking error:", err);

      setError(
        err.response?.data?.detail ||
          "Unable to check content. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitForReview() {
    if (!content.trim()) {
      setError("Please enter content before submitting.");
      return;
    }

    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      await api.post("/reviews", {
        content: content.trim(),
      });

      setMessage("Your content has been submitted for human review.");
      setContent("");
      setResult(null);
      setActivePage("History");
    } catch (err) {
      console.error("Review submission error:", err);

      setError(
        err.response?.data?.detail ||
          "Unable to submit your content for review."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  const canAccessReviewQueue = [
    "reviewer",
    "manager",
    "admin",
  ].includes(user.role);

  const canAccessAnalytics = ["manager", "admin"].includes(user.role);
  const canAccessAdmin = user.role === "admin";

  const safeActivePage =
    (activePage === "Review Queue" && !canAccessReviewQueue) ||
    (activePage === "Admin" && !canAccessAdmin) ||
    (activePage === "Analytics" && !canAccessAnalytics)
      ? "Checker"
      : activePage;

  const navigation = [
    { name: "Checker", label: "Content Checker", icon: "✦" },
    { name: "Brand Rules", label: "Brand Rules", icon: "◇" },

    ...(canAccessReviewQueue
      ? [{ name: "Review Queue", label: "Review Queue", icon: "▤" }]
      : []),

    { name: "History", label: "Review History", icon: "↻" },

    ...(canAccessAnalytics
      ? [{ name: "Analytics", label: "Brand Analytics", icon: "▥" }]
      : []),

    ...(canAccessAdmin
      ? [{ name: "Admin", label: "Admin Panel", icon: "⚙" }]
      : []),
  ];

  const score = Number.isFinite(Number(result?.score))
    ? Math.max(0, Math.min(100, Number(result.score)))
    : null;

  const scoreColor =
    score === null
      ? "#aab5a7"
      : score >= 80
        ? "#287447"
        : score >= 50
          ? "#c18a30"
          : "#b64040";

  const flags = Array.isArray(result?.flags) ? result.flags : [];

  const groupedFlags = {
    high: flags.filter((flag) => flag.severity?.toLowerCase() === "high"),
    medium: flags.filter((flag) => flag.severity?.toLowerCase() === "medium"),
    low: flags.filter((flag) => !["high", "medium"].includes(flag.severity?.toLowerCase())),
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">I</div>
          <div>
            <h1>Inkloom</h1>
            <p>BRANDGUARD</p>
          </div>
        </div>

        <p className="sidebar-section-label">WORKSPACE</p>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.name}
              type="button"
              className={
                safeActivePage === item.name
                  ? "nav-button active"
                  : "nav-button"
              }
              onClick={() => {
                setActivePage(item.name);
                setError("");
                setMessage("");
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {(user.name || "U").charAt(0).toUpperCase()}
          </div>

          <div className="sidebar-user-details">
            <strong>{user.name || "User"}</strong>
            <span>{user.role}</span>
          </div>

          <button
            type="button"
            className="logout-button"
            onClick={logOut}
            title="Log out"
          >
            ↗
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="topbar-eyebrow">INKLOOM BRANDGUARD / WORKSPACE</p>
            <h2>{pageTitles[safeActivePage]}</h2>
          </div>

          <span className="role-label">
            {user.role}
          </span>
        </header>

        <div className="page-content">
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          {message && (
            <div className="success-message" role="status">
              {message}
            </div>
          )}

          {safeActivePage === "Checker" && (
            <section className="checker-page">
              <div className="checker-intro">
                <div>
                  <p className="eyebrow">AI-POWERED BRAND PROTECTION</p>
                  <h1>Make every word <span>on-brand.</span></h1>
                  <p>
                    Check your content against approved brand guidelines
                    before it reaches your audience.
                  </p>
                </div>

                <div className="checker-intro-mark">✳</div>
              </div>

              <form className="checker-form" onSubmit={checkContent}>
                <div className="editor-heading">
                  <div>
                    <h3>Content workspace</h3>
                    <p>Paste the text you want Inkloom to analyse.</p>
                  </div>

                  <span className="editor-tag">MAX 20,000 CHARACTERS</span>
                </div>

                <label htmlFor="content-input">Your content</label>

                <textarea
                  id="content-input"
                  value={content}
                  onChange={(event) => {
                    setContent(event.target.value);
                    setResult(null);
                    setError("");
                  }}
                  placeholder="Start writing or paste your marketing copy here..."
                  rows={10}
                  maxLength={20000}
                  required
                />

                <div className="checker-actions">
                  <span>{content.length.toLocaleString()}/20,000 characters</span>

                  <button
                    className="check-button"
                    type="submit"
                    disabled={submitting || !content.trim()}
                  >
                    {submitting ? "Analysing..." : "✦  Check my content"}
                  </button>
                </div>
              </form>

              <div className="checker-trust-note">
                <span>✓</span>
                Your content is checked against your approved brand rules.
                Final publishing decisions remain with your team.
              </div>

              {result && (
                <section className="checker-results">
                  <div className="results-heading">
                    <div>
                      <p className="eyebrow">ANALYSIS REPORT</p>
                      <h2>Check results</h2>
                      <p>Here is what Inkloom found in your content.</p>
                    </div>

                    <span className="results-count">
                      {flags.length} {flags.length === 1 ? "issue" : "issues"} found
                    </span>
                  </div>

                  <div className="results-overview">
                    <div className="score-card">
                      <div
                        className="score-ring"
                        style={{
                          background: `conic-gradient(${scoreColor} ${score ?? 0}%, #e9eee5 ${score ?? 0}% 100%)`,
                        }}
                      >
                        <div className="score-ring-inner">
                          <strong>{score === null ? "—" : score}</strong>
                          <span>OUT OF 100</span>
                        </div>
                      </div>

                      <div>
                        <h3>Compliance score</h3>
                        <p>
                          {score === null
                            ? "Score unavailable."
                            : score >= 80
                              ? "Your content looks largely aligned."
                              : score >= 50
                                ? "Some improvements are recommended."
                                : "Several issues need attention."}
                        </p>
                      </div>
                    </div>

                    <div className="issue-summary">
                      <div>
                        <span className="issue-dot high-dot" />
                        <span>High severity</span>
                        <strong>{groupedFlags.high.length}</strong>
                      </div>
                      <div>
                        <span className="issue-dot medium-dot" />
                        <span>Medium severity</span>
                        <strong>{groupedFlags.medium.length}</strong>
                      </div>
                      <div>
                        <span className="issue-dot low-dot" />
                        <span>Low severity</span>
                        <strong>{groupedFlags.low.length}</strong>
                      </div>
                    </div>
                  </div>

                  <div
                    className={
                      result.ai_enabled
                        ? "ai-status ai-status-success"
                        : "ai-status ai-status-warning"
                    }
                  >
                    <span>{result.ai_enabled ? "✦" : "!"}</span>
                    <div>
                      <strong>
                        {result.ai_enabled
                          ? "AI-powered analysis completed"
                          : "Rule-based analysis completed"}
                      </strong>
                      <p>
                        {result.ai_enabled
                          ? "Groq AI and your approved brand rules were used for this analysis."
                          : "AI analysis is unavailable. Results are based on configured rules only."}
                      </p>
                    </div>
                  </div>

                  {flags.length > 0 ? (
                    <div className="flag-groups">
                      {[
                        ["high", "High severity", "Needs immediate attention"],
                        ["medium", "Medium severity", "Review before publishing"],
                        ["low", "Low severity", "Suggestions for improvement"],
                      ].map(([level, heading, description]) =>
                        groupedFlags[level].length > 0 ? (
                          <div className="flag-group" key={level}>
                            <div className="flag-group-heading">
                              <div>
                                <h3>{heading}</h3>
                                <p>{description}</p>
                              </div>
                              <span className={`severity-count ${level}`}>
                                {groupedFlags[level].length}
                              </span>
                            </div>

                            {groupedFlags[level].map((flag, index) => (
                              <article
                                className={`flag-card redesigned-flag ${level}`}
                                key={`${flag.rule_id ?? "rule"}-${index}`}
                              >
                                <div className="flag-title-row">
                                  <h4>{flag.rule_title || "Content issue"}</h4>
                                  <span className={`severity-label ${level}`}>
                                    {flag.severity || "Needs review"}
                                  </span>
                                </div>

                                <p>
                                  <strong>Issue</strong>
                                  {flag.message || flag.issue_type || "Review needed"}
                                </p>

                                {flag.matched_text && (
                                  <p>
                                    <strong>Matched text</strong>
                                    <span className="matched-text">
                                      {flag.matched_text}
                                    </span>
                                  </p>
                                )}

                                {(flag.suggested_fix || flag.suggestion) && (
                                  <div className="suggestion-box">
                                    <strong>Suggested improvement</strong>
                                    <p>{flag.suggested_fix || flag.suggestion}</p>
                                  </div>
                                )}

                                {(flag.approved_source || flag.source) && (
                                  <p className="source-line">
                                    <strong>Approved source:</strong>{" "}
                                    {flag.approved_source || flag.source}
                                  </p>
                                )}

                                {flag.needs_human_review && (
                                  <p className="human-review-label">
                                    ↗ Human review recommended
                                  </p>
                                )}
                              </article>
                            ))}
                          </div>
                        ) : null
                      )}
                    </div>
                  ) : (
                    <div className="no-issues">
                      <span>✓</span>
                      <div>
                        <h3>No issues detected</h3>
                        <p>
                          No issues were returned by the configured checks.
                          This does not guarantee complete compliance.
                        </p>
                      </div>
                    </div>
                  )}

                  {result.note && (
                    <p className="results-disclaimer">{result.note}</p>
                  )}

                  <div className="review-submit-panel">
                    <div>
                      <h3>Need a human opinion?</h3>
                      <p>
                        Send this content to your review team for a final decision.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="review-submit-button"
                      onClick={submitForReview}
                      disabled={submitting || !content.trim()}
                    >
                      {submitting ? "Submitting..." : "Submit for Human Review"}
                    </button>
                  </div>
                </section>
              )}
            </section>
          )}

          {safeActivePage === "Brand Rules" && <BrandRules />}

          {safeActivePage === "Review Queue" &&
            canAccessReviewQueue && <ReviewQueue />}

          {safeActivePage === "History" && <History />}

          {safeActivePage === "Analytics" &&
            canAccessAnalytics && <Analytics />}

          {safeActivePage === "Admin" &&
            canAccessAdmin && <AdminPanel />}
        </div>
      </main>
    </div>
  );
}

export default App;
