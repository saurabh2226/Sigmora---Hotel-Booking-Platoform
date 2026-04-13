import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiBarChart2, FiCalendar, FiDownloadCloud, FiFilter, FiTrendingUp } from 'react-icons/fi';
import * as ownerApi from '../api/ownerApi';
import { formatCurrency } from '../utils/formatters';
import Loader from '../components/common/Loader/Loader';
import styles from './OwnerReportsPage.module.css';

const GROUP_OPTIONS = {
  day: 'Day',
  hotel: 'Hotel',
  room: 'Room',
  status: 'Status',
};

const DATE_FIELD_OPTIONS = {
  createdAt: 'Booking created date',
  checkIn: 'Check-in date',
  checkOut: 'Check-out date',
};

const STATUS_OPTIONS = {
  all: 'All statuses',
  pending: 'Pending',
  confirmed: 'Confirmed',
  'checked-in': 'Checked in',
  'checked-out': 'Checked out',
  cancelled: 'Cancelled',
  'no-show': 'No show',
};

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Date(2026, index, 1).toLocaleDateString('en-IN', { month: 'long' }),
}));

const currentDate = new Date();

const buildYears = () => Array.from({ length: 5 }, (_, index) => currentDate.getFullYear() - 2 + index);

export default function OwnerReportsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
    hotelId: '',
    groupBy: 'day',
    status: 'all',
    dateField: 'createdAt',
    includeCancelled: true,
    comparePrevious: true,
  });

  const loadReport = async () => {
    try {
      setLoading(true);
      const { data } = await ownerApi.getOwnerMonthlyReport(filters);
      setReport(data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load monthly report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [filters.month, filters.year, filters.hotelId, filters.groupBy, filters.status, filters.dateField, filters.includeCancelled, filters.comparePrevious]);

  const reportTitle = useMemo(() => {
    const activeMonth = MONTH_OPTIONS.find((month) => month.value === Number(filters.month));
    return `${activeMonth?.label || 'Month'} ${filters.year}`;
  }, [filters.month, filters.year]);

  if (loading && !report) {
    return <Loader fullPage />;
  }

  const summaryCards = [
    { label: 'Total bookings', value: report?.summary?.totalBookings || 0, icon: <FiCalendar />, color: '#2563eb' },
    { label: 'Completed payments', value: report?.summary?.completedPayments || 0, icon: <FiBarChart2 />, color: '#0f766e' },
    { label: 'Net revenue', value: formatCurrency(report?.summary?.netRevenue || 0), icon: <FiTrendingUp />, color: '#f59e0b' },
    { label: 'Refund total', value: formatCurrency(report?.summary?.refundTotal || 0), icon: <FiDownloadCloud />, color: '#dc2626' },
  ];
  const comparisonRevenueDelta = Number(report?.comparison?.delta?.netRevenue || 0);

  return (
    <div className={`page container ${styles.page}`}>
      <div className={styles.header}>
        <div>
          <h1>Monthly Booking Reports</h1>
          <p>Customise the admin report by month, hotel, status, grouping style, and date basis to understand exactly how the platform is performing.</p>
        </div>
        <div className={styles.headerActions}>
          <Link to="/admin" className={styles.ghostBtn}>Back</Link>
          <Link to="/admin/community" className={styles.secondaryBtn}>Admin Hub</Link>
        </div>
      </div>

      <div className={styles.filterPanel}>
        <div className={styles.filterHeader}>
          <h2><FiFilter size={18} /> Report controls</h2>
          <span>{reportTitle}</span>
        </div>
        <div className={styles.filterGrid}>
          <label>
            <span>Month</span>
            <select value={filters.month} onChange={(event) => setFilters((current) => ({ ...current, month: Number(event.target.value) }))}>
              {MONTH_OPTIONS.map((month) => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Year</span>
            <select value={filters.year} onChange={(event) => setFilters((current) => ({ ...current, year: Number(event.target.value) }))}>
              {buildYears().map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Hotel</span>
            <select value={filters.hotelId} onChange={(event) => setFilters((current) => ({ ...current, hotelId: event.target.value }))}>
              <option value="">All hotels</option>
              {(report?.hotels || []).map((hotel) => (
                <option key={hotel._id} value={hotel._id}>{hotel.title}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Group by</span>
            <select value={filters.groupBy} onChange={(event) => setFilters((current) => ({ ...current, groupBy: event.target.value }))}>
              {Object.entries(GROUP_OPTIONS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Status filter</span>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              {Object.entries(STATUS_OPTIONS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Date basis</span>
            <select value={filters.dateField} onChange={(event) => setFilters((current) => ({ ...current, dateField: event.target.value }))}>
              {Object.entries(DATE_FIELD_OPTIONS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={filters.includeCancelled}
              onChange={(event) => setFilters((current) => ({ ...current, includeCancelled: event.target.checked }))}
            />
            <span>Include cancelled and no-show bookings</span>
          </label>
          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={filters.comparePrevious}
              onChange={(event) => setFilters((current) => ({ ...current, comparePrevious: event.target.checked }))}
            />
            <span>Compare with previous month</span>
          </label>
        </div>
      </div>

      <div className={styles.cardGrid}>
        {summaryCards.map((card) => (
          <div key={card.label} className={styles.metricCard}>
            <div className={styles.metricMeta}>
              <div>
                <span>{card.label}</span>
                <strong style={{ color: card.color }}>{card.value}</strong>
              </div>
              <div className={styles.metricIcon} style={{ color: card.color, background: `${card.color}15` }}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {report?.comparison && (
        <div className={styles.comparisonBanner}>
          <strong>Compared with {report.comparison.label}</strong>
          <p>
            Bookings: {report.comparison.delta.totalBookings >= 0 ? '+' : ''}{report.comparison.delta.totalBookings} ·
            Net revenue: {comparisonRevenueDelta >= 0 ? '+' : '-'}{formatCurrency(Math.abs(comparisonRevenueDelta))}
          </p>
        </div>
      )}

      <div className={styles.reportLayout}>
        <section className={styles.tablePanel}>
          <div className={styles.sectionHeader}>
            <h2>Breakdown by {GROUP_OPTIONS[filters.groupBy].toLowerCase()}</h2>
            <p>Use the filters above to change how the bookings are grouped.</p>
          </div>

          {!report?.breakdown?.length ? (
            <div className={styles.emptyState}>No bookings matched the selected report settings.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{GROUP_OPTIONS[filters.groupBy]}</th>
                    <th>Bookings</th>
                    <th>Guests</th>
                    <th>Gross revenue</th>
                    <th>Refunds</th>
                    <th>Net revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.breakdown.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <strong>{row.label}</strong>
                        {row.subLabel ? <div className={styles.metaText}>{row.subLabel}</div> : null}
                      </td>
                      <td>{row.bookings}</td>
                      <td>{row.guests}</td>
                      <td>{formatCurrency(row.grossRevenue || 0)}</td>
                      <td>{formatCurrency(row.refunds || 0)}</td>
                      <td>{formatCurrency(row.netRevenue || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className={styles.summaryPanel}>
          <div className={styles.summaryCard}>
            <h2>Report snapshot</h2>
            <div className={styles.summaryList}>
              <div><span>Total guests covered</span><strong>{report?.summary?.totalGuests || 0}</strong></div>
              <div><span>Confirmed or stayed</span><strong>{report?.summary?.confirmedBookings || 0}</strong></div>
              <div><span>Pending</span><strong>{report?.summary?.pendingBookings || 0}</strong></div>
              <div><span>Cancelled / no-show</span><strong>{report?.summary?.cancelledBookings || 0}</strong></div>
              <div><span>Average booking value</span><strong>{formatCurrency(report?.summary?.averageBookingValue || 0)}</strong></div>
              <div><span>Selected date basis</span><strong>{DATE_FIELD_OPTIONS[filters.dateField]}</strong></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
