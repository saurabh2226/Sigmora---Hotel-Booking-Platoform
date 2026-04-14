import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { FiStar, FiMapPin, FiFilter, FiX } from 'react-icons/fi';
import { fetchHotels, setFilters, clearFilters, setPage } from '../redux/slices/hotelSlice';
import { getSearchSuggestions } from '../api/hotelApi';
import { formatCurrency } from '../utils/formatters';
import { getImageUrl } from '../utils/helpers';
import { DEFAULT_OFFER_COLOR, HOTEL_TYPES, AMENITY_ICONS } from '../utils/constants';
import { useDebounce } from '../hooks/useDebounce';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useSocket } from '../context/SocketContext';
import Loader from '../components/common/Loader/Loader';
import styles from './HotelListingPage.module.css';

export default function HotelListingPage() {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const { hotels, loading, pagination, filters } = useSelector(s => s.hotels);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const socket = useSocket();
  const [showFilters, setShowFilters] = React.useState(false);
  const [searchSuggestions, setSearchSuggestions] = React.useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = React.useState(false);
  const [draftFilters, setDraftFilters] = React.useState({
    search: filters.search || '',
    city: filters.city || '',
    minPrice: filters.minPrice ? String(filters.minPrice) : '',
    maxPrice: filters.maxPrice === 50000 ? '' : String(filters.maxPrice || ''),
  });
  const debouncedSearch = useDebounce(draftFilters.search.trim(), 350);
  const debouncedCity = useDebounce(draftFilters.city.trim(), 350);

  useEffect(() => {
    const city = searchParams.get('city') || '';
    const search = searchParams.get('search') || '';

    if (city || search) {
      dispatch(setFilters({ city, search }));
      dispatch(setPage(1));
    }
  }, [dispatch, searchParams]);

  useEffect(() => {
    setDraftFilters({
      search: filters.search || '',
      city: filters.city || '',
      minPrice: filters.minPrice ? String(filters.minPrice) : '',
      maxPrice: filters.maxPrice === 50000 ? '' : String(filters.maxPrice || ''),
    });
  }, [filters.search, filters.city, filters.minPrice, filters.maxPrice]);

  useEffect(() => {
    dispatch(fetchHotels({ ...filters, page: pagination.page, limit: 12 }));
  }, [dispatch, filters, pagination.page]);

  useEffect(() => {
    const nextFilters = {
      search: debouncedSearch,
      city: debouncedCity,
      minPrice: draftFilters.minPrice === '' ? 0 : Number(draftFilters.minPrice),
      maxPrice: draftFilters.maxPrice === '' ? 50000 : Number(draftFilters.maxPrice),
    };

    const hasChanged = nextFilters.search !== filters.search
      || nextFilters.city !== filters.city
      || nextFilters.minPrice !== filters.minPrice
      || nextFilters.maxPrice !== filters.maxPrice;

    if (hasChanged) {
      dispatch(setFilters(nextFilters));
      dispatch(setPage(1));
    }
  }, [debouncedSearch, debouncedCity, draftFilters.minPrice, draftFilters.maxPrice, dispatch, filters.search, filters.city, filters.minPrice, filters.maxPrice]);

  useEffect(() => {
    let ignore = false;

    const loadSuggestions = async () => {
      if (debouncedSearch.length < 2) {
        setSearchSuggestions([]);
        return;
      }

      try {
        const { data } = await getSearchSuggestions(debouncedSearch);
        if (ignore) return;
        setSearchSuggestions(data.data.suggestions || []);
      } catch (error) {
        if (!ignore) {
          setSearchSuggestions([]);
        }
      }
    };

    loadSuggestions();

    return () => {
      ignore = true;
    };
  }, [debouncedSearch]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const refreshHotels = () => {
      dispatch(fetchHotels({ ...filters, page: pagination.page, limit: 12 }));
    };

    socket.on('hotel-catalog-updated', refreshHotels);

    return () => {
      socket.off('hotel-catalog-updated', refreshHotels);
    };
  }, [socket, dispatch, filters, pagination.page]);

  const handleFilter = (key, val) => { dispatch(setFilters({ [key]: val })); dispatch(setPage(1)); };
  const handleDraftFilter = (key, value) => {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  };
  const handleSuggestionSelect = (suggestion) => {
    setDraftFilters((current) => ({
      ...current,
      search: suggestion.type === 'hotel' ? suggestion.text : current.search,
      city: suggestion.type === 'city' ? suggestion.text : (suggestion.city || current.city),
    }));
    setSuggestionsOpen(false);
  };

  return (
    <div className={`page ${styles.page}`}>
      <div className="container">
        <div className={styles.header}>
          <h1>Hotels {filters.city && `in ${filters.city}`}</h1>
          <p>{pagination.total} properties found</p>
          {isMobile && <button className={styles.filterToggle} onClick={() => setShowFilters(!showFilters)}><FiFilter /> Filters</button>}
        </div>

        <div className={styles.layout}>
          <aside className={`${styles.sidebar} ${showFilters ? styles.sidebarOpen : ''}`}>
            {isMobile && <button className={styles.closeFilters} onClick={() => setShowFilters(false)}><FiX /></button>}
            <div className={styles.filterGroup}>
              <h3>Search</h3>
              <div className={styles.searchStack}>
                <input
                  type="text"
                  placeholder="Hotel, state, type, amenity..."
                  value={draftFilters.search}
                  onChange={(e) => handleDraftFilter('search', e.target.value)}
                  onFocus={() => setSuggestionsOpen(true)}
                  onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
                  className={styles.filterInput}
                />
                {suggestionsOpen && searchSuggestions.length > 0 && (
                  <div className={styles.suggestions}>
                    {searchSuggestions.map((suggestion, index) => (
                      <button
                        key={`${suggestion.type}-${suggestion.slug || suggestion.text}-${index}`}
                        type="button"
                        className={styles.suggestionItem}
                        onClick={() => handleSuggestionSelect(suggestion)}
                      >
                        <strong>{suggestion.text}</strong>
                        <span>{suggestion.type === 'hotel' ? `Hotel${suggestion.city ? ` · ${suggestion.city}` : ''}` : 'Destination'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className={styles.filterHint}>Debounced search across hotel names, city, state, property type, and amenities.</p>
            </div>
            <div className={styles.filterGroup}>
              <h3>City</h3>
              <input type="text" placeholder="City..." value={draftFilters.city} onChange={e => handleDraftFilter('city', e.target.value)} className={styles.filterInput} />
            </div>
            <div className={styles.filterGroup}>
              <h3>Price Range</h3>
              <div className={styles.priceInputs}>
                <input type="number" placeholder="Min" value={draftFilters.minPrice} onChange={e => handleDraftFilter('minPrice', e.target.value)} />
                <span>—</span>
                <input type="number" placeholder="Max" value={draftFilters.maxPrice} onChange={e => handleDraftFilter('maxPrice', e.target.value)} />
              </div>
            </div>
            <div className={styles.filterGroup}>
              <h3>Property Type</h3>
              {HOTEL_TYPES.map(t => (
                <label key={t} className={styles.checkbox}><input type="radio" name="type" checked={filters.type === t} onChange={() => handleFilter('type', filters.type === t ? '' : t)} /> {t}</label>
              ))}
            </div>
            <div className={styles.filterGroup}>
              <h3>Rating</h3>
              {[4.5, 4, 3].map(r => (
                <label key={r} className={styles.checkbox}><input type="radio" name="rating" checked={filters.rating === r} onChange={() => handleFilter('rating', filters.rating === r ? 0 : r)} /> {r}+ ⭐</label>
              ))}
            </div>
            <button
              className={styles.clearBtn}
              onClick={() => {
                dispatch(clearFilters());
                setDraftFilters({ search: '', city: '', minPrice: '', maxPrice: '' });
                setSearchSuggestions([]);
                setSuggestionsOpen(false);
              }}
            >
              Clear All Filters
            </button>
          </aside>

          <main className={styles.main}>
            <div className={styles.sortBar}>
              <select value={filters.sort} onChange={e => handleFilter('sort', e.target.value)} className={styles.sortSelect}>
                <option value="-rating">Rating: High to Low</option>
                <option value="pricePerNight">Price: Low to High</option>
                <option value="-pricePerNight">Price: High to Low</option>
                <option value="-createdAt">Newest First</option>
              </select>
            </div>

            {loading ? <Loader /> : hotels?.length === 0 ? (
              <div className={styles.empty}><h3>No hotels found</h3><p>Try adjusting your filters</p></div>
            ) : (
              <div className={styles.grid}>
                {hotels.map(hotel => (
                  <Link to={`/hotels/${hotel.slug || hotel._id}`} key={hotel._id} className={styles.card}>
                    <div className={styles.cardImg}>
                      <img src={getImageUrl(hotel.images)} alt={hotel.title} loading="lazy" />
                      <span className={styles.badge}>{hotel.type}</span>
                      {hotel.primaryOffer && (
                        <span className={styles.offerRibbon} style={{ '--offer-tint': hotel.primaryOffer.bannerColor || DEFAULT_OFFER_COLOR }}>
                          {hotel.primaryOffer.bannerText || hotel.primaryOffer.code}
                        </span>
                      )}
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.rating}><FiStar style={{ color: '#f59e0b', fill: '#f59e0b' }} /> {hotel.rating?.toFixed(1)} <span>({hotel.totalReviews})</span></div>
                      <h3>{hotel.title}</h3>
                      <p className={styles.loc}><FiMapPin size={14} /> {hotel.address?.city}, {hotel.address?.state}</p>
                      {hotel.offers?.length > 0 && (
                        <div className={styles.offerPills}>
                          {hotel.offers.slice(0, 2).map((offer) => (
                            <span key={offer._id} className={styles.offerPill}>{offer.code}</span>
                          ))}
                        </div>
                      )}
                      <div className={styles.amenityIcons}>{hotel.amenities?.slice(0, 4).map(a => <span key={a} title={a}>{AMENITY_ICONS[a]}</span>)}</div>
                      <div className={styles.cardFooter}><span className={styles.price}>{formatCurrency(hotel.pricePerNight)}<small> / night</small></span><span className={styles.bookBtn}>Book Now →</span></div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {pagination.totalPages > 1 && (
              <div className={styles.pagination}>
                <button disabled={pagination.page <= 1} onClick={() => dispatch(setPage(pagination.page - 1))}>← Prev</button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).slice(Math.max(0, pagination.page - 3), pagination.page + 2).map(p => (
                  <button key={p} className={p === pagination.page ? styles.activePage : ''} onClick={() => dispatch(setPage(p))}>{p}</button>
                ))}
                <button disabled={pagination.page >= pagination.totalPages} onClick={() => dispatch(setPage(pagination.page + 1))}>Next →</button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
