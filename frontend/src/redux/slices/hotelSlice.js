import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as hotelApi from '../../api/hotelApi';

export const fetchHotels = createAsyncThunk('hotels/fetch', async (params, { rejectWithValue }) => {
  try { const { data } = await hotelApi.getHotels(params); return data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to fetch hotels'); }
});
export const fetchFeaturedHotels = createAsyncThunk('hotels/featured', async (_, { rejectWithValue }) => {
  try { const { data } = await hotelApi.getFeaturedHotels(); return data.data.hotels; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
export const fetchPopularDestinations = createAsyncThunk('hotels/destinations', async (_, { rejectWithValue }) => {
  try { const { data } = await hotelApi.getPopularDestinations(); return data.data.destinations; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
export const fetchHotel = createAsyncThunk('hotels/fetchOne', async (idOrSlug, { rejectWithValue }) => {
  try { const { data } = await hotelApi.getHotel(idOrSlug); return data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Hotel not found'); }
});
export const fetchAvailability = createAsyncThunk('hotels/availability', async ({ id, params }, { rejectWithValue }) => {
  try { const { data } = await hotelApi.getAvailability(id, params); return data.data.availability; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
export const fetchRecommendations = createAsyncThunk('hotels/recommendations', async (_, { rejectWithValue }) => {
  try { const { data } = await hotelApi.getRecommendations(); return data.data.hotels; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to fetch recommendations'); }
});

const hotelSlice = createSlice({
  name: 'hotels',
  initialState: {
    hotels: [], featured: [], popularDestinations: [], recommended: [], selectedHotel: null, rooms: [], availability: [],
    loading: false, error: null,
    pagination: { page: 1, totalPages: 1, total: 0 },
    filters: { city: '', minPrice: 0, maxPrice: 50000, type: '', amenities: [], rating: 0, sort: '-rating', search: '' },
    searchSuggestions: [],
  },
  reducers: {
    setFilters: (s, a) => { s.filters = { ...s.filters, ...a.payload }; },
    clearFilters: (s) => { s.filters = { city: '', minPrice: 0, maxPrice: 50000, type: '', amenities: [], rating: 0, sort: '-rating', search: '' }; },
    setPage: (s, a) => { s.pagination.page = a.payload; },
    clearSelectedHotel: (s) => { s.selectedHotel = null; s.rooms = []; s.availability = []; },
  },
  extraReducers: (b) => {
    b.addCase(fetchHotels.pending, (s) => { s.loading = true; s.error = null; })
     .addCase(fetchHotels.fulfilled, (s, a) => { s.loading = false; s.hotels = a.payload.hotels; s.pagination = { page: a.payload.currentPage, totalPages: a.payload.totalPages, total: a.payload.totalResults }; })
     .addCase(fetchHotels.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
     .addCase(fetchFeaturedHotels.fulfilled, (s, a) => { s.featured = a.payload; })
     .addCase(fetchPopularDestinations.fulfilled, (s, a) => { s.popularDestinations = a.payload; })
     .addCase(fetchHotel.pending, (s) => { s.loading = true; })
     .addCase(fetchHotel.fulfilled, (s, a) => { s.loading = false; s.selectedHotel = a.payload.hotel; s.rooms = a.payload.rooms; })
     .addCase(fetchHotel.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
     .addCase(fetchAvailability.fulfilled, (s, a) => { s.availability = a.payload; })
     .addCase(fetchRecommendations.fulfilled, (s, a) => { s.recommended = a.payload; });
  },
});
export const { setFilters, clearFilters, setPage, clearSelectedHotel } = hotelSlice.actions;
export default hotelSlice.reducer;
