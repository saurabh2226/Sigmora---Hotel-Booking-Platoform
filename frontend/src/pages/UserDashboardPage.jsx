import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { FiCalendar, FiMapPin, FiUser, FiSettings, FiXCircle } from 'react-icons/fi';
import { fetchMyBookings, cancelBooking } from '../redux/slices/bookingSlice';
import { formatCurrency, formatDate } from '../utils/formatters';
import { STATUS_COLORS } from '../utils/constants';
import { getImageUrl } from '../utils/helpers';
import Loader from '../components/common/Loader/Loader';
import toast from 'react-hot-toast';

export default function UserDashboardPage() {
  const dispatch = useDispatch();
  const { bookings, loading, pagination } = useSelector(s => s.bookings);
  const { user } = useSelector(s => s.auth);
  const [tab, setTab] = useState('all');

  useEffect(() => { dispatch(fetchMyBookings(tab === 'all' ? {} : { status: tab })); }, [dispatch, tab]);

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    const result = await dispatch(cancelBooking({ id }));
    if (result.meta.requestStatus === 'fulfilled') {
      const refundAmount = result.payload?.refundAmount || 0;
      toast.success(refundAmount > 0 ? `Booking cancelled. Refund initiated for ${formatCurrency(refundAmount)}.` : 'Booking cancelled');
    }
    else toast.error(result.payload || 'Failed to cancel');
  };

  return (
    <div className="page container" style={{ paddingTop: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800 }}>Welcome, {user?.name} 👋</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>Manage your bookings and account</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Link to="/support" style={{ padding: '10px 20px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 'var(--radius-md)', fontWeight: 700 }}>Support Chat</Link>
          <Link to="/hotels" style={{ padding: '10px 24px', background: 'var(--gradient-primary)', color: 'white', borderRadius: 'var(--radius-md)', fontWeight: 700 }}>Book New Stay</Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        {[
          { label: 'Total Bookings', value: pagination.total || bookings.length, color: '#6366f1' },
          { label: 'Upcoming', value: bookings.filter(b => b.status === 'confirmed').length, color: '#10b981' },
          { label: 'Completed', value: bookings.filter(b => b.status === 'checked-out').length, color: '#3b82f6' },
          { label: 'Cancelled', value: bookings.filter(b => b.status === 'cancelled').length, color: '#ef4444' },
        ].map((s, i) => (
          <div key={i} style={{ padding: 'var(--space-6)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', borderBottom: '2px solid var(--color-border)', paddingBottom: 'var(--space-2)' }}>
        {['all', 'confirmed', 'checked-out', 'cancelled', 'pending'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 'var(--font-size-sm)', textTransform: 'capitalize', background: tab === t ? 'var(--gradient-primary)' : 'transparent', color: tab === t ? 'white' : 'var(--color-text-secondary)', transition: 'all 0.2s' }}>{t}</button>
        ))}
      </div>

      {/* Booking List */}
      {loading ? <Loader /> : bookings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-16)' }}><h3>No bookings found</h3><p style={{ color: 'var(--color-text-muted)' }}>Start by booking your first hotel</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {bookings.map(b => (
            <div key={b._id} style={{ display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', transition: 'all 0.2s' }}>
              <img src={getImageUrl(b.hotel?.images)} alt={b.hotel?.title} style={{ width: 180, height: 120, objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{b.hotel?.title || 'Hotel'}</h3>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><FiMapPin size={12} /> {b.hotel?.address?.city}</p>
                  </div>
                  <span style={{ padding: '4px 14px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'capitalize', background: `${STATUS_COLORS[b.status]}20`, color: STATUS_COLORS[b.status] }}>{b.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-6)', marginTop: 'var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  <span><FiCalendar size={12} style={{ marginRight: 4 }} /> {formatDate(b.checkIn)} — {formatDate(b.checkOut)}</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{formatCurrency(b.pricing?.totalPrice)}</span>
                </div>
                {b.status === 'pending' && b.holdExpiresAt ? (
                  <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    Room hold active until {new Date(b.holdExpiresAt).toLocaleString()}
                  </p>
                ) : null}
                {b.refundAmount > 0 ? (
                  <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 700 }}>
                    Refund tracked: {formatCurrency(b.refundAmount)}
                  </p>
                ) : null}
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                  <Link to={`/booking/confirmation/${b._id}`} style={{ padding: '6px 16px', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-primary)', border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-md)' }}>View Details</Link>
                  {b.status === 'pending' || b.status === 'confirmed' ? <button onClick={() => handleCancel(b._id)} style={{ padding: '6px 16px', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)' }}>Cancel</button> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
