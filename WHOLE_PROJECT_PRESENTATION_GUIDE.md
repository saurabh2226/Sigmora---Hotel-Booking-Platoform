# Sigmora Hotel Booking Platform

## Master Project Document, Repository Map, and 3-Person Presentation Guide

This document is designed to help a team understand the complete project, explain it confidently in a presentation, and divide the work clearly among 3 people.

It covers:

- what the project does
- why it was built
- the system architecture
- major user flows
- the folder and file structure
- the purpose of important files
- testing, Docker, and CI/CD
- a suggested 3-person presentation split
- a suggested demo and slide flow

Note:

- This guide focuses on the actual project source and support files that matter for development, explanation, testing, and deployment.
- Generated directories such as `node_modules`, `dist`, `playwright-report`, and `test-results` are intentionally not documented line by line because they are build/runtime artifacts, not authored project source.

---

## 1. Project Identity

### Project Name

`Sigmora - Hotel Booking Platform`

### Project Type

Full-stack hotel booking web application with:

- frontend client
- backend API
- MongoDB primary storage
- MySQL reporting/mirror layer
- Redis for locking
- Socket.IO for real-time updates
- Razorpay payment integration
- Dockerized local deployment
- CI/CD pipelines
- backend, security, UI, and load testing

### One-Line Summary

Sigmora is a production-oriented hotel booking platform where users can search hotels, check availability, book rooms, pay online, manage bookings, leave reviews, and where admins can manage hotels, bookings, reviews, offers, support, and reporting.

### Problem Statement

Traditional hotel booking systems often separate search, inventory, booking, payment, review, and support features into disconnected tools. This project solves that by offering one integrated platform that combines:

- hotel discovery
- live room availability
- booking management
- secure payment flow
- cancellation and refund flow
- support and admin management

### Main Goal of the Project

To demonstrate a realistic capstone-level product that includes:

- frontend and backend integration
- authentication and authorization
- secure API design
- database design
- payment processing
- testing strategy
- containerized deployment
- CI/CD automation

---

## 2. Main User Roles

### 1. Guest / User

A normal customer who can:

- register and log in
- verify email OTP
- search hotels
- see hotel details
- book a room
- pay with Razorpay
- cancel bookings
- view booking confirmations
- update profile
- view wishlist
- write reviews
- access support

### 2. Admin

The administrator can:

- access admin dashboard
- manage hotels
- manage users
- manage bookings
- process refunds
- moderate reviews
- manage offers
- view reports
- use support/community workflows

### 3. Platform Services / System Layer

The system itself also acts like a participant through:

- rate limiting
- email sending
- Redis locking
- room inventory management
- live availability updates
- cron cleanup jobs
- payment verification and webhook handling

---

## 3. Core Features

### Authentication and Account Management

- register with name, email, phone, and password
- login and logout
- email OTP verification
- forgot password and reset password
- Google OAuth callback flow
- JWT-based session handling
- update profile functionality

### Hotel Discovery

- featured hotels
- popular destinations
- search and filter by hotel name, city, state, type, amenities, and pricing
- debounced search
- hotel suggestions
- responsive hotel listing UI

### Hotel Detail Experience

- hotel gallery
- location and maps
- amenities
- room details
- availability checking
- reviews section
- top 3 reviews with see-all behavior
- policy display

### Booking and Payment

- date selection
- guest count selection
- one-day booking timing support
- dynamic pricing calculation
- coupon or offer support
- Razorpay order creation
- payment verification
- booking confirmation page
- PDF receipt generation logic

### Booking Lifecycle

- pending hold state
- hold expiry
- booking confirmation
- cancellation
- refund calculation
- admin refund initiation
- partial and full refund handling

### Review and Feedback

- review APIs
- hotel review listing
- category statistics
- admin review visibility/moderation

### Support and Communication

- support center page
- support APIs
- notification APIs
- owner/admin community threads

### Admin and Reporting

- admin dashboard
- booking management
- hotel management
- user management
- reports
- offers management
- refund management

### Non-Functional Features

- OWASP-style security protections
- real-time availability updates
- Docker setup
- GitHub Actions CI/CD
- Playwright UI testing
- k6 load testing

---

## 4. High-Level Architecture

## Frontend Layer

The frontend is a React + Vite application responsible for:

- UI rendering
- routing
- state management
- API interaction
- protected routes
- user dashboard and admin panels

Key frontend technologies:

- React
- React Router
- Redux Toolkit
- Socket.IO client
- Vite

## Backend Layer

The backend is a Node.js + Express API responsible for:

- authentication
- business logic
- hotel and booking APIs
- payment handling
- review and support logic
- validation
- authorization
- security middleware

Key backend technologies:

- Node.js
- Express
- Mongoose
- Sequelize
- JWT
- bcrypt
- Razorpay
- Nodemailer
- Redis
- Socket.IO

## Data Layer

### MongoDB

MongoDB is used as the primary application database for flexible domain objects such as:

- users
- hotels
- rooms
- bookings
- reviews
- conversations
- offers

### MySQL

MySQL is used through Sequelize as a relational mirror/reporting layer. It supports:

- structured data analysis
- SQL-backed reporting
- data synchronization from Mongo records

### Redis

Redis is used to support:

- distributed locking
- safer inventory handling
- room hold and booking coordination

## Real-Time Layer

Socket.IO is used for:

- live availability updates
- hotel catalog update events
- detail page refresh triggers

## Deployment Layer

The system is prepared for:

- local Docker Compose deployment
- production-style Docker builds
- GitHub Actions CI
- GitHub Actions CD
- Kubernetes/EKS deployment workflows

---

## 5. Key End-to-End Product Flows

## Flow A: User Registration and Login

1. User opens registration page.
2. User enters name, email, phone number, and password.
3. Backend validates request.
4. User record is created.
5. OTP verification flow is triggered.
6. After successful verification, user is authenticated.
7. Session is maintained using access token and stored user state.

## Flow B: Hotel Search and Discovery

1. User enters search text or city.
2. Frontend debounces the search request.
3. Backend `getHotels` builds query filters.
4. Matching hotels are returned with pagination and offers.
5. User can refine by price, rating, and type.

## Flow C: Hotel Detail to Booking

1. User opens a hotel detail page.
2. Frontend fetches hotel details, rooms, reviews, and availability.
3. User selects dates and guests.
4. Available room inventory is checked.
5. User proceeds to booking page for a selected room.

## Flow D: Booking and Payment

1. User fills booking form.
2. Backend creates a pending booking and holds inventory.
3. Frontend requests Razorpay order.
4. User completes payment.
5. Backend verifies signature and marks booking confirmed.
6. Confirmation and receipt data become available.

