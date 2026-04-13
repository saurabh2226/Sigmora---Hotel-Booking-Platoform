import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/common/Navbar/Navbar';
import Footer from './components/common/Footer/Footer';
import Loader from './components/common/Loader/Loader';
import ProtectedRoute from './components/common/ProtectedRoute/ProtectedRoute';
import ScrollToTop from './components/common/ScrollToTop/ScrollToTop';
import { useAuth } from './hooks/useAuth';
import { getDashboardPathForRole } from './utils/routeHelpers';

const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const OtpVerificationPage = lazy(() => import('./pages/OtpVerificationPage'));
const GoogleAuthCallbackPage = lazy(() => import('./pages/GoogleAuthCallbackPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const HotelListingPage = lazy(() => import('./pages/HotelListingPage'));
const HotelDetailsPage = lazy(() => import('./pages/HotelDetailsPage'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const BookingConfirmationPage = lazy(() => import('./pages/BookingConfirmationPage'));
const UserDashboardPage = lazy(() => import('./pages/UserDashboardPage'));
const OwnerCommunityPage = lazy(() => import('./pages/OwnerCommunityPage'));
const OwnerReportsPage = lazy(() => import('./pages/OwnerReportsPage'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const AdminHotelsPage = lazy(() => import('./pages/AdminHotelsPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminBookingsPage = lazy(() => import('./pages/AdminBookingsPage'));
const AdminReviewsPage = lazy(() => import('./pages/AdminReviewsPage'));
const OffersManagementPage = lazy(() => import('./pages/OffersManagementPage'));
const SupportCenterPage = lazy(() => import('./pages/SupportCenterPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const InfoPage = lazy(() => import('./pages/InfoPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function GuestRoute({ children }) {
  const token = localStorage.getItem('accessToken');
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch (error) {
      return null;
    }
  })();

  return token ? <Navigate to={getDashboardPathForRole(storedUser?.role)} replace /> : children;
}

function DashboardRouter() {
  const { user } = useAuth();

  if (getDashboardPathForRole(user?.role) === '/admin') {
    return <Navigate to="/admin" replace />;
  }

  return <UserDashboardPage />;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <Suspense fallback={<Loader fullPage />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/auth/otp" element={<OtpVerificationPage />} />
          <Route path="/auth/google/callback" element={<GoogleAuthCallbackPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/hotels" element={<HotelListingPage />} />
          <Route path="/hotels/:idOrSlug" element={<HotelDetailsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/careers" element={<InfoPage pageKey="careers" />} />
          <Route path="/blog" element={<InfoPage pageKey="blog" />} />
          <Route path="/help-center" element={<InfoPage pageKey="help-center" />} />
          <Route path="/faq" element={<InfoPage pageKey="faq" />} />
          <Route path="/contact" element={<InfoPage pageKey="contact" />} />
          <Route path="/terms" element={<InfoPage pageKey="terms" />} />
          <Route path="/privacy" element={<InfoPage pageKey="privacy" />} />
          <Route path="/cookies" element={<InfoPage pageKey="cookies" />} />
          <Route path="/booking/:hotelId/:roomId" element={<ProtectedRoute><BookingPage /></ProtectedRoute>} />
          <Route path="/booking/confirmation/:bookingId" element={<ProtectedRoute><BookingConfirmationPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
          <Route path="/wishlist" element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />
          <Route path="/support" element={<ProtectedRoute><SupportCenterPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboardPage /></ProtectedRoute>} />
          <Route path="/admin/community" element={<ProtectedRoute roles={['admin']}><OwnerCommunityPage /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute roles={['admin']}><OwnerReportsPage /></ProtectedRoute>} />
          <Route path="/admin/hotels" element={<ProtectedRoute roles={['admin']}><AdminHotelsPage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminUsersPage /></ProtectedRoute>} />
          <Route path="/admin/bookings" element={<ProtectedRoute roles={['admin']}><AdminBookingsPage /></ProtectedRoute>} />
          <Route path="/admin/reviews" element={<ProtectedRoute roles={['admin']}><AdminReviewsPage /></ProtectedRoute>} />
          <Route path="/admin/offers" element={<ProtectedRoute roles={['admin']}><OffersManagementPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <Footer />
    </>
  );
}
