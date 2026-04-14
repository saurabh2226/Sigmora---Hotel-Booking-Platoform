import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  FiArrowRight,
  FiCheck,
  FiMapPin,
  FiSearch,
  FiShield,
  FiStar,
  FiSunrise,
  FiUsers,
  FiMessageCircle,
} from 'react-icons/fi';

import {
  fetchFeaturedHotels,
  fetchPopularDestinations,
  fetchRecommendations,
} from '../redux/slices/hotelSlice';

import { formatCurrency } from '../utils/formatters';
import { getImageUrl } from '../utils/helpers';
import {
  AMENITY_ICONS,
  DEFAULT_OFFER_COLOR,
  POPULAR_CITIES,
} from '../utils/constants';

import {
  formatInputDate,
  getMinCheckout,
  getToday,
  getTomorrow,
} from '../utils/dateUtils';

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

  const { featured, popularDestinations, recommended, loading } =
    useSelector((state) => state.hotels);

  const { isAuthenticated, user } = useAuth();
  const socket = useSocket();

  const [search, setSearch] = useState({
    city: '',
    checkIn: '',
    checkOut: '',
    guests: 2,
  });

  const [newsletter, setNewsletter] = useState('');
  const [heroHotelId, setHeroHotelId] = useState('');

  const today = getToday();
  const minimumSearchCheckout = search.checkIn
    ? formatInputDate(getMinCheckout(search.checkIn))
    : getTomorrow();

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
    if (!featured?.length) return;

    const candidates = featured.filter(
      (h) => Array.isArray(h.images) && h.images.length > 0
    );

    const list = candidates.length ? candidates : featured;
    const random = list[Math.floor(Math.random() * list.length)];

    setHeroHotelId(random?._id || '');
  }, [featured]);

  useEffect(() => {
    const rail = destinationScrollerRef.current;
    if (!rail) return;

    const handleWheel = (event) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (rail.scrollWidth <= rail.clientWidth) return;

      event.preventDefault();
      rail.scrollLeft += event.deltaY;
    };

    rail.addEventListener('wheel', handleWheel, { passive: false });

    return () => rail.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const refresh = () => {
      dispatch(fetchFeaturedHotels());
      dispatch(fetchPopularDestinations());
      if (isAuthenticated) dispatch(fetchRecommendations());
    };

    socket.on('hotel-catalog-updated', refresh);
    return () => socket.off('hotel-catalog-updated', refresh);
  }, [socket, dispatch, isAuthenticated]);

  const handleSearch = (e) => {
    e.preventDefault();

    if (!search.city) return toast.error('Choose destination');

    const params = new URLSearchParams({
      city: search.city,
      guests: String(search.guests),
      ...(search.checkIn && { checkIn: search.checkIn }),
      ...(search.checkOut && { checkOut: search.checkOut }),
    });

    navigate(`/hotels?${params}`);
  };

  const handleNewsletter = async (e) => {
    e.preventDefault();

    if (!isValidEmail(newsletter)) {
      return toast.error('Invalid email');
    }

    try {
      await subscriptionApi.subscribeNewsletter({
        email: newsletter,
        name: user?.name || '',
        source: 'homepage',
      });

      toast.success('Subscribed!');
      setNewsletter('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const spotlightHotel =
    featured?.find((h) => h._id === heroHotelId) || featured?.[0];

  const renderHotelCard = (hotel) => (
    <Link
      key={hotel._id}
      to={`/hotels/${hotel.slug || hotel._id}`}
      className={styles.hotelCard}
    >
      <img src={getImageUrl(hotel.images)} alt={hotel.title} />
      <h3>{hotel.title}</h3>
      <p>
        <FiMapPin /> {hotel.address?.city}
      </p>
      <strong>{formatCurrency(hotel.pricePerNight)}</strong>
    </Link>
  );

  return (
    <div className="page">

      <div className={styles.heroPattern} />

      <div className={`container ${styles.heroInner}`}>
        <div className={styles.heroCopy}>
          <h1>
            Book better stays with smarter offers
          </h1>

          <form onSubmit={handleSearch}>
            <select
              value={search.city}
              onChange={(e) =>
                setSearch({ ...search, city: e.target.value })
              }
            >
              <option value="">City</option>
              {POPULAR_CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>

            <button type="submit">
              <FiSearch /> Search
            </button>
          </form>
        </div>

        <div className={styles.heroScene}>
          <img
            src={
              getImageUrl(spotlightHotel?.images) ||
              'https://images.unsplash.com/photo-1566073771259-6a8506099945'
            }
            alt="hero"
          />
        </div>
      </div>

      {featured?.length > 0 && (
        <section>
          <h2>Featured Hotels</h2>
          <div>
            {featured.slice(0, 6).map(renderHotelCard)}
          </div>
        </section>
      )}

      <section>
        <h2>Newsletter</h2>
        <form onSubmit={handleNewsletter}>
          <input
            value={newsletter}
            onChange={(e) => setNewsletter(e.target.value)}
            placeholder="Email"
          />
          <button type="submit">
            <FiCheck /> Subscribe
          </button>
        </form>
      </section>

    </div>
  );
}