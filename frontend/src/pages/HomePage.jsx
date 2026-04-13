import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { FiArrowRight, FiCheck, FiMapPin, FiSearch, FiShield, FiStar, FiSunrise, FiUsers, FiMessageCircle } from 'react-icons/fi';
import { fetchFeaturedHotels, fetchPopularDestinations, fetchRecommendations } from '../redux/slices/hotelSlice';
import { formatCurrency } from '../utils/formatters';
import { getImageUrl } from '../utils/helpers';
import { AMENITY_ICONS, DEFAULT_OFFER_COLOR, POPULAR_CITIES } from '../utils/constants';
import { formatInputDate, getMinCheckout, getToday, getTomorrow } from '../utils/dateUtils';
import { isCheckoutAfterCheckin, isValidEmail } from '../utils/validators';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';
import * as subscriptionApi from '../api/subscriptionApi';
import Loader from '../components/common/Loader/Loader';
import toast from 'react-hot-toast';
import styles from './HomePage.module.css';

const DEST_IMAGES = {
  Mumbai: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=900&q=80',
  Delhi: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=900&q=80',
  Bangalore: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=900&q=80',
  Goa: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=900&q=80',
  Jaipur: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=900&q=80',
  Udaipur: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=900&q=80',
  Kerala: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=900&q=80',
  Shimla: 'https://images.unsplash.com/photo-1597074866923-dc0589150a32?w=900&q=80',
};

const TRUST_POINTS = [
  { label: 'Verified hotels', value: '30,000+' },
  { label: 'Instant support', value: '24/7' },
  { label: 'Flexible trips', value: 'Easy edits' },
];

