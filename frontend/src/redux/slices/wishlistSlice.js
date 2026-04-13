import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as userApi from '../../api/userApi';

export const fetchWishlist = createAsyncThunk('wishlist/fetch', async (_, { rejectWithValue }) => {
  try { const { data } = await userApi.getWishlist(); return data.data.hotels; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
export const toggleWishlist = createAsyncThunk('wishlist/toggle', async (hotelId, { rejectWithValue }) => {
  try { const { data } = await userApi.toggleWishlist(hotelId); return { hotelId, wishlisted: data.data.wishlisted }; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState: { hotels: [], hotelIds: [], loading: false },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchWishlist.fulfilled, (s, a) => { s.hotels = a.payload; s.hotelIds = a.payload.map(h => h._id); s.loading = false; })
     .addCase(toggleWishlist.fulfilled, (s, a) => {
       if (a.payload.wishlisted) { s.hotelIds.push(a.payload.hotelId); }
       else { s.hotelIds = s.hotelIds.filter(id => id !== a.payload.hotelId); s.hotels = s.hotels.filter(h => h._id !== a.payload.hotelId); }
     });
  },
});
export default wishlistSlice.reducer;
