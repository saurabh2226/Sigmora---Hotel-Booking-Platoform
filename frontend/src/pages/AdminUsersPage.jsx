import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as adminApi from '../api/adminApi';
import { formatDate } from '../utils/formatters';
import Loader from '../components/common/Loader/Loader';
import styles from './AdminWorkspace.module.css';

const getReviewPreview = (review) => {
  const source = review.title?.trim() || review.comment?.trim() || 'Guest review';
  return source.length > 64 ? `${source.slice(0, 61)}...` : source;
};

export default function AdminUsersPage() {
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'user',
    phone: '',
    password: '',
  });
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    status: '',
    page: 1,
  });
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data } = await adminApi.getUsers({
        page: filters.page,
        limit: 12,
        search: filters.search || undefined,
        role: filters.role || undefined,
        status: filters.status || undefined,
      });
      setUsers(data.data.users);
      setPagination({
        page: data.data.currentPage,
        totalPages: data.data.totalPages,
        total: data.data.totalResults,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [filters.page, filters.role, filters.status]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setFilters((current) => ({ ...current, page: 1 }));
    loadUsers();
  };

  const handleRoleChange = async (userId, role) => {
    try {
      setBusyUserId(userId);
      await adminApi.changeUserRole(userId, { role });
      setUsers((current) => current.map((user) => (user._id === userId ? { ...user, role } : user)));
      toast.success('User role updated');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update role');
    } finally {
      setBusyUserId('');
    }
  };

  const handleStatusToggle = async (userId, isActive) => {
    try {
      setBusyUserId(userId);
      await adminApi.changeUserStatus(userId, { isActive: !isActive });
      setUsers((current) => current.map((user) => (user._id === userId ? { ...user, isActive: !isActive } : user)));
      toast.success(`User ${isActive ? 'deactivated' : 'activated'}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status');
    } finally {
      setBusyUserId('');
    }
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();

    try {
      setCreatingUser(true);
      const { data } = await adminApi.createUser({
        ...newUser,
        password: newUser.password || undefined,
        phone: newUser.phone || undefined,
      });
      setCreatedCredentials(data.data.credentials);
      setNewUser({
        name: '',
        email: '',
        role: 'user',
        phone: '',
        password: '',
      });
      toast.success('User created and credentials shared');
      await loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div className={`page container ${styles.page}`}>
      <div className={styles.header}>
        <div>
          <h1>Manage Users</h1>
          <p>Control access levels, search the customer base, and deactivate accounts that should not access the platform.</p>
        </div>
        <div className={styles.actions}>
          <Link to="/admin" className={styles.secondaryBtn}>Back to Dashboard</Link>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.header} style={{ marginBottom: 'var(--space-4)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-xl)' }}>Create Account From Admin Panel</h1>
            <p>Create a user or main admin account here. If you leave the password blank, Sigmora will generate a secure temporary one and email it automatically.</p>
          </div>
        </div>

        <form className={styles.stack} onSubmit={handleCreateUser}>
          <div className={styles.formGrid}>
            <div>
              <label className={styles.label}>Full name</label>
              <input
                className={styles.input}
                value={newUser.name}
                onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))}
                placeholder="Full name"
                required
              />
            </div>
            <div>
              <label className={styles.label}>Email</label>
              <input
                className={styles.input}
                type="email"
                value={newUser.email}
                onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
                placeholder="name@example.com"
                required
              />
            </div>
            <div>
              <label className={styles.label}>Role</label>
              <select
                className={styles.select}
                value={newUser.role}
                onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value }))}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className={styles.label}>Phone</label>
              <input
                className={styles.input}
                value={newUser.phone}
                onChange={(event) => setNewUser((current) => ({ ...current, phone: event.target.value }))}
                placeholder="Optional Indian mobile number"
              />
            </div>
            <div className={styles.formFull}>
              <label className={styles.label}>Temporary password</label>
              <input
                className={styles.input}
                value={newUser.password}
                onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
                placeholder="Leave blank to auto-generate a secure password"
              />
              <div className={styles.hint}>If you enter a password manually, it should include uppercase, lowercase, a number, and a special character.</div>
            </div>
          </div>

          <div className={styles.inlineActions}>
            <button type="submit" className={styles.primaryBtn} disabled={creatingUser}>
              {creatingUser ? 'Creating user...' : 'Create & email credentials'}
            </button>
          </div>
        </form>

        {createdCredentials && (
          <div className={styles.alertBanner} style={{ margin: 'var(--space-5) 0' }}>
            <div>
              <strong>Newest account credentials</strong>
              <p><strong>Email:</strong> {createdCredentials.email} <span style={{ marginLeft: 12 }}><strong>Password:</strong> {createdCredentials.password}</span></p>
            </div>
          </div>
        )}

        <form className={styles.toolbar} onSubmit={handleSearchSubmit}>
          <input
            className={styles.input}
            value={filters.search}
            onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))}
            placeholder="Search by name or email"
          />
          <select
            className={styles.select}
            value={filters.role}
            onChange={(e) => setFilters((current) => ({ ...current, role: e.target.value, page: 1 }))}
          >
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <select
            className={styles.select}
            value={filters.status}
            onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value, page: 1 }))}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button type="submit" className={styles.primaryBtn}>Search</button>
        </form>

        <div className={styles.cardGrid} style={{ marginBottom: 'var(--space-4)' }}>
          <div className={styles.metricCard}>
            <strong>{pagination.total}</strong>
            <span>Total matching users</span>
          </div>
          <div className={styles.metricCard}>
            <strong>{users.filter((user) => user.role === 'admin').length}</strong>
            <span>Admins on this page</span>
          </div>
          <div className={styles.metricCard}>
            <strong>{users.filter((user) => user.isActive).length}</strong>
            <span>Active on this page</span>
          </div>
          <div className={styles.metricCard}>
            <strong>{users.filter((user) => (user.reviewCount || 0) > 0).length}</strong>
            <span>Reviewers on this page</span>
          </div>
        </div>

        {loading ? <Loader /> : (
          <div className={styles.tableWrap}>
            <table className={styles.table} style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Provider</th>
                  <th>Joined</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Reviews</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td>
                      <strong>{user.name}</strong>
                      <div className={styles.metaText}>{user.email}</div>
                    </td>
                    <td>
                      <span className={styles.tag}>{user.provider || 'local'}</span>
                    </td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <select
                        className={styles.select}
                        value={user.role}
                        disabled={busyUserId === user._id}
                        onChange={(e) => handleRoleChange(user._id, e.target.value)}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <span
                        className={styles.pill}
                        style={{
                          background: user.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                          color: user.isActive ? '#10b981' : '#ef4444',
                        }}
                      >
                        {user.isActive ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td>
                      {user.reviewCount > 0 ? (
                        <div className={styles.stack} style={{ gap: '10px' }}>
                          <span className={styles.tag}>{user.reviewCount} review{user.reviewCount === 1 ? '' : 's'}</span>
                          {user.recentReviews?.map((review) => (
                            <div key={review._id} className={styles.metaText}>
                              <strong style={{ color: 'var(--color-text-primary)' }}>{review.hotel?.title || 'Hotel'}</strong>
                              <div>{review.rating}/5 • {getReviewPreview(review)}</div>
                              <div>{formatDate(review.createdAt)}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className={styles.metaText}>No reviews yet</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={user.isActive ? styles.dangerBtn : styles.primaryBtn}
                        disabled={busyUserId === user._id}
                        onClick={() => handleStatusToggle(user._id, user.isActive)}
                      >
                        {busyUserId === user._id ? 'Saving...' : user.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="7">
                      <div className={styles.emptyState}>No users found for this filter set.</div>
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
    </div>
  );
}
