import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { FiHeart, FiStar, FiMapPin, FiTrash2 } from 'react-icons/fi';
import { fetchWishlist, toggleWishlist } from '../redux/slices/wishlistSlice';
import { formatCurrency } from '../utils/formatters';
import { getImageUrl } from '../utils/helpers';
import Loader from '../components/common/Loader/Loader';

export default function WishlistPage() {
  const dispatch = useDispatch();
  const { hotels, loading } = useSelector(s => s.wishlist);

  useEffect(() => { dispatch(fetchWishlist()); }, [dispatch]);

  return (
    <div className="page container" style={{ paddingTop: 100 }}>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, marginBottom: 'var(--space-2)' }}><FiHeart style={{ color: '#ef4444', marginRight: 8 }} /> My Wishlist</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-8)' }}>{hotels.length} saved properties</p>

      {loading ? <Loader /> : hotels.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-16)' }}><h3>No saved hotels</h3><p style={{ color: 'var(--color-text-muted)' }}>Start exploring and save your favorites</p><Link to="/hotels" style={{ display: 'inline-block', marginTop: 'var(--space-4)', padding: '12px 28px', background: 'var(--gradient-primary)', color: 'white', borderRadius: 'var(--radius-md)', fontWeight: 700 }}>Browse Hotels</Link></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-6)' }}>
          {hotels.map(h => (
            <div key={h._id} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', transition: 'all 0.2s' }}>
              <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
                <img src={getImageUrl(h.images)} alt={h.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => dispatch(toggleWishlist(h._id))} style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiTrash2 size={16} /></button>
              </div>
              <div style={{ padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}><FiStar style={{ color: '#f59e0b', fill: '#f59e0b' }} /> {h.rating?.toFixed(1)} <span style={{ color: 'var(--color-text-muted)' }}>({h.totalReviews})</span></div>
                <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 4 }}>{h.title}</h3>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 'var(--space-3)' }}><FiMapPin size={12} /> {h.address?.city}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-primary)' }}>{formatCurrency(h.pricePerNight)}<small style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--color-text-muted)' }}> / night</small></span>
                  <Link to={`/hotels/${h.slug || h._id}`} style={{ padding: '8px 20px', background: 'var(--gradient-primary)', color: 'white', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>View</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
