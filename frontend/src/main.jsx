import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from './redux/store';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import App from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <SocketProvider>
          <ThemeProvider>
            <App />
            <Toaster position="top-right" toastOptions={{ duration: 3000, style: { borderRadius: '10px', background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', boxShadow: 'var(--shadow-lg)' } }} />
          </ThemeProvider>
        </SocketProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
