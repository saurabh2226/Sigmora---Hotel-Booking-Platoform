import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  FiStar,
  FiMapPin,
  FiHeart,
  FiShare2,
  FiChevronLeft,
  FiChevronRight,
  FiCheck,
  FiMessageCircle,
} from 'react-icons/fi';
import { fetchHotel, clearSelectedHotel, fetchAvailability } from '../redux/slices/hotelSlice';
import { fetchHotelReviews } from '../redux/slices/reviewSlice';
import { toggleWishlist } from '../redux/slices/wishlistSlice';
import { formatCurrency, formatDate } from '../utils/formatters';
import { getImageUrl } from '../utils/helpers';
import { AMENITY_ICONS, DEFAULT_OFFER_COLOR, GOOGLE_MAPS_KEY, normalizeRole } from '../utils/constants';
import { formatInputDate, getMinCheckout, getToday, getTomorrow, getNights } from '../utils/dateUtils';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';
import Loader from '../components/common/Loader/Loader';
import toast from 'react-hot-toast';
import styles from './HotelDetailsPage.module.css';

export default function HotelDetailsPage() {
  const { idOrSlug } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selectedHotel: hotel, rooms, availability, loading } = useSelector((s) => s.hotels);
  const { reviews, categoryStats } = useSelector((s) => s.reviews);
  const { hotelIds } = useSelector((s) => s.wishlist);
  const { isAuthenticated, user } = useAuth();
  const socket = useSocket();
  const thumbsRef = useRef(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [checkIn, setCheckIn] = useState(getToday());
  const [checkOut, setCheckOut] = useState(getTomorrow());
  const [guests, setGuests] = useState(2);
  const [showAllOffers, setShowAllOffers] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const minimumCheckoutDate = checkIn ? formatInputDate(getMinCheckout(checkIn)) : getTomorrow();

  useEffect(() => {
    dispatch(fetchHotel(idOrSlug));
    return () => dispatch(clearSelectedHotel());
  }, [idOrSlug, dispatch]);

  useEffect(() => {
    if (hotel?._id) {
      dispatch(fetchHotelReviews({ hotelId: hotel._id, params: { limit: 12 } }));
    }
  }, [hotel?._id, dispatch]);

  useEffect(() => {
    if (!hotel?._id || !checkIn || !checkOut || getNights(checkIn, checkOut) < 1) {
      return;
    }

    dispatch(fetchAvailability({
      id: hotel._id,
      params: { checkIn, checkOut, guests },
    }));
  }, [dispatch, hotel?._id, checkIn, checkOut, guests]);

  useEffect(() => {
    if (!socket || !hotel?._id) {
      return undefined;
    }

    const eventName = `availability:${hotel._id}`;
    const refreshAvailability = () => {
      if (checkIn && checkOut && getNights(checkIn, checkOut) > 0) {
        dispatch(fetchAvailability({
          id: hotel._id,
          params: { checkIn, checkOut, guests },
        }));
      }
    };

    socket.on(eventName, refreshAvailability);

    return () => {
      socket.off(eventName, refreshAvailability);
    };
  }, [socket, hotel?._id, dispatch, checkIn, checkOut, guests]);

  useEffect(() => {
    if (!hotel?.images?.length || hotel.images.length < 2) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setImgIdx((current) => (current + 1) % hotel.images.length);
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [hotel?.images]);

  useEffect(() => {
    setImgIdx(0);
    setShowAllOffers(false);
    setShowAllReviews(false);
  }, [hotel?._id]);

  useEffect(() => {
    const thumbRail = thumbsRef.current;
    const thumbNode = thumbRail?.children?.[imgIdx];
    if (!thumbRail || !thumbNode) {
      return;
    }

    const targetLeft = thumbNode.offsetLeft - (thumbRail.clientWidth / 2) + (thumbNode.clientWidth / 2);
    thumbRail.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: 'smooth',
    });
  }, [imgIdx]);

  useEffect(() => {
    if (!hotel?._id) {
      return undefined;
    }

    const refreshHotelDetail = () => {
      dispatch(fetchHotel(idOrSlug));
      if (checkIn && checkOut && getNights(checkIn, checkOut) > 0) {
        dispatch(fetchAvailability({
          id: hotel._id,
          params: { checkIn, checkOut, guests },
        }));
      }
    };

    socket?.on(`hotel-updated:${hotel._id}`, refreshHotelDetail);

    return () => {
      socket?.off(`hotel-updated:${hotel._id}`, refreshHotelDetail);
    };
  }, [socket, hotel?._id, idOrSlug, dispatch, checkIn, checkOut, guests]);

  const handleWishlist = () => {
    if (!isAuthenticated) return toast.error('Please login first');
    dispatch(toggleWishlist(hotel._id));
  };

  if (loading) return <Loader fullPage />;
  if (!hotel) return <div className="page container"><h2>Hotel not found</h2></div>;

  const nights = getNights(checkIn, checkOut);
  const isWishlisted = hotelIds.includes(hotel._id);
  const availabilityMap = Object.fromEntries((availability || []).map((item) => [String(item.roomId), item]));
  const roomCards = rooms.map((room) => ({
    ...room,
    liveAvailability: availabilityMap[room._id] || null,
  }));
  const firstAvailableRoom = roomCards.find((room) => room.liveAvailability?.available) || roomCards[0] || null;
  const sidebarPricing = firstAvailableRoom?.liveAvailability?.dynamicPricing || null;
  const displayedOffers = showAllOffers ? hotel.offers : hotel.offers?.slice(0, 3);
  const visibleReviews = showAllReviews ? reviews : reviews?.slice(0, 3);
  const mapQuery = hotel.address?.coordinates?.lat && hotel.address?.coordinates?.lng
    ? `${hotel.address.coordinates.lat},${hotel.address.coordinates.lng}`
    : [hotel.title, hotel.address?.city, hotel.address?.state, hotel.address?.country].filter(Boolean).join(', ');
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const mapsEmbedUrl = GOOGLE_MAPS_KEY
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&q=${encodeURIComponent(mapQuery)}`
    : '';

  return (
    <div className={`page ${styles.page}`}>
      <div className="container">
        <div className={styles.gallery}>
          <div className={styles.mainImage}>
            <img
              key={hotel.images?.[imgIdx]?.url || imgIdx}
              className={styles.galleryImage}
              src={hotel.images?.[imgIdx]?.url || getImageUrl(hotel.images)}
              alt={hotel.title}
            />
            <button type="button" className={styles.galleryNav} style={{ left: 12 }} onClick={() => setImgIdx((current) => (current === 0 ? (hotel.images?.length || 1) - 1 : current - 1))}>
              <FiChevronLeft />
            </button>
            <button type="button" className={styles.galleryNav} style={{ right: 12 }} onClick={() => setImgIdx((current) => ((current + 1) % (hotel.images?.length || 1)))}>
              <FiChevronRight />
            </button>
            <div className={styles.imgCount}>{imgIdx + 1} / {hotel.images?.length || 1}</div>
          </div>
          <div ref={thumbsRef} className={styles.thumbs}>
            {hotel.images?.map((img, i) => (
              <div key={i} className={`${styles.thumb} ${imgIdx === i ? styles.activeThumb : ''}`} onClick={() => setImgIdx(i)}>
                <img src={img.url} alt={img.caption || hotel.title} />
              </div>
            ))}
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.mainContent}>
            <div className={styles.header}>
              <div>
                <span className={styles.typeBadge}>{hotel.type}</span>
                <h1>{hotel.title}</h1>
                <p className={styles.location}>
                  <FiMapPin />
                  {hotel.address?.city}, {hotel.address?.state}, {hotel.address?.country}
                </p>
              </div>
              <div className={styles.headerActions}>
                <button type="button" className={`${styles.actionBtn} ${isWishlisted ? styles.wishlisted : ''}`} onClick={handleWishlist}>
                  <FiHeart />
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => navigator.clipboard.writeText(window.location.href).then(() => toast.success('Link copied!'))}
                >
                  <FiShare2 />
                </button>
              </div>
            </div>

            <div className={styles.ratingBox}>
              <div className={styles.ratingBig}>
                <FiStar className={styles.starFill} />
                {hotel.rating?.toFixed(1)}
              </div>
              <span>{hotel.totalReviews} reviews</span>
            </div>

            {hotel.offers?.length > 0 && (
              <div className={styles.offerStack}>
                <div className={styles.offerHeaderCompact}>
                  <h3>Offers</h3>
                  {hotel.offers.length > 3 && (
                    <button type="button" className={styles.offerToggleBtn} onClick={() => setShowAllOffers((current) => !current)}>
                      {showAllOffers ? 'Show less' : 'See all'}
                    </button>
                  )}
                </div>
                <div className={`${styles.offerRailCompact} ${showAllOffers ? styles.offerRailExpanded : ''}`}>
                  {displayedOffers.map((offer) => (
                    <div key={offer._id} className={styles.offerCompactCard} style={{ borderColor: `${offer.bannerColor || DEFAULT_OFFER_COLOR}26` }}>
                      <span className={styles.offerCompactBanner} style={{ background: offer.bannerColor || DEFAULT_OFFER_COLOR }}>
                        {offer.code}
                      </span>
                      <div>
                        <strong>{offer.bannerText || offer.title}</strong>
                        {offer.description ? <small>{offer.description}</small> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.section}>
              <h2>About This Property</h2>
              <p>{hotel.description}</p>
            </div>

            <div className={styles.section}>
              <h2>Amenities</h2>
              <div className={styles.amenitiesGrid}>
                {hotel.amenities?.map((a) => (
                  <div key={a} className={styles.amenityItem}>
                    <span className={styles.amenityIcon}>{AMENITY_ICONS[a] || '✅'}</span>
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <h2>Available Rooms</h2>
              <div className={styles.roomList}>
                {roomCards?.map((room) => {
                  const live = room.liveAvailability;
                  const isAvailable = live ? live.available : true;
                  const availableCount = live?.availableCount ?? room.totalRooms;
                  const livePricing = live?.dynamicPricing || null;
                  const displayedNightlyRate = livePricing?.nightlyRate || room.pricePerNight;

                  return (
                    <div key={room._id} className={styles.roomCard}>
                      <div className={styles.roomMedia}>
                        <img src={getImageUrl(room.images || hotel.images)} alt={room.title} loading="lazy" />
                      </div>
                      <div className={styles.roomInfo}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
                          <h3>{room.title}</h3>
                          <span
                            style={{
                              padding: '6px 12px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 700,
                              background: isAvailable ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                              color: isAvailable ? '#10b981' : '#ef4444',
                            }}
                          >
                            {isAvailable ? `${availableCount} room${availableCount === 1 ? '' : 's'} left` : 'Sold out for these dates'}
                          </span>
                        </div>
                        <div className={styles.roomMeta}>
                          <span>🛏 {room.bedType}</span>
                          <span>👥 {room.maxGuests} guests</span>
                          <span>📐 {room.roomSize} sq ft</span>
                        </div>
                        <div className={styles.roomAmenities}>
                          {room.amenities?.map((a) => (
                            <span key={a} className={styles.roomAmenity}>
                              <FiCheck size={12} /> {a}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={styles.roomPrice}>
                        <span className={styles.roomPriceAmount}>{formatCurrency(displayedNightlyRate)}</span>
                        <small>/ night</small>
                        {livePricing?.weekendNights > 0 || livePricing?.holidayNights > 0 ? (
                          <p className={styles.totalPrice}>Dynamic pricing active for selected dates</p>
                        ) : null}
                        {nights > 0 && (
                          <p className={styles.totalPrice}>
                            {formatCurrency(livePricing?.subtotal || room.pricePerNight * nights)} for {nights} night{nights > 1 ? 's' : ''}
                          </p>
                        )}
                        <Link
                          to={isAvailable ? `/booking/${hotel._id}/${room._id}` : '#'}
                          className={styles.bookRoomBtn}
                          style={!isAvailable ? { pointerEvents: 'none', opacity: 0.55 } : undefined}
                        >
                          {isAvailable ? 'Book Now' : 'Unavailable'}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.section}>
              <h2>Policies</h2>
              <div className={styles.policiesGrid}>
                <div><strong>Check-in:</strong> {hotel.policies?.checkInTime || '14:00'}</div>
                <div><strong>Check-out:</strong> {hotel.policies?.checkOutTime || '11:00'}</div>
                <div><strong>Cancellation:</strong> {hotel.policies?.cancellation}</div>
                <div><strong>Pets:</strong> {hotel.policies?.petsAllowed ? 'Allowed' : 'Not allowed'}</div>
              </div>
            </div>

            <div className={styles.section}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                <div>
                  <h2>Location & Map</h2>
                  <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                    {hotel.address?.street ? `${hotel.address.street}, ` : ''}{hotel.address?.city}, {hotel.address?.state}
                  </p>
                </div>
                <a href={mapsLink} target="_blank" rel="noreferrer" className={styles.checkAvailBtn} style={{ width: 'auto' }}>
                  Open in Google Maps
                </a>
              </div>
              {GOOGLE_MAPS_KEY ? (
                <>
                  <div className={styles.mapShell}>
                    <iframe
                      title={`${hotel.title} location`}
                      src={mapsEmbedUrl}
                      className={styles.mapFrame}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                    />
                  </div>
                </>
              ) : (
                <div style={{
                  minHeight: 220,
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  display: 'grid',
                  placeItems: 'center',
                  textAlign: 'center',
                  padding: 'var(--space-6)',
                  background: 'var(--color-bg-secondary)',
                }}
                >
                  <div>
                    <h3 style={{ marginBottom: 'var(--space-2)' }}>Google Maps API Key Not Configured</h3>
                    <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
                      Add `VITE_GOOGLE_MAPS_KEY` or `VITE_GOOGLE_MAPS_API_KEY`, enable the Maps Embed API, and restart the frontend.
                    </p>
                    <a href={mapsLink} target="_blank" rel="noreferrer" className={styles.checkAvailBtn} style={{ width: 'auto' }}>
                      View location in browser
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.section}>
              <h2>Guest Reviews</h2>
              {categoryStats && (
                <div className={styles.categoryBars}>
                  {['cleanliness', 'comfort', 'location', 'facilities', 'staff', 'valueForMoney'].map((cat) => (
                    <div key={cat} className={styles.catRow}>
                      <span>{cat}</span>
                      <div className={styles.catBar}>
                        <div className={styles.catFill} style={{ width: `${(categoryStats[`avg${cat.charAt(0).toUpperCase() + cat.slice(1)}`] || 0) * 20}%` }} />
                      </div>
                      <span>{(categoryStats[`avg${cat.charAt(0).toUpperCase() + cat.slice(1)}`] || 0).toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.reviewList}>
                {visibleReviews?.map((r, index) => (
                  <div key={r._id} className={styles.reviewCard}>
                    <div className={styles.reviewHeader}>
                      <div className={styles.reviewAvatar}>{r.user?.name?.[0]}</div>
                      <div>
                        <strong>{r.user?.name}</strong>
                        <small>{formatDate(r.createdAt)}</small>
                      </div>
                      <div className={styles.reviewRating}>
                        <FiStar style={{ fill: '#f59e0b', color: '#f59e0b' }} /> {r.rating}
                      </div>
                    </div>
                    {index < 3 && <span className={styles.reviewHighlight}>Top review</span>}
                    {r.title && <h4>{r.title}</h4>}
                    <p>{r.comment}</p>
                  </div>
                ))}
              </div>
              {(reviews?.length || 0) > 3 && (
                <div className={styles.reviewActions}>
                  <button type="button" className={styles.offerToggleBtn} onClick={() => setShowAllReviews((current) => !current)}>
                    {showAllReviews ? 'Show fewer reviews' : 'See all reviews'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <aside className={styles.bookingSidebar}>
            <div className={styles.bookingCard}>
              <div className={styles.bookingPrice}>
                {formatCurrency(hotel.pricePerNight)} <small>/ night</small>
              </div>
              <div className={styles.bookingDates}>
                <div className={styles.dateField}>
                  <label>Check-in</label>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => {
                      setCheckIn(e.target.value);
                      if (checkOut && getNights(e.target.value, checkOut) < 1) {
                        setCheckOut('');
                      }
                    }}
                    min={getToday()}
                  />
                </div>
                <div className={styles.dateField}>
                  <label>Check-out</label>
                  <input
                    type="date"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    min={minimumCheckoutDate}
                    disabled={!checkIn}
                  />
                </div>
              </div>
              <div className={styles.guestField}>
                <label>Guests</label>
                <select value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} Guest{n > 1 ? 's' : ''}</option>)}
                </select>
              </div>
              {nights > 0 && rooms?.[0] && (
                <div className={styles.priceSummary}>
                  <div className={styles.priceRow}>
                    <span>{formatCurrency(sidebarPricing?.nightlyRate || (firstAvailableRoom || rooms[0]).pricePerNight)} average × {nights} nights</span>
                    <span>{formatCurrency(sidebarPricing?.subtotal || (firstAvailableRoom || rooms[0]).pricePerNight * nights)}</span>
                  </div>
                  <div className={styles.priceRow}>
                    <span>Taxes (18%)</span>
                    <span>{formatCurrency(sidebarPricing?.taxes || (firstAvailableRoom || rooms[0]).pricePerNight * nights * 0.18)}</span>
                  </div>
                  <div className={styles.priceRow}>
                    <span>Service fee</span>
                    <span>{formatCurrency(sidebarPricing?.serviceFee || (firstAvailableRoom || rooms[0]).pricePerNight * nights * 0.05)}</span>
                  </div>
                  <div className={`${styles.priceRow} ${styles.totalRow}`}>
                    <span>Total</span>
                    <span>{formatCurrency(sidebarPricing?.totalPrice || (firstAvailableRoom || rooms[0]).pricePerNight * nights * 1.23)}</span>
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 'var(--space-3)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                {firstAvailableRoom?.liveAvailability?.available
                  ? `Live availability: ${firstAvailableRoom.liveAvailability.availableCount} room${firstAvailableRoom.liveAvailability.availableCount === 1 ? '' : 's'} remaining`
                  : 'Select new dates to see the next available room'}
              </div>
              <Link
                to={isAuthenticated ? `/support?hotel=${hotel._id}&hotelTitle=${encodeURIComponent(hotel.title)}` : '/support'}
                className={styles.supportBtn}
              >
                <FiMessageCircle />
                {normalizeRole(user?.role) === 'admin' ? 'Open Support Inbox' : 'Ask Admin Team'}
              </Link>
              <Link
                to={firstAvailableRoom?.liveAvailability?.available ? `/booking/${hotel._id}/${firstAvailableRoom._id}` : '#'}
                className={styles.checkAvailBtn}
                style={!firstAvailableRoom?.liveAvailability?.available ? { pointerEvents: 'none', opacity: 0.55 } : undefined}
              >
                {firstAvailableRoom?.liveAvailability?.available ? 'Book First Available Room' : 'No rooms for these dates'}
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
