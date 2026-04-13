import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Loader from '../components/common/Loader/Loader';
import { getMe } from '../api/authApi';
import { setSession } from '../redux/slices/authSlice';
import { getPostAuthRedirect } from '../utils/routeHelpers';

const getSafeRedirect = (value) => {
  if (typeof value === 'string' && value.startsWith('/')) {
    return value;
  }

  return '/';
};

export default function GoogleAuthCallbackPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }

    hasStarted.current = true;

    const completeGoogleLogin = async () => {
      const params = new URLSearchParams(location.search);
      const accessToken = params.get('accessToken');
      const error = params.get('error');
      const redirect = getSafeRedirect(params.get('redirect'));

      if (error) {
        toast.error(error);
        navigate('/login', { replace: true });
        return;
      }

      if (!accessToken) {
        toast.error('Google sign-in did not return an access token');
        navigate('/login', { replace: true });
        return;
      }

      try {
        localStorage.setItem('accessToken', accessToken);
        const { data } = await getMe();
        localStorage.setItem('user', JSON.stringify(data.data.user));
        dispatch(setSession({
          accessToken,
          user: data.data.user,
        }));
        toast.success('Signed in with Google');
        navigate(getPostAuthRedirect(data.data.user, redirect), { replace: true });
      } catch (callbackError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        toast.error(callbackError.response?.data?.message || 'Google sign-in failed');
        navigate('/login', { replace: true });
      }
    };

    completeGoogleLogin();
  }, [dispatch, location.search, navigate]);

  return <Loader fullPage />;
}
