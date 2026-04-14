import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as bookingApi from '../api/bookingApi';
import { initiateRefund } from '../api/paymentApi';
import { BOOKING_STATUSES, STATUS_COLORS } from '../utils/constants';
import { formatCurrency, formatDate } from '../utils/formatters';
import Loader from '../components/common/Loader/Loader';
import styles from './AdminWorkspace.module.css';

const getRefundSummary = (booking) => {
  const totalPaid = Number(booking?.pricing?.totalPrice || 0);
  const refundedSoFar = Number(booking?.refundAmount || 0);
  const remainingRefundable = Math.max(0, totalPaid - refundedSoFar);
  const suggestedAmount = booking?.payment?.status === 'partial_refunded'
    ? remainingRefundable
    : (refundedSoFar > 0 ? Math.min(refundedSoFar, remainingRefundable) : remainingRefundable);

  return {
    totalPaid,
    refundedSoFar,
    remainingRefundable,
    suggestedAmount,
  };
};

export default function AdminBookingsPage() {
  const [filters, setFilters] = useState({
    status: '',
    page: 1,
  });
  const [search, setSearch] = useState('');
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [busyBookingId, setBusyBookingId] = useState('');
  const [statusDrafts, setStatusDrafts] = useState({});
  const [refundDialog, setRefundDialog] = useState({
    open: false,
    booking: null,
    amount: '',
    note: '',
  });

  const loadBookings = async () => {
    try {
      setLoading(true);
      const { data } = await bookingApi.getAllBookings({
        page: filters.page,
        limit: 12,
        status: filters.status || undefined,
      });
      setBookings(data.data.bookings);
      setPagination({
        page: data.data.currentPage,
        totalPages: data.data.totalPages,
        total: data.data.totalResults,
      });
      setStatusDrafts(Object.fromEntries(data.data.bookings.map((booking) => [booking._id, booking.status])));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [filters.page, filters.status]);

  const filteredBookings = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return bookings;
    return bookings.filter((booking) => {
      const haystack = [
        booking._id,
        booking.user?.name,
        booking.user?.email,
        booking.hotel?.title,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [bookings, search]);

  const openRefundDialog = (booking) => {
    const refundMeta = getRefundSummary(booking);
    setRefundDialog({
      open: true,
      booking,
      amount: refundMeta.suggestedAmount ? String(refundMeta.suggestedAmount) : '',
      note: booking.status === 'cancelled'
        ? 'Guest cancellation approved'
        : 'Manual admin refund',
    });
  };

  const closeRefundDialog = () => {
    setRefundDialog({
      open: false,
      booking: null,
      amount: '',
      note: '',
    });
  };

  const handleStatusUpdate = async (bookingId) => {
    try {
      setBusyBookingId(bookingId);
      const status = statusDrafts[bookingId];
      await bookingApi.updateBookingStatus(bookingId, { status });
      await loadBookings();
      toast.success('Booking status updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update booking');
    } finally {
      setBusyBookingId('');
    }
  };

  const handleRefundConfirm = async () => {
    if (!refundDialog.booking) {
      return;
    }

    const amount = Number(refundDialog.amount);
    const refundMeta = getRefundSummary(refundDialog.booking);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid refund amount');
      return;
    }

    if (amount > refundMeta.remainingRefundable) {
      toast.error(`Refund amount cannot exceed ${formatCurrency(refundMeta.remainingRefundable)}`);
      return;
    }

    try {
      setBusyBookingId(refundDialog.booking._id);
      await initiateRefund(refundDialog.booking._id, {
        amount,
        note: refundDialog.note,
      });
      toast.success('Refund initiated successfully');
      closeRefundDialog();
      await loadBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to initiate refund');
    } finally {
      setBusyBookingId('');
    }
  };

  return (
    <div className={`page container ${styles.page}`}>
      <div className={styles.header}>
        <div>
          <h1>Manage Bookings</h1>
          <p>Track reservations, update booking lifecycle states, and issue refunds with a clear operator workflow.</p>
        </div>
        <div className={styles.actions}>
          <Link to="/admin" className={styles.secondaryBtn}>Back to Dashboard</Link>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            className={styles.input}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by booking ID, user, or hotel"
          />
          <select
            className={styles.select}
            value={filters.status}
            onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value, page: 1 }))}
          >
            <option value="">All statuses</option>
            {BOOKING_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>

        <div className={styles.cardGrid} style={{ marginBottom: 'var(--space-4)' }}>
          <div className={styles.metricCard}>
            <strong>{pagination.total}</strong>
            <span>Total bookings</span>
          </div>
          <div className={styles.metricCard}>
            <strong>{bookings.filter((booking) => ['completed', 'partial_refunded'].includes(booking.payment?.status)).length}</strong>
            <span>Refund-eligible on this page</span>
          </div>
          <div className={styles.metricCard}>
            <strong>{bookings.filter((booking) => booking.status === 'cancelled').length}</strong>
            <span>Cancelled on this page</span>
          </div>
        </div>

        {loading ? <Loader /> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Stay</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((booking) => {
                  const refundMeta = getRefundSummary(booking);
                  const canRefund = ['completed', 'partial_refunded'].includes(booking.payment?.status) && refundMeta.remainingRefundable > 0;

                  return (
                    <tr key={booking._id}>
                      <td>
                        <strong>#{booking._id.slice(-6).toUpperCase()}</strong>
                        <div className={styles.metaText}>{booking.user?.name}</div>
                        <div className={styles.metaText}>{booking.user?.email}</div>
                      </td>
                      <td>
                        <strong>{booking.hotel?.title || 'Hotel removed'}</strong>
                        <div className={styles.metaText}>{formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}</div>
                      </td>
                      <td>
                        <strong>{formatCurrency(booking.pricing?.totalPrice || 0)}</strong>
                        <div className={styles.metaText}>Refunded so far {formatCurrency(refundMeta.refundedSoFar)}</div>
                        <div className={styles.metaText}>Remaining {formatCurrency(refundMeta.remainingRefundable)}</div>
                      </td>
                      <td>
                        <span
                          className={styles.pill}
                          style={{
                            background: booking.payment?.status === 'completed'
                              ? 'rgba(16,185,129,0.12)'
                              : ['refunded', 'partial_refunded'].includes(booking.payment?.status)
                                ? 'rgba(59,130,246,0.12)'
                                : 'rgba(245,158,11,0.12)',
                            color: booking.payment?.status === 'completed'
                              ? '#10b981'
                              : ['refunded', 'partial_refunded'].includes(booking.payment?.status)
                                ? '#3b82f6'
                                : '#d97706',
                          }}
                        >
                          {booking.payment?.status || 'pending'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={styles.pill}
                          style={{
                            background: `${STATUS_COLORS[booking.status] || '#6366f1'}20`,
                            color: STATUS_COLORS[booking.status] || '#6366f1',
                          }}
                        >
                          {booking.status}
                        </span>
                      </td>
                      <td>
                        <div className={styles.stack}>
                          <select
                            className={styles.select}
                            value={statusDrafts[booking._id] || booking.status}
                            onChange={(e) => setStatusDrafts((current) => ({ ...current, [booking._id]: e.target.value }))}
                          >
                            {BOOKING_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>
                          <div className={styles.inlineActions}>
                            <button
                              type="button"
                              className={styles.primaryBtn}
                              disabled={busyBookingId === booking._id}
                              onClick={() => handleStatusUpdate(booking._id)}
                            >
                              {busyBookingId === booking._id ? 'Saving...' : 'Save'}
                            </button>
                            {canRefund ? (
                              <button
                                type="button"
                                className={styles.secondaryBtn}
                                disabled={busyBookingId === booking._id}
                                onClick={() => openRefundDialog(booking)}
                              >
                                Refund
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredBookings.length === 0 && (
                  <tr>
                    <td colSpan="6">
                      <div className={styles.emptyState}>No bookings match the current search.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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

      {refundDialog.open && refundDialog.booking ? (
        <div className={styles.modalOverlay} role="presentation" onClick={closeRefundDialog}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="refund-dialog-title" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.modalEyebrow}>Refund flow</span>
                <h2 id="refund-dialog-title">Confirm refund</h2>
                <p>Review the payout amount before we send the refund request to Razorpay.</p>
              </div>
            </div>

            <div className={styles.modalSummary}>
              <div>
                <span>Booking</span>
                <strong>#{refundDialog.booking._id.slice(-6).toUpperCase()}</strong>
              </div>
              <div>
                <span>Total paid</span>
                <strong>{formatCurrency(getRefundSummary(refundDialog.booking).totalPaid)}</strong>
              </div>
              <div>
                <span>Already refunded</span>
                <strong>{formatCurrency(getRefundSummary(refundDialog.booking).refundedSoFar)}</strong>
              </div>
              <div>
                <span>Remaining</span>
                <strong>{formatCurrency(getRefundSummary(refundDialog.booking).remainingRefundable)}</strong>
              </div>
            </div>

            <label className={styles.modalField}>
              <span>Refund amount</span>
              <input
                className={styles.input}
                type="number"
                min="1"
                step="0.01"
                value={refundDialog.amount}
                onChange={(event) => setRefundDialog((current) => ({ ...current, amount: event.target.value }))}
              />
            </label>

            <label className={styles.modalField}>
              <span>Operator note</span>
              <textarea
                className={styles.textarea}
                value={refundDialog.note}
                onChange={(event) => setRefundDialog((current) => ({ ...current, note: event.target.value }))}
                placeholder="Optional note for refund tracking"
              />
            </label>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryBtn} onClick={closeRefundDialog}>Cancel</button>
              <button type="button" className={styles.primaryBtn} disabled={busyBookingId === refundDialog.booking._id} onClick={handleRefundConfirm}>
                {busyBookingId === refundDialog.booking._id ? 'Processing refund...' : 'Send refund'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