## Flow E: Cancellation and Refund

1. User or admin initiates cancellation/refund action.
2. Refund policy is calculated.
3. Razorpay refund API is used where applicable.
4. Booking payment state becomes `partial_refunded` or `refunded`.
5. Refund details are stored and exposed in UI.

## Flow F: Admin Booking Management

1. Admin logs in.
2. Navbar switches to admin-specific navigation.
3. Admin opens bookings module.
4. Admin updates booking status or initiates refund.
5. Refund confirmation dialog captures amount and note.
6. Backend validates refund amount and sends Razorpay request.

## Flow G: Reviews and Visibility

1. Guest reviews are fetched for hotel details.
2. Reviews are sorted and top 3 are shown first.
3. If more exist, user can open all reviews.
4. Admin responses can also be displayed.

---

## 6. Why This Project Is Strong for Presentation

This project is presentation-friendly because it demonstrates both breadth and depth.

### Breadth

It covers nearly the full product lifecycle:

- UI
- API
- database
- auth
- payments
- testing
- DevOps

### Depth

It also includes advanced engineering topics:

- dual-database architecture
- Redis-based locking
- real-time socket updates
- refund lifecycle
- automated tests at several levels
- GitHub Actions workflows

### Practical Realism

It feels like a real deployable product rather than just a CRUD demo.

---

## 7. Suggested Presentation Flow

Use this if the team needs to present in a clean and confident way.

## Slide 1: Title and Team

Explain:

- project name
- domain: hotel booking
- what problem you solve
- team member names

## Slide 2: Problem and Solution

Explain:

- why hotel booking platforms need integrated search, booking, payment, and support
- how Sigmora combines these in one system

## Slide 3: Main Features

Show:

- auth
- hotel listing
- hotel details
- booking
- payment
- reviews
- admin dashboard

## Slide 4: System Architecture

Explain:

- React frontend
- Express backend
- MongoDB
- MySQL
- Redis
- Socket.IO

## Slide 5: Frontend Walkthrough

Show:

- landing page
- hotel listing
- hotel details
- booking page
- dashboard

## Slide 6: Backend and APIs

Explain:

- controllers
- routes
- models
- services
- middleware

## Slide 7: Payment, Booking, and Refund Logic

Explain:

- hold creation
- payment verification
- refund initiation
- booking status changes

## Slide 8: Testing and Security

Show:

- unit tests
- integration tests
- security tests
- Playwright tests
- k6 load tests

## Slide 9: DevOps and Deployment

Explain:

- Docker Compose
- GitHub Actions CI
- CD pipeline
- health checks

## Slide 10: Learnings and Future Scope

Explain:

- what was technically challenging
- what can be improved next

---

## 8. 3-Person Project Distribution

Below is a fair functionality-based distribution for 3 people. It is not divided into frontend versus backend. It is divided into 3 full product stages so that each person can explain one complete business area from end to end.

The 3 balanced stages are:

- before booking
- booking and guest journey
- platform operations and business control

## Functional Distribution Rule

Each person should explain:

- the user or business goal in that area
- the main workflows in that area
- the important rules and validations in that area
- the related frontend and backend files together

This keeps the presentation equal and natural.

## Complete Functionality Ownership Matrix

| Functionality | What it includes | Owner |
| --- | --- | --- |
| Account registration | signup, field validation, phone number rules, account creation | Person 1 |
| Authentication | login, logout, token session behavior | Person 1 |
| Recovery flows | OTP verification, forgot password, reset password, Google callback | Person 1 |
| Landing experience | navbar, home page, hero section, public pages | Person 1 |
| Discovery modules | featured hotels, popular destinations, recommendations | Person 1 |
| Search modules | hotel name search, city/state/type search, debounce, suggestions, sorting, pagination | Person 1 |
| Trust-building hotel view | gallery, amenities, policies, maps, reviews, top 3 reviews, see-all reviews | Person 1 |
| Wishlist | save and revisit hotels | Person 1 |
| Availability | guest count, room selection, live room availability | Person 2 |
| Booking form | guest details, date selection, one-day timing support, validation | Person 2 |
| Pricing | subtotal, tax, service fee, dynamic pricing rules | Person 2 |
| Offer usage at checkout | coupon application and booking-time discounts | Person 2 |
| Payment flow | Razorpay order creation, verification, failed payment handling, webhook | Person 2 |
| Confirmation flow | booking confirmation page, receipt/PDF | Person 2 |
| User account management | profile update and booking history | Person 2 |
| User post-booking flow | cancellation, refund visibility, booking summary | Person 2 |
| Guest communication | notifications, transactional emails, support center | Person 2 |
| Subscription and outreach | newsletter or subscription flow | Person 2 |
| Admin navigation | admin navbar and admin dashboard | Person 3 |
| Admin hotel operations | hotel management and operational control | Person 3 |
| Admin user operations | user management and monitoring | Person 3 |
| Admin booking operations | booking status updates, refund dialog, refund initiation | Person 3 |
| Admin content operations | review moderation/response and offer management | Person 3 |
| Business operations | community threads and reports | Person 3 |
| Platform security and governance | auth protection, admin protection, validation, rate limiting, headers, error handling | Person 3 |
| Platform runtime | MongoDB, MySQL mirror, Redis locks, Socket.IO, cron jobs | Person 3 |
| Quality engineering | unit, integration, security, UI, and load testing | Person 3 |
| Release engineering | Docker, Compose, CI, CD, smoke test readiness | Person 3 |

## Person 1: Discover, Trust, and Decide

### Main Responsibility

Person 1 owns everything that happens before a booking is created.

### Core Story This Person Tells

"How a user enters the platform, discovers hotels, evaluates them, and decides what to book."

### Functionalities Covered by Person 1

- user registration
- login and logout
- OTP verification
- forgot password
- reset password
- Google OAuth callback flow
- phone validation during account creation
- home page
- public navigation
- featured hotels
- popular destinations
- recommendations
- hotel listing
- debounced hotel search
- search suggestions
- filters and sorting
- hotel details page
- gallery and images
- amenities
- hotel policies
- Google Maps and location section
- public review visibility
- top 3 reviews and see-all flow
- wishlist
- static public information pages

### Why This Is a Fair Module

This stage is large and important because it covers:

- user onboarding
- first impression
- hotel discovery
- trust building
- decision making before payment

### Cross-Stack Files Person 1 Should Know

#### Identity and account access

