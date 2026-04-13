import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as hotelApi from '../api/hotelApi';
import { AMENITIES, HOTEL_TYPES, ROOM_TYPES } from '../utils/constants';
import { formatCurrency } from '../utils/formatters';
import { getImageUrl } from '../utils/helpers';
import Loader from '../components/common/Loader/Loader';
import styles from './AdminWorkspace.module.css';

const EMPTY_FORM = {
  id: '',
  title: '',
  description: '',
  type: 'hotel',
  street: '',
  city: '',
  state: '',
  country: 'India',
  zipCode: '',
  pricePerNight: '',
  maxGuests: 2,
  totalRooms: 1,
  isFeatured: false,
  amenities: [],
  latitude: '',
  longitude: '',
  createStarterRoom: true,
  roomTitle: '',
  roomType: 'double',
  roomPricePerNight: '',
  roomMaxGuests: 2,
  roomTotalRooms: 1,
  roomBedType: 'queen',
  roomSize: '',
  roomAmenitiesInput: '',
};

const HOTELS_PAGE_SIZE = 6;

const toHotelPayload = (form) => {
  const coordinates = {};
  if (form.latitude !== '') coordinates.lat = Number(form.latitude);
  if (form.longitude !== '') coordinates.lng = Number(form.longitude);

  return {
    title: form.title.trim(),
    description: form.description.trim(),
    type: form.type,
    address: {
      ...(form.street.trim() ? { street: form.street.trim() } : {}),
      city: form.city.trim(),
      state: form.state.trim(),
      ...(form.country.trim() ? { country: form.country.trim() } : {}),
      ...(form.zipCode.trim() ? { zipCode: form.zipCode.trim() } : {}),
      ...(Object.keys(coordinates).length > 0 ? { coordinates } : {}),
    },
    pricePerNight: Number(form.pricePerNight),
    maxGuests: Number(form.maxGuests),
    totalRooms: Number(form.totalRooms),
    isFeatured: form.isFeatured,
    amenities: form.amenities,
  };
};

const toStarterRoomPayload = (form) => ({
  title: form.roomTitle.trim() || `${form.title.trim()} Standard Room`,
  type: form.roomType,
  pricePerNight: Number(form.roomPricePerNight || form.pricePerNight),
  maxGuests: Number(form.roomMaxGuests || form.maxGuests),
  totalRooms: Number(form.roomTotalRooms || form.totalRooms),
  bedType: form.roomBedType,
  ...(form.roomSize ? { roomSize: Number(form.roomSize) } : {}),
  amenities: form.roomAmenitiesInput
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
});

const mapHotelToForm = (hotel) => ({
  ...EMPTY_FORM,
  id: hotel._id,
  title: hotel.title || '',
  description: hotel.description || '',
  type: hotel.type || 'hotel',
  street: hotel.address?.street || '',
  city: hotel.address?.city || '',
  state: hotel.address?.state || '',
  country: hotel.address?.country || 'India',
  zipCode: hotel.address?.zipCode || '',
  pricePerNight: hotel.pricePerNight || '',
  maxGuests: hotel.maxGuests || 2,
  totalRooms: hotel.totalRooms || 1,
  isFeatured: !!hotel.isFeatured,
  amenities: hotel.amenities || [],
  latitude: hotel.address?.coordinates?.lat ?? '',
  longitude: hotel.address?.coordinates?.lng ?? '',
  createStarterRoom: false,
});

const validateRoomDraft = (form, { allowGeneratedTitle = false } = {}) => {
  const resolvedTitle = form.roomTitle.trim() || (allowGeneratedTitle ? `${form.title.trim()} Standard Room` : '');
  const roomPrice = Number(form.roomPricePerNight || form.pricePerNight);
  const roomGuests = Number(form.roomMaxGuests || form.maxGuests);
  const roomInventory = Number(form.roomTotalRooms || form.totalRooms);
  const roomSize = form.roomSize ? Number(form.roomSize) : null;

  if (!resolvedTitle || resolvedTitle.length < 2) {
    return 'Add a room title with at least 2 characters.';
  }

  if (!Number.isFinite(roomPrice) || roomPrice < 100) {
    return 'Room price must be at least ₹100.';
  }

  if (!Number.isInteger(roomGuests) || roomGuests < 1 || roomGuests > 20) {
    return 'Room max guests must be between 1 and 20.';
  }

  if (!Number.isInteger(roomInventory) || roomInventory < 1 || roomInventory > 500) {
    return 'Room inventory must be between 1 and 500.';
  }

  if (roomSize !== null && (!Number.isFinite(roomSize) || roomSize < 50 || roomSize > 10000)) {
    return 'Room size must be between 50 and 10,000 sq ft.';
  }

  return '';
};

