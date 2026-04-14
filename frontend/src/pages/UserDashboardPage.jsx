import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { FiCalendar, FiMapPin, FiUser, FiSave, FiPhone, FiMail } from 'react-icons/fi';
import { fetchMyBookings, cancelBooking } from '../redux/slices/bookingSlice';
import { updateUserProfile } from '../redux/slices/authSlice';
import { formatCurrency, formatDate } from '../utils/formatters';
import { STATUS_COLORS } from '../utils/constants';
import { getImageUrl } from '../utils/helpers';
import { isValidName, isValidPhone, normalizePhoneInput } from '../utils/validators';
import Loader from '../components/common/Loader/Loader';
import toast from 'react-hot-toast';

export default function UserDashboardPage() {
  const dispatch = useDispatch();
  const { bookings, loading, pagination } = useSelector((s) => s.bookings);
  const { user, loading: authLoading } = useSelector((s) => s.auth);
  const [tab, setTab] = useState('all');
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [profileErrors, setProfileErrors] = useState({});

  useEffect(() => {
    dispatch(fetchMyBookings(tab === 'all' ? {} : { status: tab }));
  }, [dispatch, tab]);

  useEffect(() => {
    setProfileForm({
      name: user?.name || '',
      phone: normalizePhoneInput(user?.phone || ''),
    });
    setProfileErrors({});
  }, [user?.name, user?.phone]);

  const isProfileDirty = useMemo(() => (
    profileForm.name.trim() !== (user?.name || '').trim()
    || normalizePhoneInput(profileForm.phone) !== normalizePhoneInput(user?.phone || '')
  ), [profileForm.name, profileForm.phone, user?.name, user?.phone]);

  const validateProfile = () => {
    const nextErrors = {};

    if (!profileForm.name.trim()) {
      nextErrors.name = 'Full name is required';
    } else if (!isValidName(profileForm.name)) {
      nextErrors.name = 'Name must be 2-50 characters and contain letters only';
    }

    if (profileForm.phone && !isValidPhone(profileForm.phone)) {
      nextErrors.phone = 'Enter a valid 10-digit Indian phone number';
    }

    setProfileErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleProfileChange = (field, value) => {
    const nextValue = field === 'phone' ? normalizePhoneInput(value) : value;
    setProfileForm((current) => ({ ...current, [field]: nextValue }));

    if (profileErrors[field]) {
      setProfileErrors((current) => ({ ...current, [field]: '' }));
    }
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();

    if (!validateProfile()) {
      toast.error('Please fix the profile errors before saving');
      return;
    }

    const result = await dispatch(updateUserProfile({
      name: profileForm.name.trim(),
      phone: normalizePhoneInput(profileForm.phone),
    }));

    if (result.meta.requestStatus === 'fulfilled') {
      toast.success('Profile updated successfully');
      return;
    }

    toast.error(result.payload || 'Failed to update profile');
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    const result = await dispatch(cancelBooking({ id }));
    if (result.meta.requestStatus === 'fulfilled') {
      const refundAmount = result.payload?.refundAmount || 0;
      toast.success(refundAmount > 0 ? `Booking cancelled. Refund initiated for ${formatCurrency(refundAmount)}.` : 'Booking cancelled');
    } else {
      toast.error(result.payload || 'Failed to cancel');
    }
  };

  return (
    <div className="page container" style={{ paddingTop: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800 }}>Welcome, {user?.name} 👋</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>Manage your bookings, contact details, and upcoming stays.</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Link to="/support" style={{ padding: '10px 20px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 'var(--radius-md)', fontWeight: 700 }}>Support Chat</Link>
          <Link to="/hotels" style={{ padding: '10px 24px', background: 'var(--gradient-primary)', color: 'white', borderRadius: 'var(--radius-md)', fontWeight: 700 }}>Book New Stay</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        {[
          { label: 'Total Bookings', value: pagination.total || bookings.length, color: '#6366f1' },
          { label: 'Upcoming', value: bookings.filter((b) => b.status === 'confirmed').length, color: '#10b981' },
          { label: 'Completed', value: bookings.filter((b) => b.status === 'checked-out').length, color: '#3b82f6' },
          { label: 'Cancelled', value: bookings.filter((b) => b.status === 'cancelled').length, color: '#ef4444' },
        ].map((stat) => (
          <div key={stat.label} style={{ padding: 'var(--space-6)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: stat.color }}>{stat.value}</p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-5)', marginBottom: 'var(--space-8)' }}>
        <form onSubmit={handleProfileSave} style={{ padding: 'var(--space-6)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, marginBottom: 'var(--space-2)' }}>Profile Details</h2>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>Keep your guest profile current so hotels and receipts use the right contact information.</p>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Full Name</span>
            <input
              type="text"
              value={profileForm.name}
              onChange={(event) => handleProfileChange('name', event.target.value)}
              style={{ padding: '12px 14px', borderRadius: 'var(--radius-lg)', border: `1px solid ${profileErrors.name ? 'var(--color-danger)' : 'var(--color-border)'}`, background: 'var(--color-surface-container-low)', color: 'var(--color-text-primary)' }}
            />
            {profileErrors.name ? <span style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)' }}>{profileErrors.name}</span> : null}
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Phone Number</span>
            <input
              type="number"
              value={profileForm.phone}
              onChange={(event) => handleProfileChange('phone', event.target.value)}
              inputMode="numeric"
              min="0"
              placeholder="10-digit mobile number"
              style={{ padding: '12px 14px', borderRadius: 'var(--radius-lg)', border: `1px solid ${profileErrors.phone ? 'var(--color-danger)' : 'var(--color-border)'}`, background: 'var(--color-surface-container-low)', color: 'var(--color-text-primary)' }}
            />
            {profileErrors.phone ? <span style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)' }}>{profileErrors.phone}</span> : null}
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>Email Address</span>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              style={{ padding: '12px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', background: 'var(--color-surface-container-high)', color: 'var(--color-text-muted)' }}
            />
          </label>

          <button type="submit" disabled={authLoading || !isProfileDirty} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 18px', borderRadius: 'var(--radius-md)', background: authLoading || !isProfileDirty ? 'var(--color-surface-container-high)' : 'var(--gradient-primary)', color: authLoading || !isProfileDirty ? 'var(--color-text-muted)' : 'white', fontWeight: 700 }}>
            <FiSave size={16} />
            {authLoading ? 'Saving profile...' : 'Save profile'}
          </button>
        </form>

        <div style={{ padding: 'var(--space-6)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, marginBottom: 'var(--space-2)' }}>Account Snapshot</h2>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>A quick look at the details we use for bookings and communication.</p>
          </div>

          {[
            { icon: <FiUser size={16} />, label: 'Guest profile', value: user?.name || 'Not set' },
            { icon: <FiMail size={16} />, label: 'Email', value: user?.email || 'Not set' },
            { icon: <FiPhone size={16} />, label: 'Phone', value: user?.phone || 'Add your mobile number' },
            { icon: <FiCalendar size={16} />, label: 'Member since', value: user?.createdAt ? formatDate(user.createdAt) : 'Current session' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-container-low)' }}>
              <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-full)', display: 'grid', placeItems: 'center', background: 'rgba(15, 118, 110, 0.08)', color: 'var(--color-primary)' }}>{item.icon}</div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 4 }}>{item.label}</div>
                <strong style={{ color: 'var(--color-text-primary)', lineHeight: 1.5 }}>{item.value}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', borderBottom: '2px solid var(--color-border)', paddingBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
        {['all', 'confirmed', 'checked-out', 'cancelled', 'pending'].map((status) => (
          <button key={status} onClick={() => setTab(status)} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 'var(--font-size-sm)', textTransform: 'capitalize', background: tab === status ? 'var(--gradient-primary)' : 'transparent', color: tab === status ? 'white' : 'var(--color-text-secondary)', transition: 'all 0.2s' }}>{status}</button>
        ))}
      </div>

      {loading ? <Loader /> : bookings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-16)' }}>
          <h3>No bookings found</h3>
          <p style={{ color: 'var(--color-text-muted)' }}>Start by booking your first hotel</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {bookings.map((booking) => (
            <div key={booking._id} style={{ display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', transition: 'all 0.2s', flexWrap: 'wrap' }}>
              <img src={getImageUrl(booking.hotel?.images)} alt={booking.hotel?.title} style={{ width: 180, height: 120, objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{booking.hotel?.title || 'Hotel'}</h3>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><FiMapPin size={12} /> {booking.hotel?.address?.city}</p>
                  </div>
                  <span style={{ padding: '4px 14px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'capitalize', background: `${STATUS_COLORS[booking.status]}20`, color: STATUS_COLORS[booking.status] }}>{booking.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-6)', marginTop: 'var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
                  <span><FiCalendar size={12} style={{ marginRight: 4 }} /> {formatDate(booking.checkIn)} — {formatDate(booking.checkOut)}</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{formatCurrency(booking.pricing?.totalPrice)}</span>
                </div>
                {booking.status === 'pending' && booking.holdExpiresAt ? (
                  <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    Room hold active until {new Date(booking.holdExpiresAt).toLocaleString()}
                  </p>
                ) : null}
                {booking.refundAmount > 0 ? (
                  <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 700 }}>
                    Refund tracked: {formatCurrency(booking.refundAmount)}
                  </p>
                ) : null}
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <Link to={`/booking/confirmation/${booking._id}`} style={{ padding: '6px 16px', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-primary)', border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-md)' }}>View Details</Link>
                  {booking.status === 'pending' || booking.status === 'confirmed' ? (
                    <button onClick={() => handleCancel(booking._id)} style={{ padding: '6px 16px', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)' }}>Cancel</button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
