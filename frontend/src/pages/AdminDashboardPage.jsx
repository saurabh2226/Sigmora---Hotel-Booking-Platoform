import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FiUsers, FiHome, FiCalendar, FiDollarSign, FiTrendingUp } from 'react-icons/fi';
import { fetchDashboardStats } from '../redux/slices/adminSlice';
import { formatCurrency, formatDate } from '../utils/formatters';
import { STATUS_COLORS } from '../utils/constants';
import Loader from '../components/common/Loader/Loader';

export default function AdminDashboardPage() {
  const dispatch = useDispatch();
  const { stats, monthlyRevenue, recentBookings, loading } = useSelector(s => s.admin);
  useEffect(() => { dispatch(fetchDashboardStats()); }, [dispatch]);
  if (loading && !stats) return <Loader fullPage />;

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, icon: <FiUsers />, color: '#6366f1' },
    { label: 'Total Hotels', value: stats?.totalHotels || 0, icon: <FiHome />, color: '#10b981' },
    { label: 'Total Bookings', value: stats?.totalBookings || 0, icon: <FiCalendar />, color: '#3b82f6' },
    { label: 'Revenue', value: formatCurrency(stats?.totalRevenue || 0), icon: <FiDollarSign />, color: '#f59e0b' },
  ];

  return (
    <div className="page container" style={{ paddingTop: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
        <div><h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800 }}>Admin Dashboard</h1><p style={{ color: 'var(--color-text-muted)' }}>Overview of your platform. Use the top navbar to jump between community, reports, hotels, users, bookings, reviews, offers, and support.</p></div>
        <div style={{ padding: '10px 16px', borderRadius: 'var(--radius-full)', background: 'rgba(15, 118, 110, 0.08)', color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>Platform overview</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        {statCards.map((c, i) => (
          <div key={i} style={{ padding: 'var(--space-6)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 4 }}>{c.label}</p><p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: c.color }}>{c.value}</p></div>
              <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: `${c.color}15`, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{c.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Recent Bookings</h2>
      <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            {['User', 'Hotel', 'Amount', 'Status', 'Date'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {recentBookings?.map(b => (
              <tr key={b._id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '12px 16px', fontSize: 'var(--font-size-sm)' }}>{b.user?.name || 'N/A'}</td>
                <td style={{ padding: '12px 16px', fontSize: 'var(--font-size-sm)' }}>{b.hotel?.title || 'N/A'}</td>
                <td style={{ padding: '12px 16px', fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-primary)' }}>{formatCurrency(b.pricing?.totalPrice)}</td>
                <td style={{ padding: '12px 16px' }}><span style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'capitalize', background: `${STATUS_COLORS[b.status]}20`, color: STATUS_COLORS[b.status] }}>{b.status}</span></td>
                <td style={{ padding: '12px 16px', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{formatDate(b.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
