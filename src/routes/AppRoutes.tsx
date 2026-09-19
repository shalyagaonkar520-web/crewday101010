import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoadingScreen } from '@/components/ui/Feedback'
import { UserLayout } from '@/layouts/UserLayout'
import { AdminLayout } from '@/layouts/AdminLayout'
import {
  AllowGuests,
  RedirectIfAuthenticated,
  RequireAdmin,
  RequireAuth,
  RequireOnboarding,
} from '@/routes/guards'

/**
 * Route-level code splitting. The admin bundle (tables, scanner, dashboard)
 * never reaches a member's phone, and the QR decoder only loads at check-in.
 */
const LandingPage = lazy(() => import('@/pages/Landing'))
const LoginPage = lazy(() => import('@/pages/auth/Login'))
const SignupPage = lazy(() => import('@/pages/auth/Signup'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPassword'))
const OnboardingPage = lazy(() => import('@/pages/user/Onboarding'))
const HomePage = lazy(() => import('@/pages/user/Home'))
const ExplorePage = lazy(() => import('@/pages/user/Explore'))
const EventDetailPage = lazy(() => import('@/pages/user/EventDetail'))
const RegisterForEventPage = lazy(() => import('@/pages/user/RegisterForEvent'))
const RegistrationSuccessPage = lazy(() => import('@/pages/user/RegistrationSuccess'))
const MyEventsPage = lazy(() => import('@/pages/user/MyEvents'))
const TicketPage = lazy(() => import('@/pages/user/TicketPage'))
const ProfilePage = lazy(() => import('@/pages/user/Profile'))
const EditProfilePage = lazy(() => import('@/pages/user/EditProfile'))
const SuggestEventPage = lazy(() => import('@/pages/user/SuggestEvent'))
const SettingsPage = lazy(() => import('@/pages/user/Settings'))
const NotificationsPage = lazy(() => import('@/pages/user/Notifications'))
const NotFoundPage = lazy(() => import('@/pages/NotFound'))

const AdminLoginPage = lazy(() => import('@/pages/admin/AdminLogin'))
const AdminDashboardPage = lazy(() => import('@/pages/admin/Dashboard'))
const AdminEventsPage = lazy(() => import('@/pages/admin/AdminEvents'))
const EventFormPage = lazy(() => import('@/pages/admin/EventForm'))
const EventAttendeesPage = lazy(() => import('@/pages/admin/EventAttendees'))
const CheckInPage = lazy(() => import('@/pages/admin/CheckIn'))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsers'))
const AdminInterestsPage = lazy(() => import('@/pages/admin/AdminInterests'))
const AdminRequestsPage = lazy(() => import('@/pages/admin/AdminRequests'))
const AdminReportsPage = lazy(() => import('@/pages/admin/AdminReports'))

// Legal pages are two named exports from one module.
const TermsPage = lazy(() =>
  import('@/pages/legal/Legal').then((module) => ({ default: module.TermsPage })),
)
const PrivacyPage = lazy(() =>
  import('@/pages/legal/Legal').then((module) => ({ default: module.PrivacyPage })),
)

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public */}
        {/* Signed out lands on explore; signed in goes to the feed. */}
        <Route
          path="/"
          element={
            <RedirectIfAuthenticated>
              <Navigate to="/explore" replace />
            </RedirectIfAuthenticated>
          }
        />
        {/* The long-form marketing page, kept for sharing and for desktop. */}
        <Route path="/about" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated allowGuests>
              <LoginPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/signup"
          element={
            <RedirectIfAuthenticated allowGuests>
              <SignupPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        {/* Onboarding sits outside the app shell: no nav until the profile exists */}
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <OnboardingPage />
            </RequireAuth>
          }
        />

        {/* Open to everyone — browsing events does not need an account */}
        <Route
          element={
            <AllowGuests>
              <UserLayout />
            </AllowGuests>
          }
        >
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/events/:eventId" element={<EventDetailPage />} />
        </Route>

        {/* Member app */}
        <Route
          element={
            <RequireAuth>
              <RequireOnboarding>
                <UserLayout />
              </RequireOnboarding>
            </RequireAuth>
          }
        >
          <Route path="/home" element={<HomePage />} />
          <Route path="/events/:eventId/register" element={<RegisterForEventPage />} />
          <Route path="/registration/:registrationId" element={<RegistrationSuccessPage />} />
          <Route path="/suggest" element={<SuggestEventPage />} />
          <Route path="/my-events" element={<MyEventsPage />} />
          <Route path="/tickets/:registrationId" element={<TicketPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/profile" element={<EditProfilePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>

        {/* Admin */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="events" element={<AdminEventsPage />} />
          <Route path="events/new" element={<EventFormPage />} />
          <Route path="events/:eventId/edit" element={<EventFormPage />} />
          <Route path="events/:eventId/attendees" element={<EventAttendeesPage />} />
          <Route path="check-in" element={<CheckInPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="interests" element={<AdminInterestsPage />} />
          <Route path="requests" element={<AdminRequestsPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
        </Route>

        {/* Legacy / convenience redirects */}
        <Route path="/events" element={<Navigate to="/explore" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
