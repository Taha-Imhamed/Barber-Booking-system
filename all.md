# Istanbul Salon - Barber Booking System

## Project Overview
This project is a full-stack barber shop management and appointment platform for **clients, barbers, and admins**.  
It supports booking, schedule management, notifications, analytics, finance, group communication, and developer monitoring in one system.

The goal is to make salon operations fast, trackable, and easy to manage from a single dashboard.

## Main Roles
- **Admin**
  - Full operational control (appointments, barbers, services, reports, finance, settings, users, developer tools)
- **Barber**
  - Manage assigned appointments and availability
- **Client / Guest**
  - Book appointments (registered users or guest users)
  - Receive booking updates and notifications

## Core Features

### 1. Authentication & Accounts
- Local login/register for users
- Google login support for clients
- Session-based authentication
- Email verification flow for client accounts
- Role-based access control (`admin`, `barber`, `client`)

### 2. Appointment Management
- Create appointments by:
  - Registered clients
  - Guests (name + phone/email)
- Appointment statuses:
  - `pending`, `accepted`, `rejected`, `postponed`, `completed`
- Postpone proposal flow with customer response
- Soft-delete support for appointment records
- Admin bulk delete for completed/history entries

### 3. Barber & Branch Management
- Add/edit/delete barber accounts
- Assign barbers to branches
- Availability control:
  - Global availability toggle
  - Unavailable hours
- Conflict prevention for booking overlaps

### 4. Services Management
- Create and update services
- Configure:
  - Service name
  - Price
  - Duration

### 5. Guest Booking Support
- Guest users can reserve without creating an account
- Guest reservation tracking by phone number
- Guest notifications for status updates

### 6. Payments (Paysera Test Integration)
- Optional advance payment flow
- `cash_on_arrival` and `paysera_test` payment methods
- Payment state tracking:
  - `unpaid`, `pending`, `paid`, `failed`
- Payment reference and prepaid amount stored per appointment

### 7. Notifications & Messaging
- In-app notifications for registered users
- Guest notifications table and read state
- Admin-to-client messaging (email/SMS channels)
- Notification read and mark-all-read support

### 8. Email Delivery System
- Multi-provider email strategy with diagnostics:
  - **Brevo**
  - **Resend**
  - **EmailJS** (including `VITE_` env fallback)
- Startup notifier diagnostics logs
- Better error logging for failed email sends

### 9. Finance & Earnings
- Earnings summary endpoint and dashboard
- Daily totals by:
  - Barber
  - Branch
- Expense management:
  - Add/edit/delete expenses
- Profit, expense, and net profit visibility

### 10. Reports & Exports
- CSV export from admin sections (appointments/users/etc.)
- Group chat context export to Excel
- Developer snapshot export to JSON

### 11. Group Chat (Operational Communication)
- Create groups
- Add/remove group members
- Send group messages
- Group totals and numeric tracking support
- Group deletion with history cleanup

### 12. Wall Display / Public Display Controls
- Public settings endpoint for display mode
- Controls for:
  - Background image
  - Notification sound
  - Weather/music toggle
  - Queue limit

## Admin Advanced Features Added

### Users Tab
- New admin section to inspect users with filters:
  - all / barbers / clients
- Shows:
  - Username
  - Password hash (not plaintext)
  - Role, provider, contact data, verification, reservation count

### Developer Tab
- Password-protected access (`memo`)
- Advanced monitoring snapshot including:
  - Security score
  - Vulnerability flags
  - Login/auth history
  - API call history
  - Reservation + payment history
  - Route inventory
  - Host/domain/network/database status
- Export all developer data as JSON
- Search and auto-refresh support
- Dark dashboard style for developer view

## Security Notes
- Existing passwords are securely hashed (bcrypt); plaintext is not recoverable.
- Session secret must be configured in production.
- Developer monitor flags basic runtime security risks (missing secrets, DB health, etc.).
- Role checks are enforced on admin-only endpoints.

## Technical Structure (High-Level)
- **Client:** React-based admin/client interfaces
- **Server:** Express API routes with role-aware business logic
- **Database:** PostgreSQL via Drizzle ORM schema/tables
- **Shared:** Shared route contracts/types (`shared/routes.ts`, `shared/schema.ts`)

## Summary
This system is not just a booking form; it is a complete salon operations platform with:
- Booking + customer communication
- Staff and service management
- Payments and finance analytics
- Real-time operations tooling
- Developer-grade monitoring and export capability

