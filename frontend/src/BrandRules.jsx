
import { useState } from "react";
import api from "./api";

function BrandRules() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ruleType, setRuleType] = useState("forbidden_phrase");
  const [approvedSource, setApprovedSource] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rules, setRules] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function loadRules() {
    setError("");
    setLoading(true);

    try {
      const response = await api.get("/rules");

      if (!Array.isArray(response.data)) {
        throw new Error("Unexpected response from the server.");
      }

      setRules(response.data);
      setLoaded(true);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.message ||
        "Could not load rules."
      );
    } finally {
      setLoading(false);
    }
  }

  async function addRule(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (saving) return;

    setSaving(true);

    try {
      await api.post("/rules", {
        title: title.trim(),
        description: description.trim(),
        rule_type: ruleType,
        approved_source: approvedSource.trim()
      });

      setMessage("Brand rule added successfully!");

      setTitle("");
      setDescription("");
      setRuleType("forbidden_phrase");
      setApprovedSource("");

      await loadRules();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        "Could not add the rule. Manager access may be required."
      );
    } finally {
      setSaving(false);
    }
  }

  function formatRuleType(type) {
    const labels = {
      forbidden_phrase: "Forbidden Phrase",
      required_phrase: "Required Phrase",
      claim: "Claim Verification",
      tone: "Brand Tone"
    };

    return labels[type] || type;
  }

  return (
    <div className="brand-rules-page">
      <h2>Brand Rules</h2>

      <p>
        Manage approved rules that help protect your brand voice.
      </p>

      <form onSubmit={addRule} className="rule-form">
        <label>Rule Title</label>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Example: Avoid guaranteed claims"
          minLength={3}
          maxLength={200}
          required
        />

        <label>Rule Description</label>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the words or behaviour to check"
          minLength={5}
          required
        />

        <label>Rule Type</label>

        <select
          value={ruleType}
          onChange={(e) => setRuleType(e.target.value)}
        >
          <option value="forbidden_phrase">
            Forbidden Phrase
          </option>

          <option value="required_phrase">
            Required Phrase
          </option>

          <option value="claim">
            Claim Verification
          </option>

          <option value="tone">
            Brand Tone
          </option>
        </select>

        <label>Approved Source</label>

        <textarea
          value={approvedSource}
          onChange={(e) => setApprovedSource(e.target.value)}
          placeholder="Enter an approved document name or reference"
          minLength={3}
          required
        />

        <button type="submit" disabled={saving}>
          {saving ? "Saving Rule..." : "Add Brand Rule"}
        </button>
      </form>

      {message && (
        <p className="success-message">{message}</p>
      )}

      {error && (
        <p className="error-message">{error}</p>
      )}

      <div className="rules-heading">
        <h3>Saved Rules</h3>

        <button
          type="button"
          onClick={loadRules}
          disabled={loading}
        >
          {loading ? "Loading..." : "Load Rules"}
        </button>
      </div>

      {loading && <p>Loading saved rules...</p>}

      {!loading && loaded && rules.length === 0 && (
        <p>No brand rules have been added yet.</p>
      )}

      {!loading && rules.map((rule) => (
        <div className="rule-card" key={rule.id}>
          <h4>{rule.title}</h4>

          <p>{rule.description}</p>

          <p>
            <strong>Type:</strong>{" "}
            {formatRuleType(rule.rule_type)}
          </p>

          <p>
            <strong>Approved Source:</strong>{" "}
            {rule.approved_source || "Not specified"}
          </p>

          <small>
            Version {rule.version ?? "1"}
          </small>
        </div>
      ))}
    </div>
  );
}

export default BrandRules;
