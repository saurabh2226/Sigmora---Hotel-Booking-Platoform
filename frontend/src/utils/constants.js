export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
export const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID;
export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
export const normalizeRole = (role) => {
  if (role === 'owner' || role === 'superadmin') {
    return 'admin';
  }

  return role || 'user';
};
export const ROLE_LABELS = {
  user: 'Guest',
  admin: 'Admin',
};

export const HOTEL_TYPES = ['hotel', 'resort', 'villa', 'apartment', 'hostel', 'guesthouse'];
export const AMENITIES = ['wifi', 'parking', 'pool', 'gym', 'spa', 'restaurant', 'bar', 'room-service', 'laundry', 'ac', 'tv', 'breakfast', 'pet-friendly', 'ev-charging', 'business-center', 'concierge'];
export const ROOM_TYPES = ['single', 'double', 'suite', 'deluxe', 'penthouse', 'dormitory'];
export const BOOKING_STATUSES = ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled', 'no-show'];

export const AMENITY_ICONS = { wifi: '📶', parking: '🅿️', pool: '🏊', gym: '💪', spa: '💆', restaurant: '🍽️', bar: '🍸', 'room-service': '🛎️', laundry: '👔', ac: '❄️', tv: '📺', breakfast: '🥐', 'pet-friendly': '🐾', 'ev-charging': '⚡', 'business-center': '💼', concierge: '🔔' };
export const STATUS_COLORS = {
  pending: '#f59e0b',
  confirmed: '#10b981',
  'checked-in': '#3b82f6',
  'checked-out': '#6366f1',
  cancelled: '#ef4444',
  'no-show': '#94a3b8',
  partial_refunded: '#0ea5e9',
  refunded: '#0ea5e9',
};
export const POPULAR_CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Goa', 'Jaipur', 'Udaipur', 'Kerala', 'Shimla'];
export const DEFAULT_OFFER_COLOR = '#0f766e';
