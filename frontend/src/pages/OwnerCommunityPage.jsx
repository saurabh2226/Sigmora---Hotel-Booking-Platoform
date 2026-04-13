import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiFilter, FiMessageSquare, FiPlusCircle, FiSend } from 'react-icons/fi';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';
import * as ownerApi from '../api/ownerApi';
import { formatDate, formatRelativeTime } from '../utils/formatters';
import Loader from '../components/common/Loader/Loader';
import styles from './OwnerCommunityPage.module.css';

const CATEGORY_LABELS = {
  general: 'General',
  operations: 'Operations',
  pricing: 'Pricing',
  marketing: 'Marketing',
  support: 'Support',
  growth: 'Growth',
  'admin-updates': 'Admin Updates',
};

export default function OwnerCommunityPage() {
  const { user } = useAuth();
  const socket = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIdFromUrl = searchParams.get('thread') || '';

  const [threads, setThreads] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedId, setSelectedId] = useState(selectedIdFromUrl);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState({
    category: 'all',
    search: '',
  });
  const [threadForm, setThreadForm] = useState({
    title: '',
    category: 'general',
    body: '',
  });
  const [replyText, setReplyText] = useState('');

  const loadThreads = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }

      const { data } = await ownerApi.getOwnerCommunityThreads({
        category: filters.category !== 'all' ? filters.category : undefined,
        search: filters.search || undefined,
      });

      const incomingThreads = data.data.threads || [];
      const incomingCategories = data.data.categories || [];
      setThreads(incomingThreads);
      setCategories(incomingCategories);

      const preferredId = selectedIdFromUrl || selectedId;
      const nextId = incomingThreads.some((thread) => thread._id === preferredId)
        ? preferredId
        : incomingThreads[0]?._id || '';
      setSelectedId(nextId);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load admin community');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadThreads();
  }, [filters.category, selectedIdFromUrl]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const refreshThreads = () => {
      loadThreads({ silent: true }).catch(() => {});
    };

    socket.on('notification:new', refreshThreads);

    return () => {
      socket.off('notification:new', refreshThreads);
    };
  }, [socket, filters.category, filters.search, selectedIdFromUrl, selectedId]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread._id === selectedId) || null,
    [threads, selectedId]
  );

  const summaryCards = useMemo(() => {
    const replyCount = threads.reduce((total, thread) => total + (thread.replyCount || 0), 0);
    return [
      { label: 'Active threads', value: threads.length },
      { label: 'Categories live', value: new Set(threads.map((thread) => thread.category)).size || categories.length || Object.keys(CATEGORY_LABELS).length },
      { label: 'Replies shared', value: replyCount },
    ];
  }, [threads, categories]);

  const handleSearchSubmit = async (event) => {
    event.preventDefault();
    await loadThreads();
  };

  const handleSelectThread = (threadId) => {
    setSelectedId(threadId);
    const next = new URLSearchParams(searchParams);
    next.set('thread', threadId);
    setSearchParams(next);
  };

  const handleCreateThread = async (event) => {
    event.preventDefault();

    if (!threadForm.title.trim() || !threadForm.body.trim()) {
      toast.error('Add both a title and discussion details');
      return;
    }

    try {
      setSubmitting(true);
      const { data } = await ownerApi.createOwnerCommunityThread(threadForm);
      const createdThread = data.data.thread;
      setThreadForm({
        title: '',
        category: 'general',
        body: '',
      });
      toast.success('Discussion posted to the admin hub');
      await loadThreads();
      handleSelectThread(createdThread._id);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create discussion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (event) => {
    event.preventDefault();
    if (!selectedThread || !replyText.trim()) {
      return;
    }

    try {
      setSubmitting(true);
      const { data } = await ownerApi.replyToOwnerCommunityThread(selectedThread._id, { text: replyText });
      const updatedThread = data.data.thread;
      setReplyText('');
      setThreads((current) => current.map((thread) => (thread._id === updatedThread._id ? updatedThread : thread)));
      toast.success('Reply posted');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && threads.length === 0) {
    return <Loader fullPage />;
  }

  return (
    <div className={`page container ${styles.page}`}>
      <div className={styles.header}>
        <div>
          <h1>Admin Community Hub</h1>
          <p>Discuss pricing, operations, growth, moderation, and support ideas with the rest of the Sigmora admin team.</p>
        </div>
        <div className={styles.headerActions}>
          <Link to="/admin" className={styles.ghostBtn}>Back</Link>
          <Link to="/admin/reports" className={styles.primaryBtn}>Monthly Reports</Link>
        </div>
      </div>

      <div className={styles.statsGrid}>
        {summaryCards.map((card) => (
          <div key={card.label} className={styles.statCard}>
            <strong>{card.value}</strong>
            <span>{card.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.topGrid}>
        <div className={styles.panelCard}>
          <div className={styles.sectionHeader}>
            <h2><FiPlusCircle size={18} /> Start a discussion</h2>
            <p>Open a new conversation for the admin team to collaborate on.</p>
          </div>
          <form className={styles.stack} onSubmit={handleCreateThread}>
            <div className={styles.formGrid}>
              <div className={styles.formFull}>
                <label>Title</label>
                <input
                  value={threadForm.title}
                  onChange={(event) => setThreadForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Example: Best pricing strategy for long weekends?"
                />
              </div>
              <div>
                <label>Category</label>
                <select
                  value={threadForm.category}
                  onChange={(event) => setThreadForm((current) => ({ ...current, category: event.target.value }))}
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formFull}>
                <label>Discussion details</label>
                <textarea
                  rows={5}
                  value={threadForm.body}
                  onChange={(event) => setThreadForm((current) => ({ ...current, body: event.target.value }))}
                  placeholder="Share context, your challenge, what has already worked, and what feedback you want from the rest of the admin team."
                />
              </div>
            </div>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? 'Posting...' : 'Post to admin hub'}
            </button>
          </form>
        </div>
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2>Community threads</h2>
            <span>{threads.length}</span>
          </div>
          <form className={styles.compactFilter} onSubmit={handleSearchSubmit}>
            <div className={styles.compactFilterTitle}>
              <FiFilter size={15} />
              <strong>Filter threads</strong>
            </div>
            <div className={styles.compactFilterRow}>
              <input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search title or topic"
              />
              <select
                value={filters.category}
                onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
              >
                <option value="all">All categories</option>
                {(categories.length ? categories : Object.keys(CATEGORY_LABELS)).map((category) => (
                  <option key={category} value={category}>{CATEGORY_LABELS[category] || category}</option>
                ))}
              </select>
            </div>
            <button type="submit" className={styles.secondaryBtn}>Apply filters</button>
          </form>

          {threads.length === 0 ? (
            <div className={styles.emptyState}>
              <FiMessageSquare size={20} />
              <p>No community threads match this filter yet.</p>
            </div>
          ) : (
            <div className={styles.threadList}>
              {threads.map((thread) => (
                <button
                  key={thread._id}
                  type="button"
                  className={`${styles.threadItem} ${selectedId === thread._id ? styles.threadItemActive : ''}`}
                  onClick={() => handleSelectThread(thread._id)}
                >
                  <div className={styles.threadHeaderRow}>
                    <strong>{thread.title}</strong>
                    <span className={styles.categoryPill}>{CATEGORY_LABELS[thread.category] || thread.category}</span>
                  </div>
                  <p>{thread.body}</p>
                  <div className={styles.threadMeta}>
                    <small>{thread.createdBy?.name}</small>
                    <small>{thread.replyCount || 0} repl{thread.replyCount === 1 ? 'y' : 'ies'}</small>
                    <small>{formatRelativeTime(thread.lastActivityAt || thread.createdAt)}</small>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className={styles.chatPanel}>
          {!selectedThread ? (
            <div className={styles.emptyPanel}>
              <FiMessageSquare size={28} />
              <h2>Select a thread</h2>
              <p>Choose a discussion from the left to join the admin community conversation.</p>
            </div>
          ) : (
            <div className={styles.panelCard}>
              <div className={styles.threadDetailHeader}>
                <div>
                  <div className={styles.inlineMeta}>
                    <span className={styles.categoryPill}>{CATEGORY_LABELS[selectedThread.category] || selectedThread.category}</span>
                    <span className={styles.metaText}>Started by {selectedThread.createdBy?.name}</span>
                    <span className={styles.metaText}>{formatDate(selectedThread.createdAt)}</span>
                  </div>
                  <h2>{selectedThread.title}</h2>
                </div>
              </div>

              <div className={styles.messages}>
                <div className={`${styles.messageBubble} ${selectedThread.createdBy?._id === user?._id ? styles.messageMine : styles.messageOther}`}>
                  <strong>{selectedThread.createdBy?.name} <span>Admin</span></strong>
                  <p>{selectedThread.body}</p>
                  <small>{formatDate(selectedThread.createdAt)}</small>
                </div>

                {selectedThread.replies?.map((reply) => {
                  const isMine = reply.author?._id === user?._id || reply.author === user?._id;
                  return (
                    <div key={reply._id} className={`${styles.messageBubble} ${isMine ? styles.messageMine : styles.messageOther}`}>
                      <strong>{reply.author?.name} <span>Admin</span></strong>
                      <p>{reply.text}</p>
                      <small>{formatDate(reply.createdAt)}</small>
                    </div>
                  );
                })}
              </div>

              <form className={styles.messageForm} onSubmit={handleReply}>
                <textarea
                  rows={4}
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Share your perspective, answer another admin's question, or add an operations update here."
                />
                <button type="submit" className={styles.primaryBtn} disabled={submitting}>
                  <FiSend size={14} />
                  {submitting ? 'Sending...' : 'Reply to thread'}
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
