import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as reviewApi from '../../api/reviewApi';

export const fetchHotelReviews = createAsyncThunk('reviews/hotel', async ({ hotelId, params }, { rejectWithValue }) => {
  try { const { data } = await reviewApi.getHotelReviews(hotelId, params); return data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
export const createReview = createAsyncThunk('reviews/create', async (reviewData, { rejectWithValue }) => {
  try { const { data } = await reviewApi.createReview(reviewData); return data.data.review; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Failed to submit review'); }
});

const reviewSlice = createSlice({
  name: 'reviews',
  initialState: { reviews: [], categoryStats: null, loading: false, error: null, pagination: { page: 1, totalPages: 1, total: 0 } },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchHotelReviews.pending, (s) => { s.loading = true; })
     .addCase(fetchHotelReviews.fulfilled, (s, a) => { s.loading = false; s.reviews = a.payload.reviews; s.categoryStats = a.payload.categoryStats; s.pagination = { page: a.payload.currentPage, totalPages: a.payload.totalPages, total: a.payload.totalResults }; })
     .addCase(fetchHotelReviews.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
     .addCase(createReview.fulfilled, (s, a) => { s.reviews.unshift(a.payload); });
  },
});
export default reviewSlice.reducer;
