
import { useState } from "react";
import api from "./api";

function History() {
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function loadHistory() {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/reviews/mine");

      if (!Array.isArray(response.data)) {
        throw new Error("Unexpected response from the server.");
      }

      setReviews(response.data);
      setLoaded(true);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.message ||
        "Could not load your review history."
      );
    } finally {
      setLoading(false);
    }
  }

  function formatDate(date) {
    if (!date) return "Not available";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Not available";
    }

    return parsedDate.toLocaleString();
  }

  function formatStatus(status) {
    if (!status) return "Unknown";

    return status
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  return (
    <div className="history-page">
      <h2>Review History</h2>

      <p>
        Track the content you've submitted and its review status.
      </p>

      <button
        type="button"
        onClick={loadHistory}
        disabled={loading}
      >
        {loading ? "Loading..." : "Load My History"}
      </button>

      {loading && <p>Fetching your submissions...</p>}

      {error && (
        <p className="error-message">{error}</p>
      )}

      {!loading && loaded && reviews.length === 0 && !error && (
        <p>You haven't submitted any content for review yet.</p>
      )}

      {!loading && reviews.map((review) => (
        <div className="history-card" key={review.id}>
          <div className="history-card-heading">
            <h3>Submission #{review.id}</h3>

            <span className={`status status-${review.status}`}>
              {formatStatus(review.status)}
            </span>
          </div>

          <p className="history-content">
            {review.content}
          </p>

          {review.reviewer_comment && (
            <p>
              <strong>Reviewer comment:</strong>{" "}
              {review.reviewer_comment}
            </p>
          )}

          <p>
            <small>
              Submitted: {formatDate(review.created_at)}
            </small>
          </p>

          {review.reviewed_at && (
            <p>
              <small>
                Reviewed: {formatDate(review.reviewed_at)}
              </small>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default History;
