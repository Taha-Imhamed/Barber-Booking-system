# Barber Booking System - Current Feature Plan

## Core Roles
- Admin
- Barber (worker)
- Client
- Guest booking (without account)

## Authentication
- Username/password login for admin and barbers
- Username/password login/register for clients
- Google sign-in for clients only
- Email verification flow for client local signup

## Booking and Queue
- Multi-step reservation form
- Branch -> Service -> Barber -> Date/Time -> Client info
- Pending/accepted/rejected/postponed/completed statuses
- Priority handling for registered clients
- Loyalty points for completed appointments

## Availability and Scheduling
- Barber availability ON/OFF toggle from barber dashboard
- Barber unavailable-hours selection (hour slots)
- Hidden from customer list when barber availability is OFF
- Reservation blocked if selected hour is in barber unavailable hours
- Double-booking protection: if a barber already has an accepted appointment in a slot, that slot cannot be booked again
- Admin timetable view and timetable graph
- Barber full timetable and upcoming appointments with remaining time
- Postpone flow with exact date/time (including minutes), proposed to client/guest for accept or decline

## Notifications
- In-app notifications
- Notification sound on new events
- Mark one/read all notification support
- Optional email/SMS delivery integration for appointment updates
- Guest notifications by phone for postponed and status updates

## Messaging
- Admin can open appointment details and see contact info
- Admin can send a message to appointment customer
- Delivery channels:
  - In-app (for registered clients)
  - Email/SMS when provider is configured
- Admin messages are logged

## Barber Profile
- Barber can upload profile photo from device in barber dashboard
- Uploaded photo appears on landing page barber cards
- Client can click barber photo and confirm Yes/No to start booking with that barber preselected

## Branches and Services
- Branch management (admin)
- Services management (admin)
- Barbers grouped under branches on landing page

## Dashboards
- Admin dashboard:
  - Appointments queue and history
  - Barbers and branches management
  - Services management
  - Reports
  - Timetable
- Barber dashboard:
  - Pending requests
  - Accepted list
  - Upcoming list with time-left countdown
  - Completion actions
  - Complete appointment auto-saves income based on service price
  - Optional tip input on completion
  - Daily barber total and branch total earnings cards
  - Availability control
  - Photo upload
- Client account page (profile/loyalty/appointments view depending on current implementation)

## Display and UI
- Public wall display page
- Mobile responsive layout improvements for booking and dashboard tables
- English/Turkish language toggle
- Barber pole loading visual

## Technical Notes
- Runtime schema guard creates missing auth/availability/message columns/tables on server startup
- Runtime schema guard also creates postpone proposal, earnings, and guest-notification structures
- Database schema includes:
  - user auth/provider/verification fields
  - barber availability fields
  - email verification tokens table
  - admin messages table