export default function AdminHotelsPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [hotels, setHotels] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hotelPage, setHotelPage] = useState(1);
  const [pendingImages, setPendingImages] = useState([]);
  const editingHotel = useMemo(
    () => hotels.find((hotel) => hotel._id === form.id) || null,
    [hotels, form.id]
  );
  const pendingImagePreviews = useMemo(
    () => pendingImages.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      name: file.name,
      url: URL.createObjectURL(file),
    })),
    [pendingImages]
  );

  const loadHotels = async () => {
    try {
      setLoading(true);
      const { data } = await hotelApi.getManagedHotels();
      setHotels(data.data.hotels);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load hotels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHotels();
  }, []);

  const filteredHotels = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return hotels;
    return hotels.filter((hotel) => {
      const haystack = [
        hotel.title,
        hotel.type,
        hotel.address?.city,
        hotel.address?.state,
        ...(hotel.roomsPreview || []).map((room) => room.title),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [hotels, search]);

  const hotelTotalPages = Math.max(1, Math.ceil(filteredHotels.length / HOTELS_PAGE_SIZE));
  const paginatedHotels = useMemo(() => {
    const start = (hotelPage - 1) * HOTELS_PAGE_SIZE;
    return filteredHotels.slice(start, start + HOTELS_PAGE_SIZE);
  }, [filteredHotels, hotelPage]);

  useEffect(() => {
    setHotelPage(1);
  }, [search]);

  useEffect(() => {
    setHotelPage((current) => Math.min(current, hotelTotalPages));
  }, [hotelTotalPages]);

  useEffect(() => () => {
    pendingImagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [pendingImagePreviews]);

  const hotelPageNumbers = useMemo(() => {
    const start = Math.max(1, hotelPage - 2);
    const end = Math.min(hotelTotalPages, hotelPage + 2);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [hotelPage, hotelTotalPages]);

  const handleAmenityToggle = (amenity) => {
    setForm((current) => ({
      ...current,
      amenities: current.amenities.includes(amenity)
        ? current.amenities.filter((item) => item !== amenity)
        : [...current.amenities, amenity],
    }));
  };

  const handleEdit = (hotel) => {
    setForm(mapHotelToForm(hotel));
    setPendingImages([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setPendingImages([]);
  };

  const handleDelete = async (hotelId) => {
    if (!window.confirm('Delete this hotel from active listings?')) return;

    try {
      await hotelApi.deleteHotel(hotelId);
      toast.success('Hotel removed from active listings');
      await loadHotels();
      setHotelPage(1);
      if (form.id === hotelId) {
        handleReset();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete hotel');
    }
  };

  const resetRoomDraft = () => {
    setForm((current) => ({
      ...current,
      roomTitle: '',
      roomType: 'double',
      roomPricePerNight: '',
      roomMaxGuests: current.maxGuests || 2,
      roomTotalRooms: 1,
      roomBedType: 'queen',
      roomSize: '',
      roomAmenitiesInput: '',
    }));
  };

  const handleImageSelection = (event) => {
    setPendingImages(Array.from(event.target.files || []));
  };

  const uploadSelectedImages = async (hotelId) => {
    if (!pendingImages.length) {
      return;
    }

    const formData = new FormData();
    pendingImages.forEach((file) => formData.append('images', file));
    await hotelApi.uploadHotelImages(hotelId, formData);
  };

  const handleAddRoomToHotel = async () => {
    if (!form.id) {
      toast.error('Save the hotel first before adding rooms');
      return;
    }

    const roomValidationMessage = validateRoomDraft(form);
    if (roomValidationMessage) {
      toast.error(roomValidationMessage);
      return;
    }

    try {
      setSaving(true);
      await hotelApi.createRoom(form.id, toStarterRoomPayload(form));
      toast.success('Room added successfully');
      await loadHotels();
      resetRoomDraft();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add room');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.id && form.createStarterRoom) {
      const roomValidationMessage = validateRoomDraft(form, { allowGeneratedTitle: true });
      if (roomValidationMessage) {
        toast.error(roomValidationMessage);
        return;
      }
    }

    try {
      setSaving(true);
      const payload = toHotelPayload(form);
      let hotelId = form.id;
      const warnings = [];

      if (form.id) {
        await hotelApi.updateHotel(form.id, payload);
      } else {
        const { data } = await hotelApi.createHotel(payload);
        hotelId = data.data.hotel._id;
      }

      if (hotelId && pendingImages.length > 0) {
        try {
          await uploadSelectedImages(hotelId);
        } catch (error) {
          warnings.push(error.response?.data?.message || 'Images could not be uploaded right now.');
        }
      }

      if (!form.id && form.createStarterRoom) {
        try {
          await hotelApi.createRoom(hotelId, toStarterRoomPayload(form));
        } catch (error) {
          warnings.push(error.response?.data?.message || 'Starter room could not be created.');
        }
      }

      await loadHotels();
      setHotelPage(1);
      handleReset();
      toast.success(form.id ? 'Hotel updated successfully' : 'Hotel created successfully');
      warnings.forEach((warning) => toast.error(warning));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save hotel');
    } finally {
      setSaving(false);
    }
  };

  const visibleHotelStart = filteredHotels.length === 0 ? 0 : ((hotelPage - 1) * HOTELS_PAGE_SIZE) + 1;
  const visibleHotelEnd = Math.min(hotelPage * HOTELS_PAGE_SIZE, filteredHotels.length);

  return (
    <div className={`page container ${styles.page}`}>
      <div className={styles.header}>
        <div>
          <h1>Manage Hotels</h1>
          <p>Create, update, feature, and retire hotel listings. New properties can optionally create a starter room so they are immediately bookable.</p>
        </div>
        <div className={styles.actions}>
          <Link to="/admin" className={styles.secondaryBtn}>Back to Dashboard</Link>
          <button type="button" className={styles.ghostBtn} onClick={handleReset}>New Hotel Form</button>
        </div>
      </div>

      <div className={styles.cardGrid} style={{ marginBottom: 'var(--space-6)' }}>
        <div className={styles.metricCard}>
          <strong>{hotels.length}</strong>
          <span>Active hotels</span>
        </div>
        <div className={styles.metricCard}>
          <strong>{hotels.filter((hotel) => hotel.isFeatured).length}</strong>
          <span>Featured listings</span>
        </div>
        <div className={styles.metricCard}>
          <strong>{formatCurrency(hotels.reduce((sum, hotel) => sum + (hotel.pricePerNight || 0), 0) / Math.max(hotels.length, 1))}</strong>
          <span>Average nightly price</span>
        </div>
      </div>

      <section className={`${styles.panel} ${styles.centeredPanel}`} style={{ marginBottom: 'var(--space-6)' }}>
        <div className={styles.panelIntro}>
          <div>
            <h2>{form.id ? 'Edit Hotel & Gallery' : 'Add A New Hotel'}</h2>
            <p>Keep the hotel form centered for quick editing, then review every live listing in the paginated gallery below.</p>
          </div>
          {form.id && (
            <span className={styles.pill} style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
              Editing {editingHotel?.title || form.title}
            </span>
          )}
        </div>

        <section className={styles.formShell}>
          <form className={styles.stack} onSubmit={handleSubmit}>
            <div>
              <label className={styles.label}>Hotel Title</label>
              <input className={styles.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="The Marigold Suites" required />
            </div>

            <div className={styles.formGrid}>
              <div>
                <label className={styles.label}>Property Type</label>
                <select className={styles.select} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {HOTEL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div>
                <label className={styles.label}>Base Price Per Night</label>
                <input className={styles.input} type="number" min="100" value={form.pricePerNight} onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })} required />
              </div>
              <div>
                <label className={styles.label}>Max Guests</label>
                <input className={styles.input} type="number" min="1" value={form.maxGuests} onChange={(e) => setForm({ ...form, maxGuests: e.target.value })} required />
              </div>
              <div>
                <label className={styles.label}>Total Rooms</label>
                <input className={styles.input} type="number" min="1" value={form.totalRooms} onChange={(e) => setForm({ ...form, totalRooms: e.target.value })} required />
              </div>
            </div>

            <div className={styles.formGrid}>
              <div>
                <label className={styles.label}>Street</label>
                <input className={styles.input} value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} placeholder="Near MG Road" />
              </div>
              <div>
                <label className={styles.label}>City</label>
                <input className={styles.input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
              </div>
              <div>
                <label className={styles.label}>State</label>
                <input className={styles.input} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required />
              </div>
              <div>
                <label className={styles.label}>Country</label>
                <input className={styles.input} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
              <div>
                <label className={styles.label}>Latitude</label>
                <input className={styles.input} type="number" step="0.000001" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              </div>
              <div>
                <label className={styles.label}>Longitude</label>
                <input className={styles.input} type="number" step="0.000001" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
              </div>
            </div>

            <div>
              <label className={styles.label}>Description</label>
              <textarea className={styles.textarea} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the vibe, location, and guest experience..." required />
            </div>

            <div>
              <label className={styles.label}>{form.id ? 'Add Hotel Images' : 'Hotel Images'}</label>
              <input className={styles.input} type="file" accept="image/*" multiple onChange={handleImageSelection} />
              <p className={styles.hint}>
                {pendingImages.length > 0
                  ? `${pendingImages.length} image${pendingImages.length === 1 ? '' : 's'} selected. The first selected image becomes the cover shown to guests.`
                  : 'Select up to 10 images. You can upload multiple images, and the first one will be used as the hotel cover.'}
              </p>
              {pendingImagePreviews.length > 0 && (
                <div className={styles.imagePreviewGrid}>
                  {pendingImagePreviews.map((preview, index) => (
                    <figure key={preview.id} className={styles.imagePreviewCard}>
                      <img src={preview.url} alt={preview.name} />
                      <figcaption>{index === 0 ? 'Cover image' : 'Gallery image'}</figcaption>
                    </figure>
                  ))}
                </div>
              )}
              {form.id && editingHotel?.images?.length > 0 && (
                <div className={styles.existingGalleryBlock}>
                  <div className={styles.metaText}>Current gallery</div>
                  <div className={styles.imagePreviewGrid}>
                    {editingHotel.images.slice(0, 6).map((image, index) => (
                      <figure key={image._id || image.publicId || image.url} className={styles.imagePreviewCard}>
                        <img src={image.url} alt={`${editingHotel.title} ${index + 1}`} />
                        <figcaption>{index === 0 ? 'Current cover' : 'Live image'}</figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className={styles.label}>Amenities</label>
              <div className={styles.checkboxGrid}>
                {AMENITIES.map((amenity) => (
                  <label key={amenity} className={styles.checkboxItem}>
                    <input type="checkbox" checked={form.amenities.includes(amenity)} onChange={() => handleAmenityToggle(amenity)} />
                    <span>{amenity}</span>
                  </label>
                ))}
              </div>
            </div>

            {!form.id && (
              <div className={styles.panel}>
                <label className={styles.checkboxItem}>
                  <input type="checkbox" checked={form.createStarterRoom} onChange={(e) => setForm({ ...form, createStarterRoom: e.target.checked })} />
                  <span>Create a starter room for this hotel</span>
                </label>
                <p className={styles.hint}>This helps new hotels become bookable immediately after creation.</p>
                {form.createStarterRoom && (
                  <div className={styles.stack} style={{ marginTop: 'var(--space-4)' }}>
                    <div className={styles.formGrid}>
                      <div>
                        <label className={styles.label}>Room Title</label>
                        <input className={styles.input} value={form.roomTitle} onChange={(e) => setForm({ ...form, roomTitle: e.target.value })} placeholder="Deluxe King Room" />
                      </div>
                      <div>
                        <label className={styles.label}>Room Type</label>
                        <select className={styles.select} value={form.roomType} onChange={(e) => setForm({ ...form, roomType: e.target.value })}>
                          {ROOM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={styles.label}>Room Price</label>
                        <input className={styles.input} type="number" min="100" value={form.roomPricePerNight} onChange={(e) => setForm({ ...form, roomPricePerNight: e.target.value })} placeholder="Defaults to hotel base price" />
                      </div>
                      <div>
                        <label className={styles.label}>Room Max Guests</label>
                        <input className={styles.input} type="number" min="1" value={form.roomMaxGuests} onChange={(e) => setForm({ ...form, roomMaxGuests: e.target.value })} />
                      </div>
                      <div>
                        <label className={styles.label}>Inventory Count</label>
                        <input className={styles.input} type="number" min="1" value={form.roomTotalRooms} onChange={(e) => setForm({ ...form, roomTotalRooms: e.target.value })} />
                      </div>
                      <div>
                        <label className={styles.label}>Room Size (sq ft)</label>
                        <input className={styles.input} type="number" min="50" value={form.roomSize} onChange={(e) => setForm({ ...form, roomSize: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className={styles.label}>Room Amenities</label>
                      <input className={styles.input} value={form.roomAmenitiesInput} onChange={(e) => setForm({ ...form, roomAmenitiesInput: e.target.value })} placeholder="wifi, breakfast, ac, smart-tv" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {form.id && (
              <div className={styles.panel}>
                <p className={styles.hint}>Add a new room to this hotel. Public hotel cards and prices now refresh automatically after room changes.</p>
                <div className={styles.stack} style={{ marginTop: 'var(--space-4)' }}>
                  <div className={styles.formGrid}>
                    <div>
                      <label className={styles.label}>Room Title</label>
                      <input className={styles.input} value={form.roomTitle} onChange={(e) => setForm({ ...form, roomTitle: e.target.value })} placeholder="Premium Balcony Room" />
                    </div>
                    <div>
                      <label className={styles.label}>Room Type</label>
                      <select className={styles.select} value={form.roomType} onChange={(e) => setForm({ ...form, roomType: e.target.value })}>
                        {ROOM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={styles.label}>Room Price</label>
                      <input className={styles.input} type="number" min="100" value={form.roomPricePerNight} onChange={(e) => setForm({ ...form, roomPricePerNight: e.target.value })} placeholder="Defaults to hotel base price" />
                    </div>
                    <div>
                      <label className={styles.label}>Room Max Guests</label>
                      <input className={styles.input} type="number" min="1" value={form.roomMaxGuests} onChange={(e) => setForm({ ...form, roomMaxGuests: e.target.value })} />
                    </div>
                    <div>
                      <label className={styles.label}>Inventory Count</label>
                      <input className={styles.input} type="number" min="1" value={form.roomTotalRooms} onChange={(e) => setForm({ ...form, roomTotalRooms: e.target.value })} />
                    </div>
                    <div>
                      <label className={styles.label}>Room Size (sq ft)</label>
                      <input className={styles.input} type="number" min="50" value={form.roomSize} onChange={(e) => setForm({ ...form, roomSize: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className={styles.label}>Room Amenities</label>
                    <input className={styles.input} value={form.roomAmenitiesInput} onChange={(e) => setForm({ ...form, roomAmenitiesInput: e.target.value })} placeholder="wifi, breakfast, ac, smart-tv" />
                  </div>
                  <div className={styles.inlineActions}>
                    <button type="button" className={styles.primaryBtn} onClick={handleAddRoomToHotel} disabled={saving}>
                      {saving ? 'Saving...' : 'Add Room'}
                    </button>
                    <button type="button" className={styles.secondaryBtn} onClick={resetRoomDraft}>Clear Room Draft</button>
                  </div>
                </div>
              </div>
            )}

            <label className={styles.checkboxItem}>
              <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
              <span>Show this hotel in featured sections</span>
            </label>

            <div className={styles.inlineActions}>
              <button type="submit" className={styles.primaryBtn} disabled={saving}>
                {saving ? 'Saving...' : form.id ? 'Update Hotel' : 'Create Hotel'}
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={handleReset}>Reset</button>
            </div>
          </form>
        </section>
      </section>

      <section className={`${styles.panel} ${styles.hotelCollectionPanel}`}>
        <div className={styles.hotelListHeader}>
          <div>
            <h2>Hotels In Your Portfolio</h2>
            <p>Browse live properties, check room coverage, and jump into edits without leaving the page.</p>
          </div>
          <div className={styles.hotelListSearch}>
            <input className={styles.input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by hotel, city, type, or room title" />
            <span className={styles.metaText}>
              Showing {visibleHotelStart}-{visibleHotelEnd} of {filteredHotels.length}
            </span>
          </div>
        </div>

        {loading ? <Loader /> : filteredHotels.length === 0 ? (
          <div className={styles.emptyState}>No hotels match your current search.</div>
        ) : (
          <>
            <div className={styles.hotelCardGrid}>
              {paginatedHotels.map((hotel) => (
                <article key={hotel._id} className={`${styles.hotelCard} ${styles.hotelListingCard}`}>
                  <div className={styles.hotelVisual}>
                    <img
                      src={getImageUrl(hotel.images)}
                      alt={hotel.title}
                    />
                    <span className={styles.hotelImageCounter}>
                      {hotel.images?.length || 0} photo{hotel.images?.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className={styles.hotelCardBody}>
                    <div className={styles.hotelCardTop}>
                      <div>
                        <h3>{hotel.title}</h3>
                        <p className={styles.metaText}>{hotel.address?.city}, {hotel.address?.state}</p>
                      </div>
                      <span className={styles.pill} style={{ background: hotel.isFeatured ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)', color: hotel.isFeatured ? '#d97706' : '#6366f1' }}>
                        {hotel.isFeatured ? 'Featured' : hotel.type}
                      </span>
                    </div>
                    <div className={styles.tagRow}>
                      <span className={styles.tag}>{formatCurrency(hotel.pricePerNight)} / night</span>
                      <span className={styles.tag}>{hotel.totalRooms} rooms</span>
                      <span className={styles.tag}>{hotel.roomCount || 0} room types</span>
                      <span className={styles.tag}>Rating {hotel.rating?.toFixed(1) || '0.0'}</span>
                    </div>
                    {hotel.images?.length > 1 && (
                      <div className={styles.hotelGalleryStrip}>
                        {hotel.images.slice(0, 3).map((image, index) => (
                          <div key={image._id || image.publicId || `${image.url}-${index}`} className={styles.hotelGalleryThumb}>
                            <img src={image.url} alt={`${hotel.title} ${index + 1}`} />
                          </div>
                        ))}
                        {hotel.images.length > 3 && (
                          <div className={styles.hotelGalleryMore}>+{hotel.images.length - 3}</div>
                        )}
                      </div>
                    )}
                    {hotel.roomsPreview?.length > 0 && (
                      <div className={styles.roomPreviewList}>
                        {hotel.roomsPreview.map((room) => (
                          <div key={room._id} className={styles.roomPreviewItem}>
                            <strong>{room.title}</strong>
                            <span>{room.type} · {room.totalRooms} keys · {room.maxGuests} guests · {formatCurrency(room.pricePerNight)}</span>
                          </div>
                        ))}
                        {hotel.roomCount > hotel.roomsPreview.length && (
                          <div className={styles.metaText}>+ {hotel.roomCount - hotel.roomsPreview.length} more room type{hotel.roomCount - hotel.roomsPreview.length === 1 ? '' : 's'}</div>
                        )}
                      </div>
                    )}
                    <div className={styles.inlineActions} style={{ marginTop: 'var(--space-4)' }}>
                      <button type="button" className={styles.primaryBtn} onClick={() => handleEdit(hotel)}>Edit</button>
                      <button type="button" className={styles.dangerBtn} onClick={() => handleDelete(hotel._id)}>Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className={styles.paginationBar}>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={hotelPage <= 1}
                onClick={() => setHotelPage((current) => current - 1)}
              >
                Previous
              </button>
              <div className={styles.pageNumberRow}>
                {hotelPageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    className={pageNumber === hotelPage ? styles.primaryBtn : styles.secondaryBtn}
                    onClick={() => setHotelPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={hotelPage >= hotelTotalPages}
                onClick={() => setHotelPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
