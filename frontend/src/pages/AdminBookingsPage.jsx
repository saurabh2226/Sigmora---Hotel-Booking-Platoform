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
  const suggestedAmount =
    booking?.payment?.status === 'partial_refunded'
      ? remainingRefundable
      : refundedSoFar > 0
      ? Math.min(refundedSoFar, remainingRefundable)
      : remainingRefundable;

  return {
    totalPaid,
    refundedSoFar,
    remainingRefundable,
    suggestedAmount,
  };
};

export default function AdminBookingsPage() {
  const [filters, setFilters] = useState({ status: '', page: 1 });
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

      setStatusDrafts(
        Object.fromEntries(
          data.data.bookings.map((b) => [b._id, b.status])
        )
      );
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

    return bookings.filter((b) => {
      const text = [
        b._id,
        b.user?.name,
        b.user?.email,
        b.hotel?.title,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(query);
    });
  }, [bookings, search]);

  const openRefundDialog = (booking) => {
    const meta = getRefundSummary(booking);
    setRefundDialog({
      open: true,
      booking,
      amount: meta.suggestedAmount ? String(meta.suggestedAmount) : '',
      note:
        booking.status === 'cancelled'
          ? 'Guest cancellation approved'
          : 'Manual admin refund',
    });
  };

  const closeRefundDialog = () =>
    setRefundDialog({ open: false, booking: null, amount: '', note: '' });

  const handleStatusUpdate = async (id) => {
    try {
      setBusyBookingId(id);
      await bookingApi.updateBookingStatus(id, {
        status: statusDrafts[id],
      });
      await loadBookings();
      toast.success('Booking updated');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed');
    } finally {
      setBusyBookingId('');
    }
  };

  const handleRefundConfirm = async () => {
    const booking = refundDialog.booking;
    if (!booking) return;

    const amount = Number(refundDialog.amount);
    const meta = getRefundSummary(booking);

    if (!amount || amount <= 0)
      return toast.error('Invalid amount');

    if (amount > meta.remainingRefundable)
      return toast.error('Exceeds refundable amount');

    try {
      setBusyBookingId(booking._id);
      await initiateRefund(booking._id, {
        amount,
        note: refundDialog.note,
      });
      toast.success('Refund sent');
      closeRefundDialog();
      await loadBookings();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Refund failed');
    } finally {
      setBusyBookingId('');
    }
  };

  return (
    <div className={`page container ${styles.page}`}>
      <h1>Manage Bookings</h1>

      {loading ? (
        <Loader />
      ) : (
        <table className={styles.table}>
          <tbody>
            {filteredBookings.map((booking) => {
              const refundMeta = getRefundSummary(booking);
              const draftStatus =
                statusDrafts[booking._id] || booking.status;
              const isLocked = booking.status === 'checked-out';
              const hasChanged = draftStatus !== booking.status;

              const canRefund =
                ['completed', 'partial_refunded'].includes(
                  booking.payment?.status
                ) && refundMeta.remainingRefundable > 0;

              return (
                <tr key={booking._id}>
                  <td>{booking.hotel?.title}</td>

                  <td>
                    {formatCurrency(booking.pricing?.totalPrice)}
                    <div>
                      Remaining{' '}
                      {formatCurrency(
                        refundMeta.remainingRefundable
                      )}
                    </div>
                  </td>

                  <td>{booking.status}</td>

                  <td>
                    <select
                      value={draftStatus}
                      disabled={isLocked}
                      onChange={(e) =>
                        setStatusDrafts((s) => ({
                          ...s,
                          [booking._id]: e.target.value,
                        }))
                      }
                    >
                      {BOOKING_STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>

                    {!isLocked && (
                      <>
                        {hasChanged && (
                          <button
                            onClick={() =>
                              handleStatusUpdate(booking._id)
                            }
                          >
                            Save
                          </button>
                        )}

                        {canRefund && (
                          <button
                            onClick={() =>
                              openRefundDialog(booking)
                            }
                          >
                            Refund
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {refundDialog.open && (
        <div>
          <h3>Refund</h3>
          <input
            value={refundDialog.amount}
            onChange={(e) =>
              setRefundDialog((d) => ({
                ...d,
                amount: e.target.value,
              }))
            }
          />
          <button onClick={handleRefundConfirm}>
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}