export default function HomePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const heroSceneRef = useRef(null);
  const destinationScrollerRef = useRef(null);
  const { featured, popularDestinations, recommended, loading } = useSelector((state) => state.hotels);
  const { isAuthenticated, user } = useAuth();
  const socket = useSocket();
  const [search, setSearch] = useState({ city: '', checkIn: '', checkOut: '', guests: 2 });
  const [newsletter, setNewsletter] = useState('');
  const [heroHotelId, setHeroHotelId] = useState('');
  const today = getToday();
  const minimumSearchCheckout = search.checkIn ? formatInputDate(getMinCheckout(search.checkIn)) : getTomorrow();

  useEffect(() => {
    dispatch(fetchFeaturedHotels());
    dispatch(fetchPopularDestinations());
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchRecommendations());
    }
  }, [dispatch, isAuthenticated]);

  useEffect(() => {
    if (!featured?.length) {
      return;
    }

    const heroCandidates = featured.filter((hotel) => Array.isArray(hotel.images) && hotel.images.length > 0);
    const nextCandidates = heroCandidates.length > 0 ? heroCandidates : featured;
    const randomHotel = nextCandidates[Math.floor(Math.random() * nextCandidates.length)];
    setHeroHotelId(randomHotel?._id || '');
  }, [featured]);

  useEffect(() => {
    const rail = destinationScrollerRef.current;
    if (!rail) {
      return undefined;
    }

    const handleWheel = (event) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }

      if (rail.scrollWidth <= rail.clientWidth) {
        return;
      }

      const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
      const canScrollForward = event.deltaY > 0 && rail.scrollLeft < maxScrollLeft - 1;
      const canScrollBackward = event.deltaY < 0 && rail.scrollLeft > 1;

      if (!canScrollForward && !canScrollBackward) {
        return;
      }

      event.preventDefault();
      rail.scrollLeft = Math.max(0, Math.min(maxScrollLeft, rail.scrollLeft + event.deltaY));
    };

    rail.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      rail.removeEventListener('wheel', handleWheel);
    };
  }, [popularDestinations.length]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const refreshCatalog = () => {
      dispatch(fetchFeaturedHotels());
      dispatch(fetchPopularDestinations());
      if (isAuthenticated) {
        dispatch(fetchRecommendations());
      }
    };

    socket.on('hotel-catalog-updated', refreshCatalog);

    return () => {
      socket.off('hotel-catalog-updated', refreshCatalog);
    };
  }, [socket, dispatch, isAuthenticated]);

  const handleSearch = (event) => {
    event.preventDefault();
    if (!search.city) {
      toast.error('Please choose a destination');
      return;
    }
    if ((search.checkIn && !search.checkOut) || (!search.checkIn && search.checkOut)) {
      toast.error('Please select both check-in and check-out dates');
      return;
    }
    if (search.checkIn && search.checkOut && !isCheckoutAfterCheckin(search.checkIn, search.checkOut)) {
      toast.error('Check-out must be at least 1 day after check-in');
      return;
    }

    const params = new URLSearchParams({
      city: search.city,
      guests: String(search.guests),
      ...(search.checkIn ? { checkIn: search.checkIn } : {}),
      ...(search.checkOut ? { checkOut: search.checkOut } : {}),
    });

    navigate(`/hotels?${params.toString()}`);
  };

  const handleSearchFieldChange = (field, value) => {
    setSearch((current) => {
      const nextSearch = {
        ...current,
        [field]: value,
      };

      if (field === 'checkIn' && nextSearch.checkOut && !isCheckoutAfterCheckin(value, nextSearch.checkOut)) {
        nextSearch.checkOut = '';
      }

      return nextSearch;
    });
  };

  const handleNewsletter = async (event) => {
    event.preventDefault();
    if (!isValidEmail(newsletter)) {
      toast.error('Please enter a valid email');
      return;
    }

    try {
      await subscriptionApi.subscribeNewsletter({
        email: newsletter,
        name: isAuthenticated ? (user?.name || '') : '',
        source: 'homepage',
      });
      toast.success('Subscribed successfully!');
      setNewsletter('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Subscription failed');
    }
  };

  const spotlightHotel = featured?.find((hotel) => hotel._id === heroHotelId) || featured?.[0];
  const offerItems = (featured || [])
    .reduce((items, hotel) => {
      const hotelOffers = Array.isArray(hotel.offers) && hotel.offers.length > 0
        ? hotel.offers.slice(0, 2)
        : (hotel.primaryOffer ? [hotel.primaryOffer] : []);

      hotelOffers.forEach((offer) => {
        items.push({ hotel, offer });
      });

      return items;
    }, [])
    .slice(0, 12);
  const marqueeOffers = offerItems.length > 0 ? [...offerItems, ...offerItems] : [];
  const destinationCards = popularDestinations.length > 0 ? popularDestinations : POPULAR_CITIES.map((city) => ({ city }));

  const handleHeroSceneMove = (event) => {
    const scene = heroSceneRef.current;
    if (!scene) return;

    const rect = scene.getBoundingClientRect();
    const offsetX = (event.clientX - rect.left) / rect.width - 0.5;
    const offsetY = (event.clientY - rect.top) / rect.height - 0.5;

    scene.style.setProperty('--hero-rotate-y', `${offsetX * 10}deg`);
    scene.style.setProperty('--hero-rotate-x', `${offsetY * -10}deg`);
    scene.style.setProperty('--hero-shift-x', `${offsetX * 22}px`);
    scene.style.setProperty('--hero-shift-y', `${offsetY * 18}px`);
  };

  const resetHeroScene = () => {
    const scene = heroSceneRef.current;
    if (!scene) return;

    scene.style.setProperty('--hero-rotate-y', '0deg');
    scene.style.setProperty('--hero-rotate-x', '0deg');
    scene.style.setProperty('--hero-shift-x', '0px');
    scene.style.setProperty('--hero-shift-y', '0px');
  };

  const renderHotelCard = (hotel, badgeLabel = hotel.type) => (
    <Link to={`/hotels/${hotel.slug || hotel._id}`} key={hotel._id} className={styles.hotelCard}>
      <div className={styles.cardImage}>
        <img src={getImageUrl(hotel.images)} alt={hotel.title} loading="lazy" />
        <span className={styles.cardBadge}>{badgeLabel}</span>
        {hotel.primaryOffer && (
          <span className={styles.cardOffer} style={{ '--offer-tint': hotel.primaryOffer.bannerColor || DEFAULT_OFFER_COLOR }}>
            {hotel.primaryOffer.bannerText || hotel.primaryOffer.code}
          </span>
        )}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.rating}>
          <FiStar />
          <span>{hotel.rating?.toFixed(1)}</span>
          <small>({hotel.totalReviews})</small>
        </div>
        <h3>{hotel.title}</h3>
        <p className={styles.locationText}><FiMapPin size={13} /> {hotel.address?.city}, {hotel.address?.state}</p>
        <div className={styles.cardAmenities}>
          {hotel.amenities?.slice(0, 4).map((amenity) => (
            <span key={amenity} title={amenity}>{AMENITY_ICONS[amenity]}</span>
          ))}
        </div>
        {hotel.offers?.length > 0 && (
          <div className={styles.offerCodes}>
            {hotel.offers.slice(0, 2).map((offer) => (
              <span key={offer._id}>{offer.code}</span>
            ))}
          </div>
        )}
        <div className={styles.cardFooter}>
          <strong>{formatCurrency(hotel.pricePerNight)}<small> / night</small></strong>
          <span>View more</span>
        </div>
      </div>
    </Link>
  );

  return (
    <div className="page">
    
        <div className={styles.heroPattern} />
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroCopy}>
            <h1>
              Book brighter stays with
              <span> cleaner choices, better offers, and real support.</span>
            </h1>
            <p>
              Discover verified hotels, banner-backed offers, live availability, and direct admin-backed chat support all in one calm booking experience.
            </p>

            <form className={styles.searchBar} onSubmit={handleSearch}>
              <div className={styles.searchField}>
                <label>Destination</label>
                <select value={search.city} onChange={(event) => handleSearchFieldChange('city', event.target.value)} required>
                  <option value="">Choose a destination</option>
                  {POPULAR_CITIES.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              <div className={styles.searchField}>
                <label>Check in</label>
                <input type="date" min={today} value={search.checkIn} onChange={(event) => handleSearchFieldChange('checkIn', event.target.value)} />
              </div>
              <div className={styles.searchField}>
                <label>Check out</label>
                <input
                  type="date"
                  min={minimumSearchCheckout}
                  value={search.checkOut}
                  onChange={(event) => handleSearchFieldChange('checkOut', event.target.value)}
                  disabled={!search.checkIn}
                />
              </div>
              <div className={styles.searchField}>
                <label>Guests</label>
                <select value={search.guests} onChange={(event) => handleSearchFieldChange('guests', Number(event.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((guestCount) => (
                    <option key={guestCount} value={guestCount}>{guestCount} Guest{guestCount > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className={styles.searchBtn}>
                <FiSearch size={18} />
                Search stays
              </button>
            </form>

            <div className={styles.trustBar}>
              {TRUST_POINTS.map((item) => (
                <div key={item.label} className={styles.trustItem}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div
            ref={heroSceneRef}
            className={styles.heroScene}
            onMouseMove={handleHeroSceneMove}
            onMouseLeave={resetHeroScene}
          >
            <div className={styles.glowOrb} />
            <div className={styles.sceneCard}>
              <img src={spotlightHotel ? getImageUrl(spotlightHotel.images) : 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80'} alt={spotlightHotel?.title || 'Luxury stay'} />
              {/* <div className={styles.sceneOverlay}>
                <div>
                  <span>Stay spotlight</span>
                  <h3>{spotlightHotel?.title || 'The Grand Palace'}</h3>
                </div>
                <strong>{formatCurrency(spotlightHotel?.pricePerNight || 4800)}</strong>
              </div> */}
            </div>
            {/* <div className={styles.floatCard} style={{ top: '6%', right: '-3%' }}>
              <span>Live rating</span>
              <strong>{spotlightHotel?.rating?.toFixed(1) || '4.8'}</strong>
              <small>guest-loved property</small>
            </div> */}
            {/* <div className={styles.floatCard} style={{ bottom: '10%', left: '-5%' }}>
               <span>Owner support</span>
               <strong>Direct chat</strong>
               <small>ask before you book</small>
            </div> */}
            {/* <div className={styles.floatCardWide}>
              <div>
                <span>Available offers</span>
                <strong>{spotlightOffer?.code || 'WELCOME10'}</strong>
              </div>
              <small>{spotlightOffer?.bannerText || spotlightOffer?.title || 'Save more on selected stays'}</small>
            </div> */}
          </div>
        </div>
      

      {offerItems.length > 0 && (
        <section className={styles.offerRailSection}>
          <div className="container">
            <div className={styles.sectionHeader}>
              <span className="section-label">Live Offers</span>
            </div>
            <div className={styles.offerRailViewport}>
              <div className={styles.offerRailTrack}>
                {marqueeOffers.map(({ hotel, offer }, index) => (
                  <Link
                    to={`/hotels/${hotel.slug || hotel._id}`}
                    key={`${hotel._id}-${offer._id || offer.code || index}-${index}`}
                    className={styles.offerRailCard}
                    style={{ '--offer-color': offer.bannerColor || hotel.primaryOffer?.bannerColor || DEFAULT_OFFER_COLOR }}
                  >
                    <strong>{offer.bannerText || offer.title || offer.code}</strong>
                    <span>{hotel.title}</span>
                    <small>{hotel.address?.city}</small>
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </section>
      )}

      <section className={`${styles.section} container`}>
        <div className={styles.sectionHeader}>
          <span className="section-label">Explore India</span>
          <h2 className="section-title">Popular destinations with polished stays</h2>
          <p className="section-subtitle">From weekend coastlines to city breaks, jump into the places travellers keep coming back to.</p>
        </div>

        <div ref={destinationScrollerRef} className={styles.destinationScroller}>
          <div className={styles.destinationGrid}>
            {destinationCards.map((destination) => (
              <Link to={`/hotels?city=${destination.city}`} key={destination.city} className={styles.destinationCard}>
                <img src={DEST_IMAGES[destination.city] || destination.image || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&q=80'} alt={destination.city} loading="lazy" />
                <div className={styles.destinationOverlay}>
                  <strong>{destination.city}</strong>
                  <span>{destination.count ? `${destination.count} stays` : 'Explore stays'}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {isAuthenticated && recommended?.length > 0 && (
        <section className={styles.sectionAlt}>
          <div className="container">
            <div className={styles.sectionHeader}>
              <span className="section-label">Personalised Picks</span>
              <h2 className="section-title">Recommended around your travel style</h2>
              <p className="section-subtitle">AI-assisted suggestions tuned using your saved preferences and booking history.</p>
            </div>
            <div className={styles.hotelGrid}>
              {recommended.slice(0, 4).map((hotel) => renderHotelCard(hotel, 'Recommended'))}
            </div>
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className="section-label">Featured Collection</span>
            <h2 className="section-title">Modern stays with flexible booking energy</h2>
            <p className="section-subtitle">These properties lead with design, guest confidence, live offer visibility, and clean room inventory setup.</p>
          </div>
          {loading ? <Loader /> : (
            <div className={styles.hotelGrid}>
              {featured?.slice(0, 8).map((hotel) => renderHotelCard(hotel))}
            </div>
          )}
          <div className={styles.centerAction}>
            <Link to="/hotels" className={styles.primaryLink}>
              Browse all hotels
              <FiArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className={`${styles.section} container`}>
          <div className={styles.sectionHeader}>
          <span className="section-label">Why Sigmora</span>
          <h2 className="section-title">A cleaner way to plan, compare and book</h2>
          <p className="section-subtitle">Everything is designed to reduce friction for guests while still giving admins a clear workspace to manage hotels, offers, and support.</p>
        </div>

        <div className={styles.whyGrid}>
          {[
            { icon: <FiShield size={24} />, title: 'Verified properties', description: 'Guests browse trusted hotels with structured amenities, ratings, room inventory, and better operational hygiene.' },
            { icon: <FiMessageCircle size={24} />, title: 'Direct support chat', description: 'Users can now raise questions directly with the admin team before booking, keeping conversations tied to the property.' },
            { icon: <FiSunrise size={24} />, title: 'Visible live offers', description: 'Discount banners and coupons are surfaced on listings, hotel pages, and booking screens instead of staying hidden.' },
            { icon: <FiUsers size={24} />, title: 'Role-aware platform', description: 'Guests and admins each land in the right workspace with the actions that matter to them.' },
          ].map((item) => (
            <div key={item.title} className={styles.whyCard}>
              <div className={styles.whyIcon}>{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.newsletter}>
        <div className={styles.newsletterCard}>
          <div>
            <span className={styles.newsletterLabel}>Stay in the loop</span>
            <h2>Get new stay ideas, fresh offers, and destination updates.</h2>
            <p>We’ll send occasional travel inspiration and platform announcements without cluttering your inbox.</p>
          </div>
          <form className={styles.newsletterForm} onSubmit={handleNewsletter}>
            <input type="email" placeholder="Enter your email address" value={newsletter} onChange={(event) => setNewsletter(event.target.value)} required />
            <button type="submit">
              <FiCheck size={16} />
              Subscribe
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