- `frontend/src/pages/RegisterPage.jsx`
- `frontend/src/pages/LoginPage.jsx`
- `frontend/src/pages/ForgotPasswordPage.jsx`
- `frontend/src/pages/ResetPasswordPage.jsx`
- `frontend/src/pages/OtpVerificationPage.jsx`
- `frontend/src/pages/GoogleAuthCallbackPage.jsx`
- `frontend/src/redux/slices/authSlice.js`
- `frontend/src/api/authApi.js`
- `backend/src/routes/authRoutes.js`
- `backend/src/controllers/authController.js`
- `backend/src/models/User.js`
- `backend/src/utils/validators.js`

#### Discovery and hotel evaluation

- `frontend/src/pages/HomePage.jsx`
- `frontend/src/pages/HotelListingPage.jsx`
- `frontend/src/pages/HotelDetailsPage.jsx`
- `frontend/src/pages/WishlistPage.jsx`
- `frontend/src/redux/slices/hotelSlice.js`
- `frontend/src/redux/slices/reviewSlice.js`
- `frontend/src/redux/slices/wishlistSlice.js`
- `frontend/src/api/hotelApi.js`
- `frontend/src/api/reviewApi.js`
- `frontend/src/hooks/useDebounce.js`
- `backend/src/routes/hotelRoutes.js`
- `backend/src/routes/reviewRoutes.js`
- `backend/src/routes/wishlistRoutes.js`
- `backend/src/controllers/hotelController.js`
- `backend/src/controllers/reviewController.js`
- `backend/src/controllers/wishlistController.js`
- `backend/src/services/recommendationService.js`
- `backend/src/models/Hotel.js`
- `backend/src/models/Room.js`
- `backend/src/models/Review.js`
- `backend/src/models/Wishlist.js`

#### Shared public presentation files

- `frontend/src/components/common/Navbar/Navbar.jsx`
- `frontend/src/components/common/Footer/Footer.jsx`
- `frontend/src/pages/AboutPage.jsx`
- `frontend/src/pages/InfoPage.jsx`
- `frontend/src/utils/helpers.js`
- `frontend/src/utils/formatters.js`
- `frontend/src/utils/constants.js`

### Best Talking Points for Person 1

- how users enter the system
- how search and discovery work
- how hotel details create trust
- how maps, reviews, and amenities improve booking confidence
- how the platform helps users decide before they pay

---

## Person 2: Reserve, Pay, and Manage the Guest Journey

### Main Responsibility

Person 2 owns the full transaction and customer lifecycle after the user selects a hotel.

### Core Story This Person Tells

"How a selected room becomes a confirmed booking, how payment works, and how the guest manages the booking afterward."

### Functionalities Covered by Person 2

- room availability checks
- guest count and room selection
- booking form
- guest details validation
- one-day booking timing support
- live pricing
- tax and fee calculation
- offer and coupon application during booking
- booking creation
- Razorpay order creation
- checkout handoff
- payment verification
- failed payment handling
- webhook behavior
- booking confirmation page
- receipt and PDF generation
- user dashboard
- profile update
- booking history
- user cancellation flow
- refund visibility
- guest notifications
- booking-related emails
- support center and support conversations
- subscription or newsletter flow

### Why This Is a Fair Module

This stage is equally strong because it covers:

- reservation conversion
- money movement
- booking correctness
- guest communication
- post-booking user management

### Cross-Stack Files Person 2 Should Know

#### Booking, availability, and profile journey

- `frontend/src/pages/BookingPage.jsx`
- `frontend/src/pages/BookingConfirmationPage.jsx`
- `frontend/src/pages/UserDashboardPage.jsx`
- `frontend/src/redux/slices/bookingSlice.js`
- `frontend/src/redux/slices/authSlice.js`
- `frontend/src/api/bookingApi.js`
- `frontend/src/api/userApi.js`
- `backend/src/routes/bookingRoutes.js`
- `backend/src/controllers/bookingController.js`
- `backend/src/controllers/userController.js`
- `backend/src/models/Booking.js`
- `backend/src/models/Payment.js`
- `backend/src/models/User.js`
- `backend/src/services/availabilityService.js`
- `backend/src/services/bookingLifecycleService.js`
- `backend/src/services/pricingService.js`
- `backend/src/services/refundPolicyService.js`

#### Payment, pricing, offers, and receipt files

- `frontend/src/api/paymentApi.js`
- `frontend/src/api/couponApi.js`
- `frontend/src/utils/razorpayCheckout.js`
- `frontend/src/utils/bookingReceiptPdf.js`
- `frontend/src/utils/dateUtils.js`
- `frontend/src/utils/validators.js`
- `backend/src/routes/paymentRoutes.js`
- `backend/src/routes/couponRoutes.js`
- `backend/src/controllers/paymentController.js`
- `backend/src/controllers/couponController.js`
- `backend/src/services/paymentService.js`
- `backend/src/models/Coupon.js`

#### Guest communication and support

- `frontend/src/pages/SupportCenterPage.jsx`
- `frontend/src/api/supportApi.js`
- `frontend/src/api/subscriptionApi.js`
- `backend/src/routes/supportRoutes.js`
- `backend/src/routes/notificationRoutes.js`
- `backend/src/routes/subscriptionRoutes.js`
- `backend/src/controllers/supportController.js`
- `backend/src/controllers/notificationController.js`
- `backend/src/controllers/subscriptionController.js`
- `backend/src/services/emailService.js`
- `backend/src/services/notificationService.js`
- `backend/src/models/Notification.js`
- `backend/src/models/SupportConversation.js`
- `backend/src/models/NewsletterSubscriber.js`

### Best Talking Points for Person 2

- how room availability is calculated
- how the booking form is validated
- how short-stay timing support works
- how price is computed correctly
- how Razorpay payment is verified securely
- how users manage bookings, cancellations, and confirmations

---

## Person 3: Operate, Govern, and Deliver the Platform

### Main Responsibility

Person 3 owns the full business-control and reliability side of the project.

### Core Story This Person Tells

"How the platform is operated by admins, kept reliable in production, and proven through testing and deployment automation."

### Functionalities Covered by Person 3

- admin-specific navbar behavior
- admin dashboard
- admin hotel management
- admin user management
- admin booking management
- booking status updates by admin
- refund initiation by admin
- refund confirmation dialog and operational refund control
- admin review moderation and responses
- offer management
- community threads
- reports and business analytics
- security middleware and governance rules
- MySQL mirror and reporting layer
- Redis locking
- Socket.IO real-time updates
- scheduled jobs
- unit tests
- integration tests
- security tests
- Playwright UI tests
- k6 load tests
- Docker setup
- Docker Compose
- CI workflow
- CD workflow
- smoke-check and deployment readiness

