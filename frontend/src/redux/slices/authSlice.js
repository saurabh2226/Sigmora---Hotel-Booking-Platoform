import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as authApi from '../../api/authApi';

const getApiErrorMessage = (err, fallbackMessage) => (
  err.response?.data?.errors?.[0]?.message
  || err.response?.data?.message
  || fallbackMessage
);

const safelyParseStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch (error) {
    localStorage.removeItem('user');
    return null;
  }
};

const persistSession = ({ accessToken, user }) => {
  if (accessToken) {
    localStorage.setItem('accessToken', accessToken);
  }

  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  }
};

const clearStoredSession = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
};

const persistUserOnly = (user) => {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  }
};

export const loginUser = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const { data } = await authApi.login(credentials);
    if (data.data?.accessToken && data.data?.user) {
      persistSession(data.data);
    }
    return data.data;
  } catch (err) { return rejectWithValue(getApiErrorMessage(err, 'Login failed')); }
});

export const registerUser = createAsyncThunk('auth/register', async (userData, { rejectWithValue }) => {
  try {
    const { data } = await authApi.register(userData);
    if (data.data?.accessToken && data.data?.user) {
      persistSession(data.data);
    }
    return data.data;
  } catch (err) { return rejectWithValue(getApiErrorMessage(err, 'Registration failed')); }
});

export const fetchCurrentUser = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const { data } = await authApi.getMe();
    persistUserOnly(data.data.user);
    return data.data.user;
  } catch (err) { return rejectWithValue(getApiErrorMessage(err, 'Failed to fetch user')); }
});

export const updateUserProfile = createAsyncThunk('auth/updateProfile', async (profile, { rejectWithValue }) => {
  try {
    const { data } = await authApi.updateProfile(profile);
    persistUserOnly(data.data.user);
    return data.data.user;
  } catch (err) { return rejectWithValue(getApiErrorMessage(err, 'Failed to update profile')); }
});

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  try {
    await authApi.logout();
  } finally {
    clearStoredSession();
  }
});

const storedUser = safelyParseStoredUser();
const storedAccessToken = localStorage.getItem('accessToken') || null;

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: storedUser,
    accessToken: storedAccessToken,
    loading: false,
    error: null,
    isAuthenticated: !!storedAccessToken,
  },
  reducers: {
    setAccessToken: (state, action) => {
      state.accessToken = action.payload;
      state.isAuthenticated = !!action.payload;

      if (action.payload) {
        localStorage.setItem('accessToken', action.payload);
      } else {
        localStorage.removeItem('accessToken');
      }
    },
    setSession: (state, action) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = true;
      state.error = null;
      persistSession(action.payload);
    },
    clearSession: (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      clearStoredSession();
    },
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(loginUser.fulfilled, (s, a) => {
        s.loading = false;
        s.error = null;
        if (a.payload?.accessToken && a.payload?.user) {
          s.user = a.payload.user;
          s.accessToken = a.payload.accessToken;
          s.isAuthenticated = true;
        }
      })
      .addCase(loginUser.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
      .addCase(registerUser.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(registerUser.fulfilled, (s, a) => {
        s.loading = false;
        s.error = null;
        if (a.payload?.accessToken && a.payload?.user) {
          s.user = a.payload.user;
          s.accessToken = a.payload.accessToken;
          s.isAuthenticated = true;
        }
      })
      .addCase(registerUser.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
      .addCase(fetchCurrentUser.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(fetchCurrentUser.fulfilled, (s, a) => { s.loading = false; s.user = a.payload; s.isAuthenticated = true; s.error = null; })
      .addCase(fetchCurrentUser.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
        s.user = null;
        s.accessToken = null;
        s.isAuthenticated = false;
        clearStoredSession();
      })
      .addCase(updateUserProfile.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(updateUserProfile.fulfilled, (s, a) => {
        s.loading = false;
        s.user = a.payload;
        s.error = null;
      })
      .addCase(updateUserProfile.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload;
      })
      .addCase(logoutUser.fulfilled, (s) => { s.user = null; s.accessToken = null; s.isAuthenticated = false; s.error = null; });
  },
});

export const { setAccessToken, setSession, clearSession, clearError } = authSlice.actions;
export default authSlice.reducer;
