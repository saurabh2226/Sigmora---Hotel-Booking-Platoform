import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiClock, FiMessageCircle, FiSend } from 'react-icons/fi';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';
import * as supportApi from '../api/supportApi';
import { normalizeRole } from '../utils/constants';
import { formatDate } from '../utils/formatters';
import Loader from '../components/common/Loader/Loader';
import styles from './SupportCenterPage.module.css';

export default function SupportCenterPage() {
  const { user } = useAuth();
  const socket = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const hotelId = searchParams.get('hotel') || '';
  const hotelTitle = searchParams.get('hotelTitle') || '';
  const conversationIdFromUrl = searchParams.get('conversation') || '';
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(conversationIdFromUrl);
  const [draftMessage, setDraftMessage] = useState('');
  const [newConversation, setNewConversation] = useState({
    subject: hotelTitle ? `Questions about ${hotelTitle}` : '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [assistantDraft, setAssistantDraft] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask me for a city, a budget, amenities, offers, or personalized stay suggestions and I’ll pull matching Sigmora data for you.',
      hotels: [],
    },
  ]);

  const normalizedRole = normalizeRole(user?.role);
  const isAdmin = normalizedRole === 'admin';

  const loadConversations = async () => {
    try {
      setLoading(true);
      const { data } = await supportApi.getSupportConversations();
      const incoming = data.data.conversations || [];
      setConversations(incoming);

      const preferredId = conversationIdFromUrl || (hotelId ? '' : selectedId) || '';
      const nextId = incoming.some((conversation) => conversation._id === preferredId)
        ? preferredId
        : hotelId
          ? ''
          : incoming[0]?._id || '';
      setSelectedId(nextId);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load support conversations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [conversationIdFromUrl, hotelId]);

  useEffect(() => {
    setNewConversation((current) => ({
      ...current,
      subject: hotelTitle ? `Questions about ${hotelTitle}` : current.subject,
    }));
  }, [hotelTitle]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleSupportUpdate = () => {
      loadConversations();
    };

    socket.on('support:updated', handleSupportUpdate);
    return () => socket.off('support:updated', handleSupportUpdate);
  }, [socket, conversationIdFromUrl, hotelId, selectedId]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation._id === selectedId) || null,
    [conversations, selectedId]
  );

  const handleSelect = (conversation) => {
    setSelectedId(conversation._id);
    const next = new URLSearchParams(searchParams);
    next.set('conversation', conversation._id);
    next.delete('hotel');
    next.delete('hotelTitle');
    setSearchParams(next);
  };

  const handleStartConversation = async (event) => {
    event.preventDefault();

    if (!hotelId) {
      toast.error('Choose a hotel to start support');
      return;
    }

    if (!newConversation.message.trim()) {
      toast.error('Enter your message');
      return;
    }

    try {
      setSubmitting(true);
      const { data } = await supportApi.createSupportConversation({
        hotelId,
        subject: newConversation.subject,
        message: newConversation.message,
      });
      const conversation = data.data.conversation;
      toast.success('Support chat started');
      setNewConversation((current) => ({ ...current, message: '' }));
      await loadConversations();
      handleSelect(conversation);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to start conversation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!selectedConversation || !draftMessage.trim()) return;

    try {
      setSubmitting(true);
      const { data } = await supportApi.sendSupportMessage(selectedConversation._id, { text: draftMessage });
      setDraftMessage('');
      setConversations((current) => current.map((conversation) => (
        conversation._id === selectedConversation._id ? data.data.conversation : conversation
      )));
      toast.success('Message sent');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send message');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (status) => {
    if (!selectedConversation) return;

    try {
      const { data } = await supportApi.updateSupportConversationStatus(selectedConversation._id, { status });
      setConversations((current) => current.map((conversation) => (
        conversation._id === selectedConversation._id ? data.data.conversation : conversation
      )));
      toast.success(`Conversation ${status}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update conversation');
    }
  };

  const handleAssistantSubmit = async (event) => {
    event.preventDefault();
    if (!assistantDraft.trim()) {
      return;
    }

    const prompt = assistantDraft.trim();
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: prompt,
      hotels: [],
    };

    setAssistantMessages((current) => [...current, userMessage]);
    setAssistantDraft('');

    try {
      setAssistantLoading(true);
      const { data } = await supportApi.askSupportAssistant({ message: prompt });
      setAssistantMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: data.data.reply,
          hotels: data.data.hotels || [],
        },
      ]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Assistant could not answer right now');
    } finally {
      setAssistantLoading(false);
    }
  };

  if (loading && conversations.length === 0) {
    return <Loader fullPage />;
  }

  return (
    <div className={`page container ${styles.page}`}>
      <div className={styles.header}>
        <div>
          <h1>Support Chat</h1>
          <p>
            {isAdmin
              ? 'Reply to guest questions, manage active conversations, and keep every stay inquiry moving quickly.'
              : 'Ask the Sigmora admin team about rooms, check-in details, amenities, and anything else before you book.'}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link to={isAdmin ? '/admin' : '/dashboard'} className={styles.ghostBtn}>Back</Link>
        </div>
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2>Conversations</h2>
            <span>{conversations.length}</span>
          </div>

          {conversations.length === 0 ? (
            <div className={styles.emptyState}>
              <FiMessageCircle size={20} />
              <p>No conversations yet.</p>
            </div>
          ) : (
            <div className={styles.threadList}>
              {conversations.map((conversation) => {
                const latestMessage = conversation.messages?.[conversation.messages.length - 1];
                return (
                  <button
                    key={conversation._id}
                    type="button"
                    className={`${styles.threadItem} ${selectedId === conversation._id ? styles.threadItemActive : ''}`}
                    onClick={() => handleSelect(conversation)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                      <strong>{conversation.hotel?.title}</strong>
                      <span className={`${styles.statusPill} ${conversation.status === 'closed' ? styles.closed : styles.open}`}>{conversation.status}</span>
                    </div>
                    <p>{conversation.subject}</p>
                    <small>{latestMessage?.text || 'No messages yet'}</small>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className={styles.chatPanel}>
          {!selectedConversation ? (
            hotelId && !isAdmin ? (
              <div className={styles.panelCard}>
                <div className={styles.hotelSupportBadge}>
                  <span>Hotel-specific support</span>
                  <strong>{hotelTitle || 'Selected hotel'}</strong>
                </div>
                <h2>Start a support chat</h2>
                <p>Reach out directly to the Sigmora admin team for {hotelTitle || 'this property'}.</p>
                <form className={styles.stack} onSubmit={handleStartConversation}>
                  <div>
                    <label>Subject</label>
                    <input value={newConversation.subject} onChange={(event) => setNewConversation((current) => ({ ...current, subject: event.target.value }))} />
                  </div>
                  <div>
                    <label>Your message</label>
                    <textarea rows={5} value={newConversation.message} onChange={(event) => setNewConversation((current) => ({ ...current, message: event.target.value }))} placeholder="Ask about availability, early check-in, transport, nearby attractions, or anything else." />
                  </div>
                  <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Starting...' : 'Start conversation'}</button>
                </form>
              </div>
            ) : (
              <div className={styles.emptyPanel}>
                <FiMessageCircle size={28} />
                <h2>Select a conversation</h2>
                <p>Choose a thread from the left, or start one from any hotel details page.</p>
              </div>
            )
          ) : (
            <div className={styles.panelCard}>
              <div className={styles.chatHeader}>
                <div>
                  <h2>{selectedConversation.subject}</h2>
                  <p>
                    {selectedConversation.hotel?.title} • {selectedConversation.hotel?.address?.city}
                  </p>
                </div>
                <div className={styles.inlineActions}>
                  <span className={`${styles.statusPill} ${selectedConversation.status === 'closed' ? styles.closed : styles.open}`}>
                    {selectedConversation.status === 'closed' ? <FiCheckCircle size={12} /> : <FiClock size={12} />}
                    {selectedConversation.status}
                  </span>
                  <button type="button" className={styles.ghostBtn} onClick={() => handleStatusChange(selectedConversation.status === 'open' ? 'closed' : 'open')}>
                    {selectedConversation.status === 'open' ? 'Close chat' : 'Reopen'}
                  </button>
                </div>
              </div>

              <div className={styles.messages}>
                {selectedConversation.messages?.map((message) => {
                  const isMine = message.sender?._id === user?._id || message.sender === user?._id;
                  return (
                    <div key={message._id} className={`${styles.messageBubble} ${isMine ? styles.messageMine : styles.messageOther}`}>
                      <strong>{message.sender?.name || (message.senderRole === 'user' ? 'Guest' : 'Admin')}</strong>
                      <p>{message.text}</p>
                      <small>{formatDate(message.createdAt)}</small>
                    </div>
                  );
                })}
              </div>

              <form className={styles.messageForm} onSubmit={handleSendMessage}>
                <textarea rows={3} value={draftMessage} onChange={(event) => setDraftMessage(event.target.value)} placeholder="Type your message here..." />
                <button type="submit" className={styles.primaryBtn} disabled={submitting || selectedConversation.status === 'closed'}>
                  <FiSend size={14} />
                  {submitting ? 'Sending...' : 'Send'}
                </button>
              </form>
            </div>
          )}
        </section>
      </div>

      <section className={styles.assistantLauncher}>
        <div>
          <h2>{isAdmin ? 'Need a quick draft or insight?' : 'Need a quick answer before you chat?'}</h2>
          <p>
            {isAdmin
              ? 'Open the AI assistant for fast reply drafts, hotel suggestions, and on-platform context while you manage support.'
              : 'Open the AI assistant for quick travel suggestions and hotel discovery, then continue with the admin team if you still need help.'}
          </p>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => setShowAssistant((current) => !current)}>
          <FiMessageCircle size={14} />
          {showAssistant ? 'Hide AI Assistant' : 'Open AI Assistant'}
        </button>
      </section>

      {showAssistant && (
        <section className={styles.assistantPanel}>
          <div className={styles.assistantHeader}>
            <div>
              <h2>Sigmora AI Concierge</h2>
              <p>Chat with the in-app assistant to get descriptive hotel suggestions, offer hints, and availability-oriented stay guidance pulled from the live database.</p>
            </div>
          </div>

          <div className={styles.assistantMessages}>
            {assistantMessages.map((message) => (
              <div key={message.id} className={`${styles.assistantBubble} ${message.role === 'user' ? styles.assistantUser : styles.assistantReply}`}>
                <strong>{message.role === 'user' ? 'You' : 'Sigmora AI'}</strong>
                <p>{message.text}</p>
                {message.hotels?.length > 0 && (
                  <div className={styles.assistantHotelList}>
                    {message.hotels.map((hotel) => (
                      <Link key={hotel._id} to={`/hotels/${hotel.slug || hotel._id}`} className={styles.assistantHotelCard}>
                        <strong>{hotel.title}</strong>
                        <span>{hotel.address?.city}, {hotel.address?.state}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form className={styles.assistantForm} onSubmit={handleAssistantSubmit}>
            <textarea
              rows={3}
              value={assistantDraft}
              onChange={(event) => setAssistantDraft(event.target.value)}
              placeholder="Try: recommend a weekend stay in Udaipur under 5000 with pool and breakfast"
            />
            <button type="submit" className={styles.primaryBtn} disabled={assistantLoading}>
              <FiSend size={14} />
              {assistantLoading ? 'Thinking...' : 'Ask assistant'}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