### Why This Is a Fair Module

This stage is equally important because it covers:

- business administration
- refund operations
- system reliability
- automated quality checks
- deployment readiness

### Cross-Stack Files Person 3 Should Know

#### Admin product modules

- `frontend/src/components/common/Navbar/Navbar.jsx`
- `frontend/src/pages/AdminDashboardPage.jsx`
- `frontend/src/pages/AdminHotelsPage.jsx`
- `frontend/src/pages/AdminUsersPage.jsx`
- `frontend/src/pages/AdminBookingsPage.jsx`
- `frontend/src/pages/AdminReviewsPage.jsx`
- `frontend/src/pages/OffersManagementPage.jsx`
- `frontend/src/pages/OwnerCommunityPage.jsx`
- `frontend/src/pages/OwnerReportsPage.jsx`
- `frontend/src/pages/AdminWorkspace.module.css`
- `frontend/src/api/adminApi.js`
- `frontend/src/api/ownerApi.js`
- `backend/src/routes/adminRoutes.js`
- `backend/src/routes/ownerRoutes.js`
- `backend/src/controllers/adminController.js`
- `backend/src/controllers/ownerController.js`
- `backend/src/controllers/paymentController.js`
- `backend/src/controllers/reviewController.js`
- `backend/src/controllers/couponController.js`

#### Runtime and platform integrity

- `backend/src/server.js`
- `backend/src/app.js`
- `backend/src/config/db.js`
- `backend/src/config/sequelize.js`
- `backend/src/config/redis.js`
- `backend/src/middleware/auth.js`
- `backend/src/middleware/admin.js`
- `backend/src/middleware/errorHandler.js`
- `backend/src/middleware/rateLimiter.js`
- `backend/src/middleware/roles.js`
- `backend/src/middleware/validate.js`
- `backend/src/socket/socketHandler.js`
- `backend/src/services/distributedLockService.js`
- `backend/src/services/sqlMirrorService.js`
- `backend/src/jobs/cleanupJob.js`
- `backend/src/jobs/emailJob.js`
- `backend/src/models/sql/index.js`
- all files in `backend/src/models/sql/`
- `backend/src/utils/roleMigration.js`
- `backend/src/utils/seedSqlFromMongo.js`
- `backend/src/utils/syncSqlSchema.js`

#### Testing and release engineering

