import { createSlice } from '@reduxjs/toolkit';
const uiSlice = createSlice({
  name: 'ui',
  initialState: { theme: localStorage.getItem('theme') || 'light', sidebarOpen: false, modalOpen: null },
  reducers: {
    toggleTheme: (s) => { s.theme = s.theme === 'light' ? 'dark' : 'light'; localStorage.setItem('theme', s.theme); document.documentElement.setAttribute('data-theme', s.theme); },
    setSidebarOpen: (s, a) => { s.sidebarOpen = a.payload; },
    setModalOpen: (s, a) => { s.modalOpen = a.payload; },
  },
});
export const { toggleTheme, setSidebarOpen, setModalOpen } = uiSlice.actions;
export default uiSlice.reducer;
