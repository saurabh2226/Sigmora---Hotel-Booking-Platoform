import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as couponApi from '../api/couponApi';
import * as hotelApi from '../api/hotelApi';
import { DEFAULT_OFFER_COLOR } from '../utils/constants';
import Loader from '../components/common/Loader/Loader';
import styles from './AdminWorkspace.module.css';

const EMPTY_FORM = {
  id: '',
  title: '',
  description: '',
  code: '',
  hotel: '',
  discountType: 'percentage',
  discountValue: 10,
  minBookingAmount: 0,
  maxDiscount: '',
  usageLimit: 100,
  priority: 0,
  validFrom: '',
  validUntil: '',
  bannerText: '',
  bannerColor: DEFAULT_OFFER_COLOR,
  isActive: true,
};

const mapOfferToForm = (offer) => ({
  id: offer._id,
  title: offer.title || '',
  description: offer.description || '',
  code: offer.code || '',
  hotel: offer.hotel?._id || offer.hotel || '',
  discountType: offer.discountType || 'percentage',
  discountValue: offer.discountValue || 10,
  minBookingAmount: offer.minBookingAmount || 0,
  maxDiscount: offer.maxDiscount || '',
  usageLimit: offer.usageLimit || 100,
  priority: offer.priority || 0,
  validFrom: offer.validFrom ? String(offer.validFrom).slice(0, 10) : '',
  validUntil: offer.validUntil ? String(offer.validUntil).slice(0, 10) : '',
  bannerText: offer.bannerText || '',
  bannerColor: offer.bannerColor || DEFAULT_OFFER_COLOR,
  isActive: offer.isActive ?? true,
});

const toPayload = (form) => ({
  title: form.title.trim(),
  description: form.description.trim(),
  code: form.code.trim().toUpperCase(),
  hotel: form.hotel || undefined,
  discountType: form.discountType,
  discountValue: Number(form.discountValue),
  minBookingAmount: Number(form.minBookingAmount || 0),
  maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
  usageLimit: Number(form.usageLimit || 100),
  priority: Number(form.priority || 0),
  validFrom: form.validFrom || undefined,
  validUntil: form.validUntil || undefined,
  bannerText: form.bannerText.trim(),
  bannerColor: form.bannerColor || DEFAULT_OFFER_COLOR,
  isActive: form.isActive,
});

