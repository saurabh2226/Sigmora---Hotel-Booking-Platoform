import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as adminApi from '../../api/adminApi';

export const fetchDashboardStats = createAsyncThunk('admin/dashboard', async (_, { rejectWithValue }) => {
  try { const { data } = await adminApi.getDashboardStats(); return data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});
export const fetchAdminUsers = createAsyncThunk('admin/users', async (params, { rejectWithValue }) => {
  try { const { data } = await adminApi.getUsers(params); return data.data; }
  catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const adminSlice = createSlice({
  name: 'admin',
  initialState: { stats: null, monthlyRevenue: [], recentBookings: [], users: [], loading: false, error: null, pagination: {} },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchDashboardStats.pending, (s) => { s.loading = true; })
     .addCase(fetchDashboardStats.fulfilled, (s, a) => { s.loading = false; s.stats = a.payload.stats; s.monthlyRevenue = a.payload.monthlyRevenue; s.recentBookings = a.payload.recentBookings; })
     .addCase(fetchDashboardStats.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
     .addCase(fetchAdminUsers.fulfilled, (s, a) => { s.users = a.payload.users; s.pagination = { page: a.payload.currentPage, totalPages: a.payload.totalPages, total: a.payload.totalResults }; });
  },
});
export default adminSlice.reducer;
