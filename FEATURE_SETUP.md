# Barber Booking System - Feature Setup & Run Guide

This project now includes:
- Timetable menu + dedicated admin timetable tab
- Branches shown separately with assigned barbers
- Notification sound reliability fix
- Google sign-in
- Email verification for local sign-up
- Admin contact messaging (email + SMS + in-app)
- Barber photo upload from device and photo cards on landing page
- Click barber photo -> Yes/No confirmation -> start reservation with that barber
- English/Turkish language switch
- Capability animation block + barber-pole loading animation

## 1. Install and run

```bash
npm install
npm run db:push
npm run dev
```

App default URL: `http://localhost:5000`

## 2. Required environment variables

Add these in `.env`:

```env
DATABASE_URL=postgres://...
SESSION_SECRET=replace_me
APP_BASE_URL=http://localhost:5000
```

## 3. Google sign-in setup

In Google Cloud Console:
1. Create OAuth 2.0 Web Client.
2. Add redirect URI:
   - `http://localhost:5000/api/auth/google/callback`
3. Put credentials in `.env`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
# optional override:
# GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
```

## 4. Email verification + email notifications

Local sign-up now creates unverified accounts and sends a verification link.

Choose one provider:

### Option A: Brevo (free tier)
```env
BREVO_API_KEY=...
BREVO_SENDER_EMAIL=verified-sender@yourdomain.com
BREVO_SENDER_NAME=Barber Booking
```

### Option B: Resend (free tier)
```env
RESEND_API_KEY=...
RESEND_SENDER_EMAIL=Barber Booking <onboarding@resend.dev>
```

If no provider is set, emails are logged to server console.

## 5. SMS notifications (free-friendly)

Use Textbelt:

```env
TEXTBELT_API_KEY=textbelt
```

- `textbelt` key gives 1 free SMS/day.
- For higher volume, replace with a paid key.
- If not set, SMS is logged to server console.

## 6. Where to use each feature in UI

- Timetable menu: top navbar -> `Timetable`
- Branch separation: landing page -> `Branches`
- Google sign-in: `/auth` page -> `Continue with Google`
- Email verification resend: `/auth` page in register mode
- Admin full appointment control + contact: `/admin` -> `Appointments` -> `Contact`
- Admin timetable: `/admin` -> `Timetable`
- Barber photo upload: `/barber` header section file input
- Landing barber photo reserve flow: click barber photo -> confirm dialog -> reservation form preselects barber
- Language switch: navbar language dropdown (`English` / `Turkish`)

## 7. Notes about free plans (checked March 3, 2026)

- Brevo free plan: 300 emails/day (no rollover)
- Resend free plan: 100 emails/day and 3,000/month
- Textbelt free key (`textbelt`): 1 free SMS/day

Official references:
- https://help.brevo.com/hc/en-us/articles/360022153079-FAQs-Are-there-any-sending-limits-emails-and-SMS
- https://resend.com/pricing
- https://resend.com/docs/knowledge-base/account-quotas-and-limits
- https://textbelt.com/

## 8. Database update reminder

Because schema changed (email verification + admin messages + auth fields), run:

```bash
npm run db:push
```

before starting the app.

