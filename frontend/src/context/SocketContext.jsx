import { createContext, useContext, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { normalizeRole } from '../utils/constants';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const token = useSelector((state) => state.auth.accessToken);
  const userRole = useSelector((state) => state.auth.user?.role);

  useEffect(() => {
    const s = io(import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000', {
      auth: token ? { token } : {},
      withCredentials: true,
    });

    s.on('connect', () => {
      if (token) {
        s.emit('join-user-room');
      }
      if (normalizeRole(userRole) === 'admin') {
        s.emit('join-admin-room');
      }
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [token, userRole]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
