import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiBarChart2, FiCalendar, FiHome, FiMessageCircle, FiTag, FiUsers } from 'react-icons/fi';
import * as ownerApi from '../api/ownerApi';
import { useSocket } from '../context/SocketContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import Loader from '../components/common/Loader/Loader';
import styles from './AdminWorkspace.module.css';

const fetchDashboardState = async ({ setDashboard, setLoading, silent = false }) => {
  try {
    if (!silent) {
      setLoading(true);
    }
    const { data } = await ownerApi.getOwnerDashboard();
    setDashboard(data.data);
  } finally {
    if (!silent) {
      setLoading(false);
    }
  }
};

export default function OwnerDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const socket = useSocket();

  useEffect(() => {
    fetchDashboardState({ setDashboard, setLoading }).catch((error) => {
      toast.error(error.response?.data?.message || 'Failed to load owner dashboard');
    });
  }, []);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const refreshDashboard = () => {
      fetchDashboardState({ setDashboard, setLoading, silent: true }).catch(() => {});
    };

    socket.on('support:updated', refreshDashboard);
    socket.on('notification:new', refreshDashboard);

    return () => {
      socket.off('support:updated', refreshDashboard);
      socket.off('notification:new', refreshDashboard);
    };
  }, [socket]);

  if (loading && !dashboard) {
    return <Loader fullPage />;
  }

  const statCards = [
    { label: 'Managed Hotels', value: dashboard?.stats?.totalHotels || 0, icon: <FiHome />, color: '#0f766e' },
    { label: 'Total Bookings', value: dashboard?.stats?.totalBookings || 0, icon: <FiCalendar />, color: '#2563eb' },
    { label: 'Live Offers', value: dashboard?.stats?.activeOffers || 0, icon: <FiTag />, color: '#f59e0b' },
    { label: 'Open Chats', value: dashboard?.stats?.openConversations || 0, icon: <FiMessageCircle />, color: '#dc2626' },
    { label: 'Community Threads', value: dashboard?.stats?.communityThreads || 0, icon: <FiUsers />, color: '#7c3aed' },
  ];

  return (
    <div className={`page container ${styles.page}`}>
      <div className={styles.header}>
        <div>
          <h1>Owner Workspace</h1>
          <p>Manage your hotels, reply to guest chats, update live offers, and keep track of the bookings coming into your properties.</p>
        </div>
        <div className={styles.actions}>
          <Link to="/owner/community" className={styles.secondaryBtn}>Owner Hub</Link>
          <Link to="/owner/reports" className={styles.secondaryBtn}>Reports</Link>
          <Link to="/owner/hotels" className={styles.secondaryBtn}>Manage Hotels</Link>
          <Link to="/owner/bookings" className={styles.secondaryBtn}>Bookings</Link>
          <Link to="/owner/offers" className={styles.primaryBtn}>Offers</Link>
          <Link to="/support" className={styles.secondaryBtn}>Support Inbox</Link>
        </div>
      </div>

      {dashboard?.stats?.openConversations > 0 && (
        <div className={styles.alertBanner} style={{ marginBottom: 'var(--space-5)' }}>
          <div>
            <strong>{dashboard.stats.openConversations} guest quer{dashboard.stats.openConversations > 1 ? 'ies' : 'y'} waiting in your inbox</strong>
            <p>New guest questions now appear here in real time, and owners also receive an email alert for every fresh guest message.</p>
          </div>
          <Link to="/support" className={styles.primaryBtn}>Open Support Inbox</Link>
        </div>
      )}

      <div className={styles.cardGrid} style={{ marginBottom: 'var(--space-6)' }}>
        {statCards.map((card) => (
          <div key={card.label} className={styles.metricCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', alignItems: 'center' }}>
              <div>
                <span>{card.label}</span>
                <strong style={{ color: card.color }}>{card.value}</strong>
              </div>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius-xl)',
                display: 'grid',
                placeItems: 'center',
                background: `${card.color}15`,
                color: card.color,
                fontSize: '1.4rem',
              }}
              >
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.gridTwo} style={{ marginBottom: 'var(--space-6)' }}>
        <div className={styles.panel}>
          <div className={styles.header} style={{ marginBottom: 'var(--space-4)' }}>
            <div>
              <h1 style={{ fontSize: 'var(--font-size-xl)' }}>Owner Community</h1>
              <p>Discuss pricing, operations, and growth ideas with fellow hotel owners and the main admins.</p>
            </div>
            <Link to="/owner/community" className={styles.secondaryBtn}>Open hub</Link>
          </div>

          {!dashboard?.recentCommunityThreads?.length ? (
            <div className={styles.emptyState}>No community activity yet. Start the first owner-hub discussion.</div>
          ) : (
            <div className={styles.stack}>
              {dashboard.recentCommunityThreads.map((thread) => (
                <div key={thread._id} className={styles.listCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <div>
                      <strong>{thread.title}</strong>
                      <div className={styles.metaText}>Started by {thread.createdBy?.name}</div>
                    </div>
                    <span className={styles.pill} style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>
                      {thread.replyCount || 0} repl{thread.replyCount === 1 ? 'y' : 'ies'}
                    </span>
                  </div>
                  <div className={styles.metaText} style={{ marginTop: 'var(--space-3)' }}>
                    {thread.latestReply?.text || thread.body}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.header} style={{ marginBottom: 'var(--space-4)' }}>
            <div>
              <h1 style={{ fontSize: 'var(--font-size-xl)' }}>Monthly Reports</h1>
              <p>Build a report by hotel, month, date basis, booking status, and grouping style.</p>
            </div>
            <Link to="/owner/reports" className={styles.secondaryBtn}>Open reports</Link>
          </div>

          <div className={styles.stack}>
            <div className={styles.listCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div>
                  <strong>Custom monthly report builder</strong>
                  <div className={styles.metaText}>Switch between booking created date, check-in date, room view, hotel view, or status view.</div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-xl)', display: 'grid', placeItems: 'center', background: 'rgba(37,99,235,0.12)', color: '#2563eb' }}>
                  <FiBarChart2 size={18} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.panel} style={{ marginBottom: 'var(--space-6)' }}>
        <div className={styles.header} style={{ marginBottom: 'var(--space-4)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-xl)' }}>Guest Support Queue</h1>
            <p>Open guest conversations that need your attention right now.</p>
          </div>
          <Link to="/support" className={styles.secondaryBtn}>View all chats</Link>
        </div>

        {!dashboard?.recentConversations?.length ? (
          <div className={styles.emptyState}>No guest queries are waiting right now.</div>
        ) : (
          <div className={styles.stack}>
            {dashboard.recentConversations.map((conversation) => (
              <div key={conversation._id} className={styles.listCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{conversation.user?.name}</strong>
                    <div className={styles.metaText}>{conversation.user?.email}</div>
                    <div className={styles.metaText}>{conversation.hotel?.title}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={styles.pill} style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}>Open query</span>
                    <div className={styles.metaText} style={{ marginTop: '6px' }}>{formatDate(conversation.lastMessageAt)}</div>
                  </div>
                </div>
                <div className={styles.metaText} style={{ marginTop: 'var(--space-3)', lineHeight: 1.7 }}>
                  <strong style={{ color: 'var(--color-text-primary)' }}>{conversation.subject}</strong>
                  <div>{conversation.latestMessage?.text || 'New guest query received.'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.panel}>
        <div className={styles.header} style={{ marginBottom: 'var(--space-4)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-xl)' }}>Recent Booking Activity</h1>
            <p>The latest reservations across the hotels you manage.</p>
          </div>
        </div>

        {!dashboard?.recentBookings?.length ? (
          <div className={styles.emptyState}>No booking activity yet. Once guests start reserving your properties, they’ll appear here.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Hotel</th>
                  <th>Date</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentBookings.map((booking) => (
                  <tr key={booking._id}>
                    <td>
                      <strong>{booking.user?.name}</strong>
                      <div className={styles.metaText}>{booking.user?.email}</div>
                    </td>
                    <td>
                      <strong>{booking.hotel?.title}</strong>
                      <div className={styles.metaText}>{booking.hotel?.address?.city}</div>
                    </td>
                    <td>{formatDate(booking.createdAt)}</td>
                    <td>{formatCurrency(booking.pricing?.totalPrice || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