export default function OffersManagementPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [offers, setOffers] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [{ data: offersResponse }, { data: hotelsResponse }] = await Promise.all([
        couponApi.getManagedCoupons(),
        hotelApi.getManagedHotels(),
      ]);
      setOffers(offersResponse.data.coupons || []);
      setHotels(hotelsResponse.data.hotels || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const groupedStats = useMemo(() => ({
    total: offers.length,
    live: offers.filter((offer) => offer.isCurrentlyActive).length,
    hotelLinked: offers.filter((offer) => offer.hotel).length,
    global: offers.filter((offer) => !offer.hotel).length,
  }), [offers]);

  const heading = 'Platform Offers';
  const subheading = 'Create global or hotel-specific offers and keep the promotional banners across the platform under control.';
  const backLink = '/admin';

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      const payload = toPayload(form);

      if (form.id) {
        await couponApi.updateManagedCoupon(form.id, payload);
        toast.success('Offer updated');
      } else {
        await couponApi.createManagedCoupon(payload);
        toast.success('Offer created');
      }

      setForm(EMPTY_FORM);
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save offer');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (offer) => {
    setForm(mapOfferToForm(offer));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (offerId) => {
    if (!window.confirm('Delete this offer?')) return;

    try {
      await couponApi.deleteManagedCoupon(offerId);
      toast.success('Offer deleted');
      if (form.id === offerId) {
        setForm(EMPTY_FORM);
      }
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete offer');
    }
  };

  return (
    <div className={`page container ${styles.page}`}>
      <div className={styles.header}>
        <div>
          <h1>{heading}</h1>
          <p>{subheading}</p>
        </div>
        <div className={styles.actions}>
          <Link to={backLink} className={styles.secondaryBtn}>Back</Link>
          <button type="button" className={styles.ghostBtn} onClick={() => setForm(EMPTY_FORM)}>New Offer</button>
        </div>
      </div>

      <div className={styles.cardGrid} style={{ marginBottom: 'var(--space-6)' }}>
        <div className={styles.metricCard}><strong>{groupedStats.total}</strong><span>Total offers</span></div>
        <div className={styles.metricCard}><strong>{groupedStats.live}</strong><span>Currently active</span></div>
        <div className={styles.metricCard}><strong>{groupedStats.hotelLinked}</strong><span>Hotel-linked offers</span></div>
        <div className={styles.metricCard}><strong>{groupedStats.global}</strong><span>Global offers</span></div>
      </div>

      <div className={styles.gridTwo}>
        <section className={styles.panel}>
          <form className={styles.stack} onSubmit={handleSubmit}>
            <div className={styles.formGrid}>
              <div>
                <label className={styles.label}>Offer Title</label>
                <input className={styles.input} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
              </div>
              <div>
                <label className={styles.label}>Coupon Code</label>
                <input className={styles.input} value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} required />
              </div>
            </div>

            <div>
              <label className={styles.label}>Description</label>
              <textarea className={styles.textarea} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </div>

            <div className={styles.formGrid}>
              <div>
                <label className={styles.label}>Hotel</label>
                <select className={styles.select} value={form.hotel} onChange={(event) => setForm((current) => ({ ...current, hotel: event.target.value }))}>
                  <option value="">Platform-wide offer</option>
                  {hotels.map((hotel) => (
                    <option key={hotel._id} value={hotel._id}>{hotel.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={styles.label}>Discount Type</label>
                <select className={styles.select} value={form.discountType} onChange={(event) => setForm((current) => ({ ...current, discountType: event.target.value }))}>
                  <option value="percentage">Percentage</option>
                  <option value="flat">Flat amount</option>
                </select>
              </div>
              <div>
                <label className={styles.label}>Discount Value</label>
                <input className={styles.input} type="number" min="1" value={form.discountValue} onChange={(event) => setForm((current) => ({ ...current, discountValue: event.target.value }))} required />
              </div>
              <div>
                <label className={styles.label}>Minimum Booking Amount</label>
                <input className={styles.input} type="number" min="0" value={form.minBookingAmount} onChange={(event) => setForm((current) => ({ ...current, minBookingAmount: event.target.value }))} />
              </div>
              <div>
                <label className={styles.label}>Max Discount</label>
                <input className={styles.input} type="number" min="0" value={form.maxDiscount} onChange={(event) => setForm((current) => ({ ...current, maxDiscount: event.target.value }))} />
              </div>
              <div>
                <label className={styles.label}>Usage Limit</label>
                <input className={styles.input} type="number" min="1" value={form.usageLimit} onChange={(event) => setForm((current) => ({ ...current, usageLimit: event.target.value }))} />
              </div>
              <div>
                <label className={styles.label}>Valid From</label>
                <input className={styles.input} type="date" value={form.validFrom} onChange={(event) => setForm((current) => ({ ...current, validFrom: event.target.value }))} />
              </div>
              <div>
                <label className={styles.label}>Valid Until</label>
                <input className={styles.input} type="date" value={form.validUntil} onChange={(event) => setForm((current) => ({ ...current, validUntil: event.target.value }))} />
              </div>
              <div>
                <label className={styles.label}>Priority</label>
                <input className={styles.input} type="number" value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} />
              </div>
              <div>
                <label className={styles.label}>Banner Color</label>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <input type="color" value={form.bannerColor} onChange={(event) => setForm((current) => ({ ...current, bannerColor: event.target.value }))} style={{ width: 56, height: 46, borderRadius: '14px', border: '1px solid var(--color-border)', background: 'transparent' }} />
                  <input className={styles.input} value={form.bannerColor} onChange={(event) => setForm((current) => ({ ...current, bannerColor: event.target.value }))} />
                </div>
              </div>
            </div>

            <div>
              <label className={styles.label}>Banner Text</label>
              <input className={styles.input} value={form.bannerText} onChange={(event) => setForm((current) => ({ ...current, bannerText: event.target.value }))} placeholder="Weekend delight: save 15% on this hotel" />
            </div>

            <label className={styles.checkboxItem}>
              <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
              <span>Offer is live and visible to guests</span>
            </label>

            <div className={styles.inlineActions}>
              <button type="submit" className={styles.primaryBtn} disabled={saving}>{saving ? 'Saving...' : form.id ? 'Update Offer' : 'Create Offer'}</button>
              <button type="button" className={styles.secondaryBtn} onClick={() => setForm(EMPTY_FORM)}>Reset</button>
            </div>
          </form>
        </section>

        <section className={styles.stack}>
          {loading ? <Loader /> : offers.length === 0 ? (
            <div className={styles.emptyState}>No offers yet. Create your first banner-backed discount from the form on the left.</div>
          ) : offers.map((offer) => (
            <article key={offer._id} className={styles.hotelCard}>
              <div style={{
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                background: offer.bannerColor || DEFAULT_OFFER_COLOR,
                color: 'white',
                marginBottom: 'var(--space-4)',
              }}
              >
                <strong style={{ display: 'block', marginBottom: 4 }}>{offer.bannerText || offer.title}</strong>
                <span style={{ fontSize: 'var(--font-size-sm)', opacity: 0.92 }}>{offer.code}</span>
              </div>
              <h3>{offer.title}</h3>
              <p className={styles.metaText}>{offer.hotel?.title || 'Platform-wide offer'}</p>
              <p style={{ marginTop: 'var(--space-2)', color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>{offer.description || 'No description added yet.'}</p>
              <div className={styles.tagRow}>
                <span className={styles.tag}>{offer.discountType === 'percentage' ? `${offer.discountValue}% off` : `₹${offer.discountValue} off`}</span>
                <span className={styles.tag}>{offer.isCurrentlyActive ? 'live now' : 'inactive'}</span>
                {offer.minBookingAmount > 0 && <span className={styles.tag}>min ₹{offer.minBookingAmount}</span>}
              </div>
              <div className={styles.inlineActions} style={{ marginTop: 'var(--space-4)' }}>
                <button type="button" className={styles.primaryBtn} onClick={() => handleEdit(offer)}>Edit</button>
                <button type="button" className={styles.dangerBtn} onClick={() => handleDelete(offer._id)}>Delete</button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
