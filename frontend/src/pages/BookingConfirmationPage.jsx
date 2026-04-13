import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  FiAlertCircle,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiDownload,
  FiMail,
  FiMapPin,
  FiPhone,
  FiRefreshCw,
  FiTag,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import { fetchBooking } from '../redux/slices/bookingSlice';
import { createRazorpayOrder, markRazorpayPaymentFailed, verifyRazorpayPayment } from '../api/paymentApi';
import { formatCurrency, formatDateLong } from '../utils/formatters';
import { getImageUrl } from '../utils/helpers';
import { RAZORPAY_KEY } from '../utils/constants';
import { loadRazorpayCheckout, openRazorpayCheckout } from '../utils/razorpayCheckout';
import { downloadBookingReceiptPdf } from '../utils/bookingReceiptPdf';
import Loader from '../components/common/Loader/Loader';
import toast from 'react-hot-toast';
import styles from './BookingConfirmationPage.module.css';

export default function BookingConfirmationPage() {
  const { bookingId } = useParams();
  const dispatch = useDispatch();
  const { selectedBooking: booking } = useSelector(s => s.bookings);
  const [retrying, setRetrying] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);

  useEffect(() => {
    dispatch(fetchBooking(bookingId));
  }, [bookingId, dispatch]);

  const holdIsActive = useMemo(() => (
    booking?.status === 'pending'
    && booking?.payment?.status === 'pending'
    && booking?.holdExpiresAt
    && new Date(booking.holdExpiresAt) > new Date()
  ), [booking]);

  const nights = useMemo(() => {
    if (booking?.pricing?.numberOfNights) {
      return booking.pricing.numberOfNights;
    }

    if (!booking?.checkIn || !booking?.checkOut) {
      return 0;
    }

    const diff = new Date(booking.checkOut) - new Date(booking.checkIn);
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
  }, [booking]);

  const statusTone = booking?.status === 'confirmed'
    ? { bg: 'rgba(16,185,129,0.12)', color: '#10b981', icon: <FiCheckCircle size={40} />, title: 'Booking Confirmed!' }
    : booking?.status === 'pending' && holdIsActive
      ? { bg: 'rgba(245,158,11,0.12)', color: '#d97706', icon: <FiClock size={40} />, title: 'Room Held Pending Payment' }
      : { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', icon: <FiAlertCircle size={40} />, title: 'Booking Closed' };

  const handleResumePayment = async () => {
    if (!booking) return;

    setRetrying(true);

    try {
      if (!RAZORPAY_KEY) {
        toast.error('Add your Razorpay frontend key to resume checkout.');
        return;
      }

      const scriptLoaded = await loadRazorpayCheckout();
      if (!scriptLoaded || !window.Razorpay) {
        toast.error('Razorpay checkout could not load right now.');
        return;
      }

      const { data: orderResponse } = await createRazorpayOrder({ bookingId: booking._id });
      const order = orderResponse.data;

      const result = await openRazorpayCheckout({
        bookingId: booking._id,
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        key: order.key || RAZORPAY_KEY,
        description: `Booking #${booking._id.slice(-6).toUpperCase()}`,
        prefill: {
          name: booking.guestDetails?.name || booking.user?.name || '',
          email: booking.guestDetails?.email || booking.user?.email || '',
          contact: booking.guestDetails?.phone || booking.user?.phone || '',
        },
        notes: {
          bookingId: booking._id,
          hotel: booking.hotel?.title || '',
          room: booking.room?.title || '',
        },
        onPaymentSuccess: async (response) => {
          await verifyRazorpayPayment({
            orderId: order.orderId,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
            bookingId: booking._id,
          });
        },
        onPaymentFailure: async (event) => {
          await markRazorpayPaymentFailed(booking._id, {
            reason: event?.error?.description || 'Payment failed in Razorpay checkout',
          });
        },
      });

      if (result.paid) {
        toast.success('Payment successful. Your stay is confirmed.');
      } else {
        toast.success('Your hold is still active. Complete payment before it expires.');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Could not resume payment');
    } finally {
      await dispatch(fetchBooking(bookingId));
      setRetrying(false);
    }
  };

  const handleDownloadReceipt = () => {
    if (!booking) return;

    try {
      setDownloadingReceipt(true);
      downloadBookingReceiptPdf(booking);
      toast.success('Your booking receipt is downloading.');
    } catch (error) {
      toast.error(error.message || 'Receipt could not be generated right now');
    } finally {
      window.setTimeout(() => {
        setDownloadingReceipt(false);
      }, 600);
    }
  };

  if (!booking) return <Loader fullPage />;

  const guestName = booking.guestDetails?.name || booking.user?.name || 'Guest';
  const guestEmail = booking.guestDetails?.email || booking.user?.email || 'Not shared';
  const guestPhone = booking.guestDetails?.phone || booking.user?.phone || 'Not shared';
  const roomTitle = booking.room?.title || 'Selected room';
  const roomType = booking.room?.type ? `${booking.room.type.charAt(0).toUpperCase()}${booking.room.type.slice(1)}` : 'Room';
  const couponCode = booking.pricing?.couponCode || '';
  const adults = booking.guests?.adults || 1;
  const children = booking.guests?.children || 0;
  const totalGuests = adults + children;
  const hotelLocation = [
    booking.hotel?.address?.city,
    booking.hotel?.address?.state,
  ].filter(Boolean).join(', ');
  const paymentLabel = booking.payment?.method ? booking.payment.method.charAt(0).toUpperCase() + booking.payment.method.slice(1) : 'Pending';

  return (
    <div className={`page container ${styles.page}`}>
      <div className={styles.hero}>
        <div className={styles.statusIcon} style={{ background: statusTone.bg, color: statusTone.color, borderColor: `${statusTone.color}20` }}>
          {statusTone.icon}
        </div>
        <div className={styles.heroCopy}>
          <h1>{statusTone.title}</h1>
          <p>
            {booking.status === 'confirmed'
              ? 'Your booking is confirmed and ready for your stay.'
              : holdIsActive
                ? `Your room is temporarily locked until ${new Date(booking.holdExpiresAt).toLocaleString()}.`
                : booking.cancellationReason || 'This booking is no longer holding inventory.'}
          </p>
          <div className={styles.heroActions}>
            <button type="button" onClick={handleDownloadReceipt} disabled={downloadingReceipt} className={styles.secondaryBtn}>
              <FiDownload size={16} /> {downloadingReceipt ? 'Preparing Receipt...' : 'Download Receipt PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        <section className={styles.mainColumn}>
          <div className={styles.propertyCard}>
            <div className={styles.propertyMedia}>
              <img src={getImageUrl(booking.room?.images || booking.hotel?.images)} alt={booking.hotel?.title || 'Booked hotel'} />
            </div>
            <div className={styles.propertyBody}>
              <div className={styles.propertyMetaRow}>
                <span className={styles.statusPill} style={{ background: statusTone.bg, color: statusTone.color }}>{booking.status}</span>
                <span className={styles.metaChip}><FiCreditCard size={14} /> {paymentLabel}</span>
              </div>
              <h2>{booking.hotel?.title || 'Sigmora Hotel'}</h2>
              <p className={styles.locationLine}>
                <FiMapPin size={14} />
                <span>{hotelLocation || 'Location details available on the hotel page'}</span>
              </p>
              <div className={styles.roomMeta}>
                <span>{roomTitle}</span>
                <span>{roomType}</span>
                <span>{nights} night{nights !== 1 ? 's' : ''}</span>
              </div>
              <div className={styles.inlineActions}>
                <Link to={booking.hotel ? `/hotels/${booking.hotel.slug || booking.hotel._id}` : '/hotels'} className={styles.secondaryBtn}>View Hotel</Link>
              </div>
            </div>
          </div>

          <div className={styles.infoGrid}>
            <div className={styles.infoCard}>
              <div className={styles.cardHeading}>
                <FiCalendar size={18} />
                <h3>Stay Details</h3>
              </div>
              <div className={styles.detailRows}>
                <div className={styles.detailRow}><span>Booking ID</span><strong>{booking._id?.slice(-8).toUpperCase()}</strong></div>
                <div className={styles.detailRow}><span>Check-in</span><strong>{formatDateLong(booking.checkIn)}</strong></div>
                <div className={styles.detailRow}><span>Check-out</span><strong>{formatDateLong(booking.checkOut)}</strong></div>
                <div className={styles.detailRow}><span>Nights</span><strong>{nights}</strong></div>
                <div className={styles.detailRow}><span>Guests</span><strong>{totalGuests} total</strong></div>
                <div className={styles.detailRow}><span>Adults</span><strong>{adults}</strong></div>
                <div className={styles.detailRow}><span>Children</span><strong>{children}</strong></div>
                {holdIsActive && (
                  <div className={styles.detailRow}><span>Hold expires</span><strong>{new Date(booking.holdExpiresAt).toLocaleString()}</strong></div>
                )}
                {booking.createdAt && (
                  <div className={styles.detailRow}><span>Booked on</span><strong>{formatDateLong(booking.createdAt)}</strong></div>
                )}
              </div>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.cardHeading}>
                <FiUser size={18} />
                <h3>Guest Details</h3>
              </div>
              <div className={styles.guestGrid}>
                <div className={styles.guestItem}>
                  <span><FiUser size={14} /> Guest name</span>
                  <strong>{guestName}</strong>
                </div>
                <div className={styles.guestItem}>
                  <span><FiMail size={14} /> Email</span>
                  <strong>{guestEmail}</strong>
                </div>
                <div className={styles.guestItem}>
                  <span><FiPhone size={14} /> Phone</span>
                  <strong>{guestPhone}</strong>
                </div>
                <div className={styles.guestItem}>
                  <span><FiUsers size={14} /> Room occupancy</span>
                  <strong>{adults} adult{adults !== 1 ? 's' : ''}{children ? `, ${children} child${children !== 1 ? 'ren' : ''}` : ''}</strong>
                </div>
              </div>
              <div className={styles.noteBox}>
                <span>Special requests</span>
                <p>{booking.guestDetails?.specialRequests?.trim() || 'No special requests were added during booking.'}</p>
              </div>
            </div>
          </div>
        </section>

        <aside className={styles.sidebar}>
          <div className={styles.summaryCard}>
            <div className={styles.cardHeading}>
              <FiCreditCard size={18} />
              <h3>Payment Summary</h3>
            </div>
            <div className={styles.detailRows}>
              <div className={styles.detailRow}><span>Base nightly rate</span><strong>{formatCurrency(booking.pricing?.baseNightlyRate || booking.pricing?.nightlyRate || booking.room?.pricePerNight || 0)}</strong></div>
              <div className={styles.detailRow}><span>Nightly charged rate</span><strong>{formatCurrency(booking.pricing?.nightlyRate || booking.room?.pricePerNight || 0)}</strong></div>
              <div className={styles.detailRow}><span>Payment status</span><strong>{booking.payment?.status || 'pending'}</strong></div>
              <div className={styles.detailRow}><span>Subtotal</span><strong>{formatCurrency(booking.pricing?.subtotal || 0)}</strong></div>
              <div className={styles.detailRow}><span>Taxes</span><strong>{formatCurrency(booking.pricing?.taxes || 0)}</strong></div>
              <div className={styles.detailRow}><span>Service fee</span><strong>{formatCurrency(booking.pricing?.serviceFee || 0)}</strong></div>
              {couponCode && (
                <div className={styles.detailRow}><span><FiTag size={13} /> Coupon</span><strong>{couponCode}</strong></div>
              )}
              {(booking.pricing?.discount || 0) > 0 && (
                <div className={styles.detailRow}><span>Discount applied</span><strong className={styles.discountText}>- {formatCurrency(booking.pricing?.discount || 0)}</strong></div>
              )}
              {booking.payment?.transactionId && (
                <div className={styles.detailRow}><span>Transaction</span><strong>{booking.payment.transactionId}</strong></div>
              )}
              {booking.refundAmount > 0 && (
                <div className={styles.detailRow}><span>Refund</span><strong className={styles.discountText}>{formatCurrency(booking.refundAmount)}</strong></div>
              )}
            </div>
            <div className={styles.totalRow}>
              <span>Total paid / payable</span>
              <strong>{formatCurrency(booking.pricing?.totalPrice || 0)}</strong>
            </div>
          </div>

          <div className={styles.actionCard}>
            <h3>Next actions</h3>
            <div className={styles.actionStack}>
              <button type="button" onClick={handleDownloadReceipt} disabled={downloadingReceipt} className={styles.secondaryBtn}>
                <FiDownload size={16} /> {downloadingReceipt ? 'Preparing Receipt...' : 'Download Receipt PDF'}
              </button>
              {holdIsActive && (
                <button onClick={handleResumePayment} disabled={retrying} className={styles.primaryBtn}>
                  <FiRefreshCw size={16} /> {retrying ? 'Opening Checkout...' : 'Complete Payment'}
                </button>
              )}
              <Link to="/dashboard" className={holdIsActive ? styles.secondaryBtn : styles.primaryBtn}>My Bookings</Link>
              <Link to="/hotels" className={styles.ghostBtn}>Browse Hotels</Link>
            </div>
            {holdIsActive && (
              <p className={styles.helperText}>
                If payment fails, the room will be released automatically so someone else can book it.
              </p>
            )}
          </div>
        </aside>
      </div>

      <div className={styles.mobileActionBar}>
        <button type="button" onClick={handleDownloadReceipt} disabled={downloadingReceipt} className={styles.secondaryBtn}>
          <FiDownload size={16} /> {downloadingReceipt ? 'Preparing Receipt...' : 'Receipt PDF'}
        </button>
        {holdIsActive && (
          <button onClick={handleResumePayment} disabled={retrying} className={styles.primaryBtn}>
            <FiRefreshCw size={16} /> {retrying ? 'Opening Checkout...' : 'Complete Payment'}
          </button>
        )}
        <Link to="/dashboard" className={holdIsActive ? styles.secondaryBtn : styles.primaryBtn}>My Bookings</Link>
        <Link to="/hotels" className={styles.ghostBtn}>Browse Hotels</Link>
      </div>
    </div>
  );
}
