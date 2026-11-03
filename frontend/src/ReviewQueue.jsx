
import { useState } from "react";
import api from "./api.js";

function ReviewQueue() {
  const [reviews, setReviews] = useState([]);
  const [comments, setComments] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // LOAD PENDING REVIEWS
  async function loadReviews() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await api.get("/reviews/pending");

      if (!Array.isArray(response.data)) {
        throw new Error("Unexpected response format from the server.");
      }

      setReviews(response.data);

    } catch (err) {
      console.error("Loading reviews failed:", err);
      setReviews([]);

      setError(
        err.response?.data?.detail ||
        err.message ||
        "Could not load pending reviews."
      );

    } finally {
      setLoading(false);
    }
  }

  // APPROVE, REQUEST CHANGES OR REJECT
  async function decideReview(id, decision) {
    setMessage("");
    setError("");

    const comment = (comments[id] || "").trim();

    if (
      ["changes_requested", "rejected"].includes(decision) &&
      !comment
    ) {
      setError(
        decision === "rejected"
          ? "Please provide a reason before rejecting this submission."
          : "Please explain what needs to change."
      );
      return;
    }

    setProcessingId(id);

    try {
      await api.post(`/reviews/${id}/decision`, {
        decision,
        comment: comment || null,
      });

      const messages = {
        approved: `Submission #${id} approved successfully.`,
        changes_requested: `Changes requested for submission #${id}.`,
        rejected: `Submission #${id} rejected successfully.`,
      };

      setMessage(messages[decision]);

      setReviews((currentReviews) =>
        currentReviews.filter((review) => review.id !== id)
      );

      setComments((currentComments) => {
        const updated = { ...currentComments };
        delete updated[id];
        return updated;
      });

    } catch (err) {
      console.error("Review decision failed:", err);

      setError(
        err.response?.data?.detail ||
        "Could not update this review. Please try again."
      );

    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="review-queue-page">

      <div className="page-intro">
        <h2>Human Review Queue</h2>

        <p>
          Review submitted content before it is approved
          for use. Every decision is handled by a human reviewer.
        </p>
      </div>

      {/* LOAD BUTTON */}
      <button
        type="button"
        onClick={loadReviews}
        disabled={loading || processingId !== null}
      >
        {loading ? "Loading..." : "Load Pending Reviews"}
      </button>

      {/* SUCCESS MESSAGE */}
      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}

      {/* ERROR MESSAGE */}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {loading && (
        <p>Loading pending submissions...</p>
      )}

      {/* EMPTY STATE */}
      {!loading && !error && reviews.length === 0 && (
        <div className="empty-state">
          <h3>No pending reviews</h3>
          <p>
            There are currently no submissions waiting
            for approval. Click the button above to refresh.
          </p>
        </div>
      )}

      {/* REVIEW CARDS */}
      <div className="review-list">
        {reviews.map((review) => (
          <article
            className="review-card"
            key={review.id}
          >
            <div className="review-card-header">
              <div>
                <h3>Submission #{review.id}</h3>
                <span className="review-status">
                  Pending Review
                </span>
              </div>

              {review.created_at && (
                <small>
                  Submitted:{" "}
                  {new Date(review.created_at).toLocaleString()}
                </small>
              )}
            </div>

            {/* SUBMITTED CONTENT */}
            <div className="review-content">
              <h4>Submitted Content</h4>
              <p>{review.content}</p>
            </div>

            {/* REVIEWER COMMENT */}
            <div className="review-comment-section">
              <label htmlFor={`comment-${review.id}`}>
                Reviewer Comments
              </label>

              <textarea
                id={`comment-${review.id}`}
                value={comments[review.id] || ""}
                onChange={(event) =>
                  setComments((currentComments) => ({
                    ...currentComments,
                    [review.id]: event.target.value,
                  }))
                }
                placeholder="Explain your decision or suggest improvements..."
                rows={4}
                disabled={processingId !== null}
              />

              <small>
                A comment is required for Request Changes and Reject.
              </small>
            </div>

            {/* REVIEW ACTIONS */}
            <div className="review-actions">
              <button
                type="button"
                onClick={() =>
                  decideReview(review.id, "approved")
                }
                disabled={processingId !== null}
              >
                {processingId === review.id
                  ? "Processing..."
                  : "Approve"}
              </button>

              <button
                type="button"
                className="request-changes-button"
                onClick={() =>
                  decideReview(review.id, "changes_requested")
                }
                disabled={processingId !== null}
              >
                Request Changes
              </button>

              <button
                type="button"
                className="reject-review-button"
                onClick={() =>
                  decideReview(review.id, "rejected")
                }
                disabled={processingId !== null}
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default ReviewQueue;
