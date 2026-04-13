import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { FiCreditCard, FiArrowLeft, FiAlertCircle, FiMapPin, FiCalendar } from 'react-icons/fi';
import { createBooking } from '../redux/slices/bookingSlice';
import { createRazorpayOrder, markRazorpayPaymentFailed, verifyRazorpayPayment } from '../api/paymentApi';
import { getAvailability, getHotel, getRoom } from '../api/hotelApi';
import { formatCurrency } from '../utils/formatters';
import { DEFAULT_OFFER_COLOR, RAZORPAY_KEY } from '../utils/constants';
import { formatInputDate, getMinCheckout, getNights, getToday, getTomorrow } from '../utils/dateUtils';
import { isValidEmail, isValidPhone, isValidName, isFutureDate, isCheckoutAfterCheckin } from '../utils/validators';
import { getImageUrl } from '../utils/helpers';
import { loadRazorpayCheckout, openRazorpayCheckout } from '../utils/razorpayCheckout';
import { useSocket } from '../context/SocketContext';
import Loader from '../components/common/Loader/Loader';
import toast from 'react-hot-toast';
import styles from './BookingPage.module.css';

export default function BookingPage() {
  const { hotelId, roomId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading } = useSelector(s => s.bookings);
  const { user } = useSelector(s => s.auth);
  const socket = useSocket();

  const [form, setForm] = useState({
    checkIn: getToday(),
    checkOut: getTomorrow(),
    adults: 2,
    children: 0,
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    couponCode: '',
    specialRequests: '',
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [stayDetails, setStayDetails] = useState({
    hotel: null,
    room: null,
    roomAvailability: null,
    loading: true,
  });
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showAllOffers, setShowAllOffers] = useState(false);
  const [couponDialog, setCouponDialog] = useState({
    open: false,
    title: '',
    description: '',
  });

  const nights = getNights(form.checkIn, form.checkOut);
  const totalGuests = Number(form.adults) + Number(form.children);
  const livePricing = stayDetails.roomAvailability?.dynamicPricing || null;
  const roomSubtotal = livePricing?.subtotal ?? (nights > 0 && stayDetails.room ? stayDetails.room.pricePerNight * nights : 0);
  const estimatedTaxes = livePricing?.taxes ?? Math.round(roomSubtotal * 0.18 * 100) / 100;
  const estimatedServiceFee = livePricing?.serviceFee ?? Math.round(roomSubtotal * 0.05 * 100) / 100;
  const selectedOffer = stayDetails.hotel?.offers?.find((offer) => offer.code === form.couponCode);
  const getOfferEstimate = useCallback((offer) => {
    if (!offer || roomSubtotal < (offer.minBookingAmount || 0)) return 0;

    const rawDiscount = offer.discountType === 'percentage'
      ? (roomSubtotal * offer.discountValue) / 100
      : offer.discountValue;

    return Math.round(Math.min(rawDiscount, offer.maxDiscount || Number.MAX_SAFE_INTEGER) * 100) / 100;
  }, [roomSubtotal]);
  const estimatedDiscount = getOfferEstimate(selectedOffer);
  const estimatedTotal = Math.round((roomSubtotal + estimatedTaxes + estimatedServiceFee - estimatedDiscount) * 100) / 100;
  const isRoomUnavailable = stayDetails.roomAvailability ? !stayDetails.roomAvailability.available : false;
  const displayedOffers = showAllOffers ? stayDetails.hotel?.offers || [] : stayDetails.hotel?.offers?.slice(0, 4) || [];
  const mergedGalleryImages = [...(stayDetails.room?.images || []), ...(stayDetails.hotel?.images || [])].slice(0, 8);
  const galleryImages = mergedGalleryImages.length
    ? mergedGalleryImages
    : [{ url: getImageUrl(stayDetails.hotel?.images), caption: 'Featured stay' }];
  const minimumCheckoutDate = form.checkIn ? formatInputDate(getMinCheckout(form.checkIn)) : getTomorrow();

  useEffect(() => {
    let ignore = false;

    const fetchStayDetails = async () => {
      try {
        setStayDetails((current) => ({ ...current, loading: true }));
        const [{ data: hotelResponse }, { data: roomResponse }] = await Promise.all([
          getHotel(hotelId),
          getRoom(hotelId, roomId),
        ]);

        if (ignore) return;

        setStayDetails((current) => ({
          ...current,
          hotel: hotelResponse.data.hotel,
          room: roomResponse.data.room,
          loading: false,
        }));
      } catch (error) {
        if (ignore) return;
        toast.error(error.response?.data?.message || 'Unable to load stay details');
        navigate('/hotels', { replace: true });
      }
    };

    fetchStayDetails();

    return () => {
      ignore = true;
    };
  }, [hotelId, roomId, navigate]);

  useEffect(() => {
    let ignore = false;

    const fetchRoomAvailability = async () => {
      if (!hotelId || !form.checkIn || !form.checkOut || nights < 1) {
        return;
      }

      try {
        const { data } = await getAvailability(hotelId, {
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          guests: totalGuests,
        });
        if (ignore) return;

        const matchedRoom = data.data.availability.find((room) => String(room.roomId) === roomId) || null;
        setStayDetails((current) => ({
          ...current,
          roomAvailability: matchedRoom,
        }));
      } catch (error) {
        if (ignore) return;
        setStayDetails((current) => ({
          ...current,
          roomAvailability: null,
        }));
      }
    };

    fetchRoomAvailability();

    return () => {
      ignore = true;
    };
  }, [hotelId, roomId, form.checkIn, form.checkOut, totalGuests, nights]);

  useEffect(() => {
    if (!socket || !hotelId) {
      return undefined;
    }

    const refreshBookingContext = async () => {
      try {
        const [{ data: hotelResponse }, { data: roomResponse }, { data: availabilityResponse }] = await Promise.all([
          getHotel(hotelId),
          getRoom(hotelId, roomId),
          getAvailability(hotelId, {
            checkIn: form.checkIn,
            checkOut: form.checkOut,
            guests: totalGuests,
          }),
        ]);
        const matchedRoom = availabilityResponse.data.availability.find((room) => String(room.roomId) === roomId) || null;

        setStayDetails((current) => ({
          ...current,
          hotel: hotelResponse.data.hotel,
          room: roomResponse.data.room,
          roomAvailability: matchedRoom,
        }));
      } catch (error) {
        console.error(error);
      }
    };

    socket.on(`hotel-updated:${hotelId}`, refreshBookingContext);

    return () => {
      socket.off(`hotel-updated:${hotelId}`, refreshBookingContext);
    };
  }, [socket, hotelId, roomId, form.checkIn, form.checkOut, totalGuests]);

  const validateField = useCallback((name, value, currentForm = form) => {
    switch (name) {
      case 'name':
        if (!value?.trim()) return 'Guest name is required';
        if (!isValidName(value)) return 'Name must be 2-50 characters, letters only';
        return '';
      case 'email':
        if (!value?.trim()) return 'Email is required';
        if (!isValidEmail(value)) return 'Enter a valid email address';
        return '';
      case 'phone':
        if (!value?.trim()) return 'Phone number is required';
        if (!isValidPhone(value)) return 'Enter a valid Indian phone number';
        return '';
      case 'checkIn':
        if (!value) return 'Check-in date is required';
        if (!isFutureDate(value)) return 'Check-in cannot be earlier than today';
        return '';
      case 'checkOut':
        if (!value) return 'Check-out date is required';
        if (!currentForm.checkIn) return 'Select a check-in date first';
        if (!isCheckoutAfterCheckin(currentForm.checkIn, value)) return 'Check-out must be at least 1 day after check-in';
        if (getNights(currentForm.checkIn, value) > 30) return 'Maximum 30 nights per booking';
        return '';
      case 'adults':
        if (!value || value < 1) return 'At least 1 adult required';
        if (value > 10) return 'Maximum 10 adults';
        return '';
      case 'specialRequests':
        if (value && value.length > 500) return 'Special requests limited to 500 characters';
        return '';
      default:
        return '';
    }
  }, [form]);

  const handleChange = (name, value) => {
    const nextForm = { ...form, [name]: value };
    const nextTouched = { ...touched };
    const nextErrors = { ...errors };

    if (name === 'checkIn' && nextForm.checkOut && !isCheckoutAfterCheckin(nextForm.checkIn, nextForm.checkOut)) {
      nextTouched.checkOut = true;
      nextErrors.checkOut = validateField('checkOut', nextForm.checkOut, nextForm);
    }

    if (nextTouched[name]) {
      nextErrors[name] = validateField(name, nextForm[name], nextForm);
    }

    if (name === 'checkIn' && nextTouched.checkOut) {
      nextErrors.checkOut = validateField('checkOut', nextForm.checkOut, nextForm);
    }

    setForm(nextForm);
    setTouched(nextTouched);
    setErrors(nextErrors);
  };

  const handleBlur = (name) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, form[name], form) }));
  };

  const validateAll = () => {
    const fields = ['name', 'email', 'phone', 'checkIn', 'checkOut', 'adults'];
    const newErrors = {};
    fields.forEach((key) => {
      const error = validateField(key, form[key], form);
      if (error) newErrors[key] = error;
    });
    setErrors(newErrors);
    setTouched(Object.fromEntries(fields.map((field) => [field, true])));
    return Object.keys(newErrors).length === 0;
  };

  const showCouponAppliedDialog = (offer) => {
    const estimatedSavings = getOfferEstimate(offer);
    const savingsCopy = estimatedSavings > 0
      ? `Estimated savings for this stay: ${formatCurrency(estimatedSavings)}.`
      : offer?.minBookingAmount
        ? `This coupon becomes active on bookings from ${formatCurrency(offer.minBookingAmount)} onward.`
        : 'This coupon will be checked again during booking confirmation.';

    setCouponDialog({
      open: true,
      title: `Congratulations! ${offer.code} applied`,
      description: `${offer.bannerText || offer.title} is now attached to your booking. ${savingsCopy}`,
    });
  };

  const applyCoupon = (offer) => {
    setForm((current) => ({
      ...current,
      couponCode: offer.code,
    }));
    showCouponAppliedDialog(offer);
  };

  const handleManualCouponApply = () => {
    const normalizedCode = form.couponCode.trim().toUpperCase();

    if (!normalizedCode) {
      toast.error('Enter a coupon code first');
      return;
    }

    const matchedOffer = stayDetails.hotel?.offers?.find((offer) => offer.code === normalizedCode);
    if (!matchedOffer) {
      toast.error('This coupon is not available for the selected hotel');
      return;
    }

    setForm((current) => ({
      ...current,
      couponCode: normalizedCode,
    }));
    showCouponAppliedDialog(matchedOffer);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateAll()) {
      toast.error('Please fix the form errors');
      return;
    }
    if (nights < 1) {
      toast.error('Invalid date range');
      return;
    }
    if (!stayDetails.room) {
      toast.error('Room details are still loading');
      return;
    }
    if (isRoomUnavailable) {
      toast.error('This room is not available for the selected dates');
      return;
    }

    setCheckoutLoading(true);

    const bookingResult = await dispatch(createBooking({
      hotel: hotelId,
      room: roomId,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      guests: { adults: Number(form.adults), children: Number(form.children) },
      guestDetails: {
        name: form.name,
        email: form.email,
        phone: form.phone,
        specialRequests: form.specialRequests,
      },
      couponCode: form.couponCode || undefined,
    }));

    if (bookingResult.meta.requestStatus !== 'fulfilled') {
      setCheckoutLoading(false);
      toast.error(bookingResult.payload || 'Booking failed');
      return;
    }

    const booking = bookingResult.payload.booking;

    try {
      if (!RAZORPAY_KEY) {
        toast.success('Booking created. Add your Razorpay frontend key to launch checkout.');
        navigate(`/booking/confirmation/${booking._id}`);
        return;
      }

      const scriptLoaded = await loadRazorpayCheckout();
      if (!scriptLoaded || !window.Razorpay) {
        toast.success('Booking created in pending state. Razorpay checkout could not load right now.');
        navigate(`/booking/confirmation/${booking._id}`);
        return;
      }

      const { data: orderResponse } = await createRazorpayOrder({ bookingId: booking._id });
      const order = orderResponse.data;
      const paymentResult = await openRazorpayCheckout({
        bookingId: booking._id,
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        key: order.key,
        description: `Booking #${booking._id.slice(-6).toUpperCase()}`,
        prefill: {
          name: form.name,
          email: form.email,
          contact: form.phone,
        },
        notes: {
          bookingId: booking._id,
          hotel: stayDetails.hotel?.title || '',
          room: stayDetails.room?.title || '',
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

      if (paymentResult.paid) {
        toast.success('Payment successful! Your stay is confirmed.');
      } else {
        toast.success('Room locked for a few minutes. You can complete payment from the confirmation page.');
      }

      navigate(`/booking/confirmation/${booking._id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Payment could not be completed');
      navigate(`/booking/confirmation/${booking._id}`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const getFieldClass = (name) => {
    if (!touched[name]) return styles.field;
    if (errors[name]) return `${styles.field} ${styles.fieldErr}`;
    return `${styles.field} ${styles.fieldOk}`;
  };

  if (stayDetails.loading) {
    return <Loader fullPage />;
  }

  return (
    <div className={`page container ${styles.page}`}>
      <div className={styles.pageHeader}>
        <button onClick={() => navigate(-1)} className={styles.backBtn}><FiArrowLeft /> Back</button>
        <div>
          <span className={styles.kicker}>Secure reservation</span>
          <h1 className={styles.title}>Complete Your Booking</h1>
          <p className={styles.subtitle}>
            Review your stay details, guest profile, offers, and live pricing before you continue to Razorpay.
          </p>
        </div>
      </div>

      <form className={styles.layout} onSubmit={handleSubmit} noValidate>
        <div className={styles.formSection}>
          <div className={styles.bookingGallery}>
            <div className={styles.bookingGalleryTrack}>
              {[...galleryImages, ...galleryImages].map((image, index) => (
                <div key={`${image.url}-${index}`} className={styles.galleryCard}>
                  <img src={image.url} alt={image.caption || stayDetails.hotel?.title || 'Hotel preview'} />
                  <span>{image.caption || stayDetails.hotel?.title}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.formIntro}>
            <div className={styles.introCopy}>
              <span className={styles.introEyebrow}>{stayDetails.hotel?.type || 'Featured stay'}</span>
              <h2 className={styles.introTitle}>{stayDetails.hotel?.title}</h2>
              <p className={styles.introLocation}><FiMapPin size={14} /> {stayDetails.hotel?.address?.city}, {stayDetails.hotel?.address?.state}</p>
              <p className={styles.introText}>
                You are reserving <strong>{stayDetails.room?.title}</strong> with live inventory protection, dynamic pricing, and checkout support built in.
              </p>
            </div>

            <div className={styles.introMetaGrid}>
              <div className={styles.introStat}>
                <span>Room</span>
                <strong>{stayDetails.room?.title}</strong>
              </div>
              <div className={styles.introStat}>
                <span>Guests</span>
                <strong>{totalGuests} total</strong>
              </div>
              <div className={styles.introStat}>
                <span>Stay</span>
                <strong>{nights > 0 ? `${nights} night${nights !== 1 ? 's' : ''}` : 'Select dates'}</strong>
              </div>
              <div className={styles.introStat}>
                <span>Est. total</span>
                <strong>{formatCurrency(estimatedTotal)}</strong>
              </div>
            </div>
          </div>

          {stayDetails.roomAvailability && (
            <div className={`${styles.availabilityBanner} ${stayDetails.roomAvailability.available ? styles.available : styles.unavailable}`}>
              {stayDetails.roomAvailability.available
                ? `Live availability confirmed: ${stayDetails.roomAvailability.availableCount} room${stayDetails.roomAvailability.availableCount === 1 ? '' : 's'} left for these dates.`
                : 'Selected room is unavailable for these dates. Try different dates to continue.'}
            </div>
          )}

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Guest Details</h2>
                <p>These details will be used for your confirmation, receipt, and hotel contact.</p>
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={getFieldClass('name')}>
                <label>Full Name *</label>
                <input type="text" value={form.name} onChange={e => handleChange('name', e.target.value)} onBlur={() => handleBlur('name')} required />
                {touched.name && errors.name && <span className={styles.errMsg}><FiAlertCircle size={12} /> {errors.name}</span>}
              </div>
              <div className={getFieldClass('email')}>
                <label>Email *</label>
                <input type="email" value={form.email} onChange={e => handleChange('email', e.target.value)} onBlur={() => handleBlur('email')} required />
                {touched.email && errors.email && <span className={styles.errMsg}><FiAlertCircle size={12} /> {errors.email}</span>}
              </div>
              <div className={getFieldClass('phone')}>
                <label>Phone *</label>
                <input type="tel" placeholder="+91XXXXXXXXXX" value={form.phone} onChange={e => handleChange('phone', e.target.value)} onBlur={() => handleBlur('phone')} required />
                {touched.phone && errors.phone && <span className={styles.errMsg}><FiAlertCircle size={12} /> {errors.phone}</span>}
              </div>
            </div>
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Stay Details</h2>
                <p>Choose dates and occupancy. Pricing refreshes automatically for selected demand windows.</p>
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={getFieldClass('checkIn')}>
                <label>Check-in *</label>
                <input type="date" value={form.checkIn} onChange={e => handleChange('checkIn', e.target.value)} onBlur={() => handleBlur('checkIn')} min={getToday()} />
                {touched.checkIn && errors.checkIn && <span className={styles.errMsg}><FiAlertCircle size={12} /> {errors.checkIn}</span>}
              </div>
              <div className={getFieldClass('checkOut')}>
                <label>Check-out *</label>
                <input
                  type="date"
                  value={form.checkOut}
                  onChange={e => handleChange('checkOut', e.target.value)}
                  onBlur={() => handleBlur('checkOut')}
                  min={minimumCheckoutDate}
                  disabled={!form.checkIn}
                />
                {touched.checkOut && errors.checkOut && <span className={styles.errMsg}><FiAlertCircle size={12} /> {errors.checkOut}</span>}
              </div>
              <div className={getFieldClass('adults')}>
                <label>Adults *</label>
                <select value={form.adults} onChange={e => handleChange('adults', Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Children</label>
                <select value={form.children} onChange={e => handleChange('children', Number(e.target.value))}>
                  {[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <p className={styles.dateHelper}>Past dates are disabled, and check-out must always be at least one day after check-in.</p>
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Offers and Coupon Code</h2>
                <p>Apply a coupon directly or pick from the live hotel offers below.</p>
              </div>
            </div>

            <div className={styles.couponSection}>
              <div className={styles.couponInputRow}>
                <div className={styles.field}>
                  <label>Coupon Code</label>
                  <input type="text" placeholder="Enter coupon (e.g. WELCOME20)" value={form.couponCode} onChange={e => setForm({ ...form, couponCode: e.target.value.toUpperCase() })} maxLength={20} />
                </div>
                <button type="button" className={styles.couponActionBtn} onClick={handleManualCouponApply}>Apply Code</button>
              </div>
            </div>

            {stayDetails.hotel?.offers?.length > 0 && (
              <div className={styles.offerPanel}>
                <div className={styles.offerPanelHeader}>
                  <h3>Available Offers</h3>
                  <div className={styles.offerHeaderActions}>
                    <span>{stayDetails.hotel.offers.length}</span>
                    {stayDetails.hotel.offers.length > 4 && (
                      <button type="button" className={styles.offerToggleBtn} onClick={() => setShowAllOffers((current) => !current)}>
                        {showAllOffers ? 'Show less' : 'See all'}
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.offerList}>
                  {displayedOffers.map((offer) => (
                    <div key={offer._id} className={styles.offerCard}>
                      <span className={styles.offerBanner} style={{ background: offer.bannerColor || DEFAULT_OFFER_COLOR }}>{offer.code}</span>
                      <div className={styles.offerText}>
                        <strong>{offer.bannerText || offer.title}</strong>
                        <small>
                          {getOfferEstimate(offer) > 0
                            ? `Save about ${formatCurrency(getOfferEstimate(offer))}`
                            : offer.minBookingAmount
                              ? `Min. booking ${formatCurrency(offer.minBookingAmount)}`
                              : 'Checked again at confirmation'}
                        </small>
                      </div>
                      <button type="button" className={styles.offerApplyBtn} onClick={() => applyCoupon(offer)}>
                        Apply
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>Special Requests</h2>
                <p>Share anything the hotel should know before your arrival.</p>
              </div>
            </div>

            <div className={getFieldClass('specialRequests')}>
              <label>Special Requests <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>({form.specialRequests.length}/500)</span></label>
              <textarea rows={4} placeholder="Late check-in, extra pillows, airport pickup, etc." value={form.specialRequests} onChange={e => handleChange('specialRequests', e.target.value)} onBlur={() => handleBlur('specialRequests')} maxLength={500} />
              {touched.specialRequests && errors.specialRequests && <span className={styles.errMsg}><FiAlertCircle size={12} /> {errors.specialRequests}</span>}
            </div>
          </section>
        </div>

        <div className={styles.summary}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHero}>
              <span className={styles.summaryLabel}>Price overview</span>
              <h3>Booking Summary</h3>
              <p>{stayDetails.hotel?.title} · {stayDetails.room?.title}</p>
            </div>
            <div className={styles.summaryRow}><span>Hotel</span><span className={styles.summaryTextValue}>{stayDetails.hotel?.title}</span></div>
            <div className={styles.summaryRow}><span>Room</span><span className={styles.summaryTextValue}>{stayDetails.room?.title}</span></div>
            <div className={styles.summaryRow}>
              <span>Location</span>
              <span className={styles.summaryValueInline}><FiMapPin size={12} /> {stayDetails.hotel?.address?.city}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Stay</span>
              <span className={styles.summaryValueInline}><FiCalendar size={12} /> {nights > 0 ? `${nights} night${nights !== 1 ? 's' : ''}` : '—'}</span>
            </div>
            <div className={styles.summaryRow}><span>Guests</span><span className={styles.summaryTextValue}>{form.adults} adult{form.adults > 1 ? 's' : ''}{form.children > 0 ? `, ${form.children} child${form.children > 1 ? 'ren' : ''}` : ''}</span></div>
            <div className={styles.summaryRow}><span>Base nightly rate</span><span className={styles.summaryTextValue}>{formatCurrency(stayDetails.room?.pricePerNight || 0)}</span></div>
            <div className={styles.summaryRow}><span>Live nightly rate</span><span className={styles.summaryTextValue}>{formatCurrency(livePricing?.nightlyRate || stayDetails.room?.pricePerNight || 0)}</span></div>
            <div className={styles.summaryRow}><span>Subtotal</span><span className={styles.summaryTextValue}>{formatCurrency(roomSubtotal)}</span></div>
            <div className={styles.summaryRow}><span>Taxes (18%)</span><span className={styles.summaryTextValue}>{formatCurrency(estimatedTaxes)}</span></div>
            <div className={styles.summaryRow}><span>Service fee (5%)</span><span className={styles.summaryTextValue}>{formatCurrency(estimatedServiceFee)}</span></div>
            {estimatedDiscount > 0 && <div className={styles.summaryRow}><span>Offer savings</span><span className={styles.summaryTextValue}>-{formatCurrency(estimatedDiscount)}</span></div>}
            <div className={styles.summaryRow}><span>Estimated total</span><span className={styles.summaryTextValue}>{formatCurrency(estimatedTotal)}</span></div>

            {livePricing && (livePricing.weekendNights > 0 || livePricing.holidayNights > 0) && (
              <div className={styles.dynamicNote}>
                {livePricing.weekendNights > 0 && <span>{livePricing.weekendNights} weekend night{livePricing.weekendNights > 1 ? 's' : ''} at higher demand pricing.</span>}
                {livePricing.holidayNights > 0 && <span>{livePricing.holidayNights} holiday night{livePricing.holidayNights > 1 ? 's' : ''} included in this quote.</span>}
              </div>
            )}

            {stayDetails.roomAvailability && (
              <div className={`${styles.summaryAvailability} ${stayDetails.roomAvailability.available ? styles.available : styles.unavailable}`}>
                {stayDetails.roomAvailability.available
                  ? `Live availability confirmed: ${stayDetails.roomAvailability.availableCount} room${stayDetails.roomAvailability.availableCount === 1 ? '' : 's'} left`
                  : 'Selected room is unavailable for these dates'}
              </div>
            )}

            {form.couponCode && <div className={styles.couponTag}>Coupon entered: {form.couponCode}</div>}

            <button type="submit" className={styles.payBtn} disabled={loading || checkoutLoading || nights < 1 || isRoomUnavailable}>
              <FiCreditCard /> {loading || checkoutLoading ? 'Processing...' : 'Reserve & Pay with Razorpay'}
            </button>
            <p className={styles.secureTxt}>Secure checkout with Razorpay. Your room stays locked briefly while payment is pending, and failed payments release it automatically.</p>
          </div>
        </div>
      </form>
      {couponDialog.open && (
        <div className={styles.couponCelebrationOverlay} role="presentation" onClick={() => setCouponDialog({ open: false, title: '', description: '' })}>
          <div className={styles.couponCelebrationCard} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className={styles.couponCelebrationGlow} />
            <span className={styles.couponCelebrationBadge}>Offer unlocked</span>
            <h2>{couponDialog.title}</h2>
            <p>{couponDialog.description}</p>
            <button type="button" className={styles.couponCelebrationBtn} onClick={() => setCouponDialog({ open: false, title: '', description: '' })}>
              Continue booking
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