- `backend/tests/setup.js`
- `backend/tests/dbSetup.js`
- all files in `backend/tests/unit/`
- all files in `backend/tests/integration/`
- all files in `backend/tests/security/`
- `e2e/playwright.config.js`
- `e2e/mock-backend.js`
- all files in `e2e/tests/`
- `load-tests/k6-config.js`
- `load-tests/stress-test.js`
- `.github/workflows/ci.yml`
- `.github/workflows/e2e.yml`
- `.github/workflows/cd.yml`
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf`

### Best Talking Points for Person 3

- how admins operate the platform
- how refund operations are controlled
- why Redis, MySQL mirror, and sockets improve reliability
- how testing proves correctness
- how Docker and CI/CD make the platform deployable

---

## Fairness Check Across the 3 People

This split is fair because each person owns one complete functional stage:

- Person 1: before booking
- Person 2: booking and guest journey
- Person 3: after-booking business control and platform reliability

Each person gets:

- user-facing and business-facing features
- technical explanation depth
- frontend and backend references together
- enough content for an equal presentation share

---

## 9. Suggested Speaking Order for 3 People

If the team wants a smooth and balanced delivery, the best speaking order is the real product lifecycle.

### Person 1 opens with the pre-booking stage

Should speak first about:

- project problem and vision
- user onboarding
- login and verification
- hotel discovery
- search, suggestions, filters, and recommendations
- hotel details, reviews, maps, and wishlist

### Person 2 continues with the booking stage

Should then explain:

- availability and room selection
- booking form and guest details
- timings for one-day stays
- pricing and coupons
- Razorpay payment flow
- confirmation, receipt, dashboard, cancellation, and support

### Person 3 closes with operations and reliability

Should finish with:

- admin dashboard and operational modules
- refund handling from admin side
- reports, offers, and community features
- runtime infrastructure such as Redis, MySQL mirror, and sockets
- testing, Docker, CI/CD, and future scope

### Recommended Time Split for a 9-12 Minute Presentation

- Person 1: 3 to 4 minutes
- Person 2: 3 to 4 minutes
- Person 3: 3 to 4 minutes

---

## 10. Repository Root Structure

## Root-Level Folders and Files

### `.github/`

Contains GitHub Actions workflows for CI/CD.

### `.gitignore`

Specifies files and folders Git should ignore.

### `MySQL`

Legacy or placeholder MySQL-related path at the repository root.

### `README.md`

Main project readme with setup, features, testing, and Docker instructions.

### `backend/`

Node.js + Express backend application.

### `frontend/`

React + Vite frontend application.

### `e2e/`

Playwright end-to-end testing project.

### `load-tests/`

k6 performance and stress testing scripts.

### `tests/`

Testing index and conceptual reference material.

### `docker-compose.yml`

Main Docker Compose file for local multi-service setup.

### `docker-compose.prod.yml`

Production-oriented compose variant.

---

## 11. Detailed File and Folder Map

This section gives a folder-by-folder and file-by-file explanation.

---

## A. GitHub Workflows

### `.github/workflows/ci.yml`

Main continuous integration workflow for:

- linting
- frontend build
- backend unit tests
- backend integration tests
- security tests
- UI tests
- coverage reporting

### `.github/workflows/e2e.yml`

Dedicated Playwright workflow that can be run manually or after CD succeeds.

### `.github/workflows/cd.yml`

Continuous deployment workflow for:

- building Docker images
- pushing to AWS ECR
- Kubernetes deployment
- smoke testing

---

## B. Backend Top Level

### `backend/.dockerignore`

Defines backend files excluded from Docker build context.

### `backend/.env`

Local backend environment variables for development.

### `backend/.env.example`

Template backend environment variables for setup guidance.

### `backend/Dockerfile`

Build instructions for backend container image.

### `backend/MySQL`

Legacy or support path related to MySQL at backend level.

### `backend/package.json`

Backend metadata, scripts, and dependency definitions.

### `backend/package-lock.json`

Exact dependency lockfile for backend.

### `backend/runtime/`

Runtime support directory.

### `backend/runtime/email-audit.log`

Audit or trace log for email-related activity.

---

## C. Backend Source Code

## `backend/src/app.js`

Creates and configures the Express app with:

- security middleware
- body parsers
- CORS
- API routes
- health endpoint
- 404 handling
- error handling

## `backend/src/server.js`

Starts the HTTP server and initializes:

- MongoDB connection
- Sequelize connection
- Redis connection
- Socket.IO
- role migration
- cron jobs

---

## C1. Backend Config

### `backend/src/config/cloudinary.js`

Cloudinary configuration for media handling.

### `backend/src/config/db.js`

MongoDB connection logic.

### `backend/src/config/email.js`

Email transporter configuration.

### `backend/src/config/razorpay.js`

Razorpay client configuration.

### `backend/src/config/redis.js`

Redis client setup and connection logic.

### `backend/src/config/sequelize.js`

Sequelize setup for MySQL and SQL model registration.

---

## C2. Backend Controllers

### `backend/src/controllers/adminController.js`

Admin APIs for managing users, hotels, reviews, and related admin operations.

### `backend/src/controllers/authController.js`

Handles registration, login, OTP verification, logout, profile update, password reset, and Google OAuth flow.

### `backend/src/controllers/bookingController.js`

Handles booking creation, retrieval, cancellation, hold logic, and booking state transitions.

### `backend/src/controllers/couponController.js`

Manages coupon and offer logic.

### `backend/src/controllers/hotelController.js`

Handles hotel listing, search, filters, featured hotels, suggestions, hotel detail, and availability.

### `backend/src/controllers/notificationController.js`

Handles user notification APIs.

### `backend/src/controllers/ownerController.js`

Supports admin or owner-style reports and community workflows.

### `backend/src/controllers/paymentController.js`

Handles Razorpay order creation, payment verification, webhook logic, failed payment handling, and refunds.

### `backend/src/controllers/reviewController.js`

Handles hotel reviews, ratings, and review responses/statistics.

### `backend/src/controllers/subscriptionController.js`

Handles newsletter or subscription-related endpoints.

### `backend/src/controllers/supportController.js`

Handles support conversations, support replies, and support workflow APIs.

### `backend/src/controllers/userController.js`

Handles user profile retrieval and related user data APIs.

### `backend/src/controllers/wishlistController.js`

Handles adding/removing hotels from wishlist and retrieving wishlist data.

---

## C3. Backend Jobs

### `backend/src/jobs/cleanupJob.js`

Scheduled cleanup logic, likely used for stale data or expired booking holds.

### `backend/src/jobs/emailJob.js`

Scheduled email processing logic.

---

## C4. Backend Middleware

### `backend/src/middleware/admin.js`

Admin-only route protection.

### `backend/src/middleware/auth.js`

JWT authentication middleware.

### `backend/src/middleware/errorHandler.js`

Centralized API error formatting and response logic.

### `backend/src/middleware/logger.js`

Request logging helper middleware.

### `backend/src/middleware/rateLimiter.js`

Global and route-level rate limiting configuration.

### `backend/src/middleware/roles.js`

Role-based authorization helpers and checks.

### `backend/src/middleware/upload.js`

Upload handling middleware, typically for images or files.

### `backend/src/middleware/validate.js`

Runs request validation result checks after express-validator rules.

---

## C5. Backend Mongo Models

### `backend/src/models/Booking.js`

Mongo booking schema with guest details, payment details, refund tracking, and booking lifecycle fields.

### `backend/src/models/Coupon.js`

Coupon and promotional offer schema.

### `backend/src/models/Hotel.js`

Hotel schema with metadata, amenities, policies, and address information.

### `backend/src/models/NewsletterSubscriber.js`

Schema for newsletter subscriber records.

### `backend/src/models/Notification.js`

Schema for user notifications.

### `backend/src/models/OwnerCommunityThread.js`

Schema for community or admin discussion threads.

### `backend/src/models/Payment.js`

Schema for payment records and refund state.

### `backend/src/models/Review.js`

Schema for hotel reviews and category scores.

### `backend/src/models/Room.js`

Room schema with pricing, capacity, amenities, and media.

### `backend/src/models/RoomInventory.js`

Inventory tracking model for rooms across dates and availability windows.

### `backend/src/models/SupportConversation.js`

Schema for user-admin support conversations.

### `backend/src/models/User.js`

User schema including auth, role, contact data, and verification fields.

### `backend/src/models/Wishlist.js`

Schema for saved hotels per user.

---

## C6. Backend SQL Models

### `backend/src/models/sql/index.js`

Exports or registers SQL models for Sequelize.

### `backend/src/models/sql/Booking.js`

SQL mirror model for bookings.

### `backend/src/models/sql/Coupon.js`

SQL mirror model for coupons.

### `backend/src/models/sql/Hotel.js`

SQL mirror model for hotels.

### `backend/src/models/sql/Notification.js`

SQL mirror model for notifications.

### `backend/src/models/sql/Payment.js`

SQL mirror model for payments.

### `backend/src/models/sql/Review.js`

SQL mirror model for reviews.

### `backend/src/models/sql/Room.js`

SQL mirror model for rooms.

### `backend/src/models/sql/User.js`

SQL mirror model for users.

---

## C7. Backend Routes

### `backend/src/routes/adminRoutes.js`

Exposes admin APIs.

### `backend/src/routes/authRoutes.js`

Exposes auth APIs such as register, login, OTP, me, logout, update profile, and password management.

### `backend/src/routes/bookingRoutes.js`

Exposes booking APIs.

### `backend/src/routes/couponRoutes.js`

Exposes coupon and offer APIs.

### `backend/src/routes/hotelRoutes.js`

Exposes hotel listing, detail, availability, featured, destination, and suggestion APIs.

### `backend/src/routes/notificationRoutes.js`

Exposes notification APIs.

### `backend/src/routes/ownerRoutes.js`

Exposes reporting and community-related APIs.

### `backend/src/routes/paymentRoutes.js`

Exposes Razorpay and refund APIs.

### `backend/src/routes/reviewRoutes.js`

Exposes review APIs.

### `backend/src/routes/subscriptionRoutes.js`

Exposes subscription APIs.

### `backend/src/routes/supportRoutes.js`

Exposes support conversation APIs.

### `backend/src/routes/userRoutes.js`

Exposes user profile APIs.

### `backend/src/routes/wishlistRoutes.js`

Exposes wishlist APIs.

---

## C8. Backend Services

### `backend/src/services/assistantService.js`

Service layer for assistant-style or recommendation support features.

### `backend/src/services/availabilityService.js`

Calculates room availability for hotel and room queries.

### `backend/src/services/bookingLifecycleService.js`

Manages booking hold, confirmation, expiry, and release behavior.

### `backend/src/services/distributedLockService.js`

Implements Redis-backed locking to reduce race conditions in booking flows.

### `backend/src/services/emailService.js`

Sends transactional emails for booking, refund, password, and other events.

### `backend/src/services/notificationService.js`

Creates and manages notification records or dispatch logic.

### `backend/src/services/paymentService.js`

Wrapper logic for Razorpay order creation, verification, refunds, and payment record handling.

### `backend/src/services/pricingService.js`

Computes pricing totals, taxes, dynamic pricing, and fee calculations.

### `backend/src/services/recommendationService.js`

Produces hotel recommendation data for the frontend.

### `backend/src/services/refundPolicyService.js`

Calculates refund percentages and refund decisions according to cancellation policy.

### `backend/src/services/sqlMirrorService.js`

Synchronizes Mongo domain records into MySQL SQL models.

---

## C9. Backend Socket Layer

### `backend/src/socket/socketHandler.js`

Initializes Socket.IO and emits hotel availability or catalog update events.

---

## C10. Backend Utilities

### `backend/src/utils/ApiError.js`

Custom API error class.

### `backend/src/utils/ApiResponse.js`

Standardized API response helper.

### `backend/src/utils/asyncHandler.js`

Wrapper for async controllers to avoid repetitive try/catch blocks.

### `backend/src/utils/generateToken.js`

JWT generation helper.

### `backend/src/utils/massiveSeeder.js`

Large-scale seeding helper or data generation utility.

### `backend/src/utils/offerUtils.js`

Offer-attachment helpers for hotels and booking views.

### `backend/src/utils/roleMigration.js`

Migrates or normalizes legacy role values.

### `backend/src/utils/seedData.js`

Seeds MongoDB with sample project data.

### `backend/src/utils/seedSqlFromMongo.js`

Copies or mirrors current Mongo data into MySQL.

### `backend/src/utils/syncSqlSchema.js`

Synchronizes SQL schema through Sequelize.

### `backend/src/utils/validators.js`

Shared backend validation rules and request validators.

---

## D. Backend Tests

## `backend/tests/setup.js`

Global test environment setup for backend test suites.

## `backend/tests/dbSetup.js`

In-memory MongoDB setup for integration and security tests.

## Integration Tests

### `backend/tests/integration/auth.api.test.js`

Tests registration, login, OTP, auth-protected user access, and logout behavior.

### `backend/tests/integration/bookings.api.test.js`

Tests booking creation, auth checks, validation, and user booking retrieval.

### `backend/tests/integration/hotels.api.test.js`

Tests hotel listing, filters, detail access, featured hotels, and protected hotel creation.

### `backend/tests/integration/payments.api.test.js`

Tests webhook and payment-related API behavior.

## Security Tests

### `backend/tests/security/owasp.test.js`

Tests access control, bcrypt hashing, injection hardening, headers, JWT validation, and health endpoint behavior.

## Unit Tests

### `backend/tests/unit/controllers/authController.test.js`

Unit tests for auth controller logic.

### `backend/tests/unit/controllers/bookingController.test.js`

Unit tests for booking controller logic.

### `backend/tests/unit/controllers/hotelController.test.js`

Unit tests for hotel controller logic.

### `backend/tests/unit/middleware/auth.test.js`

Unit tests for JWT auth middleware.

### `backend/tests/unit/services/pricingService.test.js`

Unit tests for pricing logic.

### `backend/tests/unit/services/refundPolicyService.test.js`

Unit tests for refund policy calculations.

### `backend/tests/unit/utils/ApiError.test.js`

Unit tests for custom API error handling.

### `backend/tests/unit/utils/__snapshots__/ApiError.test.js.snap`

Snapshot file for `ApiError` unit test expectations.

---

## E. Frontend Top Level

### `frontend/.dockerignore`

Frontend Docker build ignore rules.

### `frontend/.env`

Local frontend environment variables.

### `frontend/.env.example`

Template frontend environment variables.

### `frontend/Dockerfile`

Frontend container build definition.

### `frontend/build_error.txt`

Troubleshooting artifact related to previous frontend build issues.

### `frontend/index.html`

Main Vite HTML entry.

### `frontend/nginx.conf`

Nginx configuration for serving the built frontend.

### `frontend/package.json`

Frontend metadata, scripts, and dependencies.

### `frontend/package-lock.json`

Exact dependency lockfile for frontend.

### `frontend/public/`

Public static asset directory.

### `frontend/src/`

Main frontend application source.

### `frontend/vite.config.js`

Vite configuration.

---

## F. Frontend Source Code

## `frontend/src/main.jsx`

Frontend entry point that renders the React app.

## `frontend/src/App.jsx`

Top-level route map, shared layout, lazy loading, protected routes, and dashboard routing.

---

## F1. Frontend API Layer

### `frontend/src/api/adminApi.js`

Admin-related API calls.

### `frontend/src/api/authApi.js`

Authentication API calls.

### `frontend/src/api/axiosInstance.js`

Configured Axios client with base URL and shared request behavior.

### `frontend/src/api/bookingApi.js`

Booking API calls.

### `frontend/src/api/couponApi.js`

Coupon and offer API calls.

### `frontend/src/api/hotelApi.js`

Hotel listing, detail, suggestions, availability, and recommendation API calls.

### `frontend/src/api/ownerApi.js`

Admin or owner-style report/community API calls.

### `frontend/src/api/paymentApi.js`

Razorpay order, verification, failure, and refund API calls.

### `frontend/src/api/reviewApi.js`

Review API calls.

### `frontend/src/api/subscriptionApi.js`

Subscription API calls.

### `frontend/src/api/supportApi.js`

Support conversation API calls.

### `frontend/src/api/userApi.js`

User API calls.

---

## F2. Frontend Contexts

### `frontend/src/context/SocketContext.jsx`

Provides socket connection access across the app.

### `frontend/src/context/ThemeContext.jsx`

Provides light/dark theme state handling.

---

## F3. Frontend Hooks

### `frontend/src/hooks/useAuth.js`

Small hook for reading auth state.

### `frontend/src/hooks/useDebounce.js`

Used for delayed search/filter actions.

### `frontend/src/hooks/useInfiniteScroll.js`

Reusable hook for scroll-based loading patterns.

### `frontend/src/hooks/useLocalStorage.js`

Reusable persistent local storage hook.

### `frontend/src/hooks/useMediaQuery.js`

Responsive media query hook.

### `frontend/src/hooks/useOutsideClick.js`

Handles click-outside behavior for popovers and menus.

---

## F4. Frontend Common Components

### `frontend/src/components/common/ConfirmDialog/ConfirmDialog.jsx`

Reusable confirmation modal component.

### `frontend/src/components/common/ConfirmDialog/ConfirmDialog.module.css`

Styles for confirmation modal.

### `frontend/src/components/common/Footer/Footer.jsx`

Global page footer.

### `frontend/src/components/common/Footer/Footer.module.css`

Footer styles.

### `frontend/src/components/common/Loader/Loader.jsx`

Reusable loading indicator.

### `frontend/src/components/common/Loader/Loader.module.css`

Loader styles.

### `frontend/src/components/common/Navbar/Navbar.jsx`

Global navigation bar that adapts between guest/user/admin states.

### `frontend/src/components/common/Navbar/Navbar.module.css`

Navbar styles.

### `frontend/src/components/common/ProtectedRoute/ProtectedRoute.jsx`

Route guard for auth and role-based access.

### `frontend/src/components/common/ScrollToTop/ScrollToTop.jsx`

Ensures scroll reset on route change.

---

## F5. Frontend Pages

### `frontend/src/pages/AboutPage.jsx`

About page for the platform.

### `frontend/src/pages/AdminBookingsPage.jsx`

Admin booking management page with status updates and refund dialog.

### `frontend/src/pages/AdminDashboardPage.jsx`

Admin landing page with summary metrics and navigation context.

### `frontend/src/pages/AdminHotelsPage.jsx`

Admin hotel management interface.

### `frontend/src/pages/AdminReviewsPage.jsx`

Admin review monitoring and management interface.

### `frontend/src/pages/AdminUsersPage.jsx`

Admin user management interface.

### `frontend/src/pages/AdminWorkspace.module.css`

Shared admin workspace styling used by admin pages.

### `frontend/src/pages/AuthPage.module.css`

Shared auth page styles.

### `frontend/src/pages/BookingConfirmationPage.jsx`

Final booking summary page after successful booking.

### `frontend/src/pages/BookingConfirmationPage.module.css`

Styles for booking confirmation page.

### `frontend/src/pages/BookingPage.jsx`

Booking form, pricing summary, offer selection, and payment handoff page.

### `frontend/src/pages/BookingPage.module.css`

Styles for booking page.

### `frontend/src/pages/ForgotPasswordPage.jsx`

Forgot password request page.

### `frontend/src/pages/GoogleAuthCallbackPage.jsx`

Handles Google login callback response and redirects.

### `frontend/src/pages/HomePage.jsx`

Landing page with hero search, featured sections, destinations, and recommendation-oriented messaging.

### `frontend/src/pages/HomePage.module.css`

Styles for home page.

### `frontend/src/pages/HotelDetailsPage.jsx`

Hotel detail page with gallery, rooms, reviews, map, offers, and booking sidebar.

### `frontend/src/pages/HotelDetailsPage.module.css`

Styles for hotel details page.

### `frontend/src/pages/HotelListingPage.jsx`

Hotel search and listing page with filtering, pagination, and debounced suggestions.

### `frontend/src/pages/HotelListingPage.module.css`

Styles for hotel listing page.

### `frontend/src/pages/InfoPage.jsx`

Reusable informational page renderer for static sections such as FAQ, privacy, help center, and terms.

### `frontend/src/pages/InfoPage.module.css`

Styles for info pages.

### `frontend/src/pages/LoginPage.jsx`

User login page.

### `frontend/src/pages/NotFoundPage.jsx`

404 fallback page.

### `frontend/src/pages/OffersManagementPage.jsx`

Admin page for creating and managing offers.

### `frontend/src/pages/OtpVerificationPage.jsx`

OTP verification page used in email verification flow.

### `frontend/src/pages/OwnerCommunityPage.jsx`

Admin or owner-style collaboration/community discussion page.

### `frontend/src/pages/OwnerCommunityPage.module.css`

Styles for community page.

### `frontend/src/pages/OwnerDashboardPage.jsx`

Owner-focused dashboard page or earlier admin-owner style view.

### `frontend/src/pages/OwnerReportsPage.jsx`

Reporting and analytics page for booking/revenue metrics.

### `frontend/src/pages/OwnerReportsPage.module.css`

Styles for reports page.

### `frontend/src/pages/RegisterPage.jsx`

Registration page with phone validation and user account creation flow.

### `frontend/src/pages/ResetPasswordPage.jsx`

Reset password page.

### `frontend/src/pages/SupportCenterPage.jsx`

Support interface for messages and support-related workflows.

### `frontend/src/pages/SupportCenterPage.module.css`

Styles for support center.

### `frontend/src/pages/UserDashboardPage.jsx`

User dashboard containing booking history, cancellation, and profile update functionality.

### `frontend/src/pages/WishlistPage.jsx`

Displays saved hotels for the user.

---

## F6. Frontend Redux

### `frontend/src/redux/store.js`

Configures the Redux store for the frontend.

### `frontend/src/redux/slices/adminSlice.js`

Admin state logic.

### `frontend/src/redux/slices/authSlice.js`

Authentication state, session persistence, and profile update handling.

### `frontend/src/redux/slices/bookingSlice.js`

Booking-related frontend state and async actions.

### `frontend/src/redux/slices/hotelSlice.js`

Hotel listing, selected hotel, filters, pagination, and availability state.

### `frontend/src/redux/slices/reviewSlice.js`

Review state and review-fetching actions.

### `frontend/src/redux/slices/uiSlice.js`

General UI state helpers.

### `frontend/src/redux/slices/wishlistSlice.js`

Wishlist state and toggle behavior.

---

## F7. Frontend Styles

### `frontend/src/styles/animations.css`

Shared animation definitions.

### `frontend/src/styles/global.css`

Global application styles.

### `frontend/src/styles/reset.css`

CSS reset/base normalization.

### `frontend/src/styles/variables.css`

Theme tokens and reusable CSS variables.

---

## F8. Frontend Utilities

### `frontend/src/utils/bookingReceiptPdf.js`

Generates or prepares printable/downloadable booking receipt PDF content.

### `frontend/src/utils/constants.js`

Shared constants such as roles, labels, colors, property types, and environment-backed values.

### `frontend/src/utils/dateUtils.js`

Date calculations for nights, validation, minimum checkout, and formatting helpers.

### `frontend/src/utils/formatters.js`

Currency, date, time, and display formatting helpers.

### `frontend/src/utils/helpers.js`

General helper functions such as image URL resolution.

### `frontend/src/utils/razorpayCheckout.js`

Frontend Razorpay script loading and checkout trigger helpers.

### `frontend/src/utils/routeHelpers.js`

Role-aware route utility helpers.

### `frontend/src/utils/validators.js`

Client-side validation helpers for auth, phone, booking fields, and profile forms.

---

## G. E2E Test Project

### `e2e/package.json`

Playwright test project scripts and dependency definition.

### `e2e/package-lock.json`

Dependency lockfile for Playwright test project.

### `e2e/playwright.config.js`

Playwright configuration for browser, base URL, and runtime behavior.

### `e2e/mock-backend.js`

Mock backend used to stabilize UI testing in CI.

### `e2e/tests/auth.spec.js`

End-to-end auth flow tests.

### `e2e/tests/booking.spec.js`

End-to-end booking flow tests.

### `e2e/tests/capstone.spec.js`

Capstone coverage suite used in CI for broad user flow validation.

### `e2e/tests/hotels.spec.js`

End-to-end hotel search and hotel detail tests.

---

## H. Load Testing

### `load-tests/k6-config.js`

k6 performance test configuration.

### `load-tests/stress-test.js`

Stress-testing script for pushing the system harder under load.

---

## I. Testing Documentation and Python Reference

### `tests/README.md`

Explains how to run backend tests, UI tests, load tests, and what each suite covers.

### `tests/pytest/conftest.py`

Conceptual pytest fixture examples for cross-language documentation/reference.

### `tests/pytest/test_booking_service.py`

Conceptual pytest test example for documenting service testing approach.

---

## 12. Docker and Deployment Explanation

## Local Docker Architecture

`docker-compose.yml` runs:

- `mongodb`
- `mysql`
- `redis`
- `backend`
- `frontend`

### Why this matters

This is useful in presentation because it proves the project can run like a real multi-service application and not just as two isolated folders.

## Backend Container

The backend container:

- exposes API on port 5000
- connects to MongoDB, MySQL, and Redis
- uses environment variables for auth, email, and payment integrations

## Frontend Container

The frontend container:

- builds with Vite
- is served by Nginx
- points API calls to the backend URL

## CD Readiness

The repository already includes workflows for:

- Docker image build
- ECR push
- Kubernetes deployment
- smoke tests

This is a strong point to mention because it shows industry-style readiness.

---

## 13. Testing Strategy Explanation

The project includes four levels of testing:

### 1. Unit Tests

Test isolated logic such as:

- controller behavior
- middleware behavior
- pricing
- refund calculation

### 2. Integration Tests

Test complete backend routes with request/response lifecycle:

- auth
- hotels
- bookings
- payments

### 3. Security Tests

Test platform hardening:

- access control
- JWT rejection
- password hashing
- input validation
- security headers

### 4. UI / E2E Tests

Use Playwright to validate:

- auth flows
- hotel flows
- booking flows
- capstone user scenarios

### 5. Load Tests

Use k6 to evaluate:

- concurrent traffic handling
- stability under stress

---

## 14. Strong Technical Discussion Points for Viva or Q&A

If examiners or reviewers ask deeper questions, these are strong answers to prepare:

### Why use both MongoDB and MySQL?

MongoDB is ideal for flexible application data such as hotel structures, bookings, reviews, and conversations, while MySQL is useful for structured reporting and relational analysis. This project mirrors selected data into SQL to demonstrate hybrid persistence and reporting readiness.

### Why use Redis?

Redis helps control concurrency in booking flows by supporting distributed locks. This reduces the risk of double booking or inventory race conditions.

### Why use Socket.IO?

Socket.IO allows room availability and hotel updates to be reflected in near real time, which improves user trust and admin responsiveness.

### Why is testing split into multiple layers?

Because each layer catches different kinds of problems:

- unit tests catch logic bugs
- integration tests catch API issues
- security tests catch protection failures
- UI tests catch user-facing regressions

### Why is CI/CD important?

CI/CD ensures that linting, builds, tests, and deployment checks run automatically, which improves reliability and reduces manual mistakes.

---

## 15. Demo Plan for Live Presentation

If you want to demo the product live, use this order:

1. Open home page.
2. Show hotel search.
3. Open hotel listing.
4. Open one hotel detail page.
5. Show reviews, map, and room availability.
6. Continue to booking page.
7. Explain pricing and timing fields.
8. Show user dashboard and booking history.
9. Log in as admin.
10. Show admin navbar and admin dashboard.
11. Open admin bookings and explain refund flow.
12. Mention tests, Docker, and CI/CD at the end.

---

## 16. Suggested Slide Ownership by 3 People

### Person 1 Slides

- Slide 1: title, problem, and project vision
- Slide 2: onboarding, registration, login, OTP, and recovery flows
- Slide 3: hotel discovery, search, filters, suggestions, and recommendations
- Slide 4: hotel details, reviews, maps, and wishlist

### Person 2 Slides

- Slide 5: room availability and booking creation
- Slide 6: pricing, coupons, and one-day timing support
- Slide 7: Razorpay payment, verification, and confirmation flow
- Slide 8: user dashboard, profile update, cancellation, refund visibility, and support

### Person 3 Slides

- Slide 9: admin dashboard, hotels, users, bookings, and refunds
- Slide 10: reviews, offers, community, reports, and runtime architecture
- Slide 11: testing, Docker, and CI/CD
- Slide 12: conclusion, learnings, and future scope

---

## 17. Suggested Future Enhancements

These are good closing points in a presentation:

- real inventory calendars for each room
- full review moderation workflows
- stronger analytics dashboards
- user-side chat support notifications
- role separation for admin vs owner
- advanced recommendation engine
- cloud deployment with monitoring dashboards
- payment provider abstraction beyond Razorpay

---

## 18. Final Team Delivery Advice

To present this project well:

- Person 1 should focus on how the platform helps users enter, explore, and trust the system.
- Person 2 should focus on how the platform converts interest into successful reservations and manages the guest journey.
- Person 3 should focus on how the platform is operated, validated, and delivered reliably.

If the team follows this document, you can confidently explain:

- what the system does
- how the system is built
- why the technical choices make sense
- how the project is tested and deployed
- how the team collaborated across the whole codebase

---

## 19. Quick Summary in One Paragraph

Sigmora is a full-stack hotel booking platform built with React, Express, MongoDB, MySQL, Redis, Socket.IO, Razorpay, Docker, and GitHub Actions. It supports user authentication, hotel discovery, live availability, booking and payment flows, reviews, user dashboard features, admin management, refunds, testing at multiple levels, and deployment automation. The repository is structured clearly across frontend, backend, testing, and DevOps layers, making it strong both as a capstone implementation and as a presentation-ready engineering project.
