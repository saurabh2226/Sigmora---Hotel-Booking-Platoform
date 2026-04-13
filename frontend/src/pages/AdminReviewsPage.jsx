import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as adminApi from '../api/adminApi';
import * as reviewApi from '../api/reviewApi';
import { formatDate } from '../utils/formatters';
import Loader from '../components/common/Loader/Loader';
import styles from './AdminWorkspace.module.css';

export default function AdminReviewsPage() {
  const [filters, setFilters] = useState({
    search: '',
    responded: '',
    page: 1,
  });
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [busyReviewId, setBusyReviewId] = useState('');
  const [responseDrafts, setResponseDrafts] = useState({});

  const loadReviews = async () => {
    try {
      setLoading(true);
      const { data } = await adminApi.getReviews({
        page: filters.page,
        limit: 10,
        search: filters.search || undefined,
        responded: filters.responded || undefined,
      });
      setReviews(data.data.reviews);
      setPagination({
        page: data.data.currentPage,
        totalPages: data.data.totalPages,
        total: data.data.totalResults,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [filters.page, filters.responded]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setFilters((current) => ({ ...current, page: 1 }));
    loadReviews();
  };

  const handleRespond = async (reviewId) => {
    const text = responseDrafts[reviewId]?.trim();
    if (!text) {
      toast.error('Enter a response before sending');
      return;
    }

    try {
      setBusyReviewId(reviewId);
      await reviewApi.respondToReview(reviewId, { text });
      toast.success('Response published');
      setResponseDrafts((current) => ({ ...current, [reviewId]: '' }));
      await loadReviews();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to publish response');
    } finally {
      setBusyReviewId('');
    }
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm('Delete this review permanently?')) return;

    try {
      setBusyReviewId(reviewId);
      await reviewApi.deleteReview(reviewId);
      toast.success('Review deleted');
      await loadReviews();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete review');
    } finally {
      setBusyReviewId('');
    }
  };

  return (
    <div className={`page container ${styles.page}`}>
      <div className={styles.header}>
        <div>
          <h1>Manage Reviews</h1>
          <p>Moderate guest sentiment, publish responses, and remove reviews that should not remain on the platform.</p>
        </div>
        <div className={styles.actions}>
          <Link to="/admin" className={styles.secondaryBtn}>Back to Dashboard</Link>
        </div>
      </div>

      <div className={styles.panel}>
        <form className={styles.toolbar} onSubmit={handleSearchSubmit}>
          <input
            className={styles.input}
            value={filters.search}
            onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))}
            placeholder="Search by title or comment"
          />
          <select
            className={styles.select}
            value={filters.responded}
            onChange={(e) => setFilters((current) => ({ ...current, responded: e.target.value, page: 1 }))}
          >
            <option value="">All reviews</option>
            <option value="yes">Responded</option>
            <option value="no">Awaiting response</option>
          </select>
          <button type="submit" className={styles.primaryBtn}>Search</button>
        </form>

        {loading ? <Loader /> : (
          <div className={styles.stack}>
            {reviews.length === 0 ? (
              <div className={styles.emptyState}>No reviews match the current filters.</div>
            ) : reviews.map((review) => (
              <article key={review._id} className={styles.reviewCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                  <div>
                    <h3>{review.title || 'Guest Review'}</h3>
                    <p className={styles.metaText}>
                      {review.hotel?.title || 'Unknown hotel'} • by {review.user?.name || 'Guest'} • {formatDate(review.createdAt)}
                    </p>
                  </div>
                  <span
                    className={styles.pill}
                    style={{
                      background: 'rgba(245,158,11,0.12)',
                      color: '#d97706',
                    }}
                  >
                    {review.rating}/5
                  </span>
                </div>

                <p style={{ marginTop: 'var(--space-3)', lineHeight: 1.7 }}>{review.comment}</p>

                {review.response?.text ? (
                  <div className={styles.responseBox}>
                    <strong>Published Response</strong>
                    <p>{review.response.text}</p>
                  </div>
                ) : (
                  <div className={styles.responseBox}>
                    <strong>Respond as Admin</strong>
                    <textarea
                      className={styles.textarea}
                      value={responseDrafts[review._id] || ''}
                      onChange={(e) => setResponseDrafts((current) => ({ ...current, [review._id]: e.target.value }))}
                      placeholder="Thank the guest, acknowledge the feedback, and explain what the team will do next."
                    />
                    <div className={styles.inlineActions} style={{ marginTop: 'var(--space-3)' }}>
                      <button type="button" className={styles.primaryBtn} disabled={busyReviewId === review._id} onClick={() => handleRespond(review._id)}>
                        {busyReviewId === review._id ? 'Sending...' : 'Publish Response'}
                      </button>
                    </div>
                  </div>
                )}

                <div className={styles.inlineActions} style={{ marginTop: 'var(--space-4)' }}>
                  <button type="button" className={styles.dangerBtn} disabled={busyReviewId === review._id} onClick={() => handleDelete(review._id)}>
                    {busyReviewId === review._id ? 'Working...' : 'Delete Review'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className={styles.inlineActions} style={{ marginTop: 'var(--space-4)' }}>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={filters.page <= 1}
            onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
          >
            Previous
          </button>
          <span className={styles.metaText}>Page {pagination.page} of {pagination.totalPages || 1}</span>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={filters.page >= pagination.totalPages}
            onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
