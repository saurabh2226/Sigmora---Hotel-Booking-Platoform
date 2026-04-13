import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as bookingApi from '../../api/bookingApi';

export const createBooking = createAsyncThunk('bookings/create', async (data, { rejectWithValue }) => {
  try { const res = await bookingApi.createBooking(data); return res.data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message || 'Booking failed'); }
});
export const fetchMyBookings = createAsyncThunk('bookings/my', async (params, { rejectWithValue }) => {
  try { const { data } = await bookingApi.getMyBookings(params); return data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
export const fetchBooking = createAsyncThunk('bookings/one', async (id, { rejectWithValue }) => {
  try { const { data } = await bookingApi.getBooking(id); return data.data.booking; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
export const cancelBooking = createAsyncThunk('bookings/cancel', async ({ id, reason }, { rejectWithValue }) => {
  try { const { data } = await bookingApi.cancelBooking(id, { reason }); return data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const bookingSlice = createSlice({
  name: 'bookings',
  initialState: { bookings: [], selectedBooking: null, loading: false, error: null, pagination: { page: 1, totalPages: 1, total: 0 } },
  reducers: { clearBookingError: (s) => { s.error = null; } },
  extraReducers: (b) => {
    b.addCase(createBooking.pending, (s) => { s.loading = true; s.error = null; })
     .addCase(createBooking.fulfilled, (s, a) => { s.loading = false; s.selectedBooking = a.payload.booking; })
     .addCase(createBooking.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
     .addCase(fetchMyBookings.pending, (s) => { s.loading = true; })
     .addCase(fetchMyBookings.fulfilled, (s, a) => { s.loading = false; s.bookings = a.payload.bookings; s.pagination = { page: a.payload.currentPage, totalPages: a.payload.totalPages, total: a.payload.totalResults }; })
     .addCase(fetchMyBookings.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
     .addCase(fetchBooking.fulfilled, (s, a) => { s.selectedBooking = a.payload; })
     .addCase(cancelBooking.fulfilled, (s, a) => { s.selectedBooking = a.payload.booking; const idx = s.bookings.findIndex(b => b._id === a.payload.booking._id); if (idx !== -1) s.bookings[idx] = a.payload.booking; });
  },
});
export const { clearBookingError } = bookingSlice.actions;
export default bookingSlice.reducer;
