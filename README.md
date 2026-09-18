# UA LIVES MATTER

Android civilian-safety and community app for Ukraine.

## v0.4
- Required email/password account system with Supabase Auth
- Community feed with photo/video posts
- 24-hour Stories
- Instagram-inspired clean interface with Tinder-style swipe gestures
- OpenStreetMap + Leaflet safety map
- Community safety alerts with confirmation/rejection
- Electricity, heating and water outage alerts
- Nearby alert notifications while the app is open, plus background checks
- General and regional realtime chat
- Kyiv shelter layer + nearby OpenStreetMap shelters
- Public transport/station layer
- Editable per-user 72-hour emergency checklist
- SOS and emergency numbers
- Ukrainian, Russian and English UI
- Regional app lock when Android geolocation resolves the device country as RU
- GitHub Actions APK build on every push

## Backend
Supabase project: `UALIVESMATTER`

The backend contains:
- profiles
- posts
- stories
- post likes
- realtime chat
- community alerts and votes
- verified utility incidents
- per-user editable checklists
- public social-media storage bucket

SQL migrations live under `backend/`.

## Notifications
Foreground notifications are triggered instantly by Supabase Realtime when a new community or utility alert is within the configured radius.

Android WorkManager also checks for nearby alerts periodically in the background. Android's periodic-work minimum interval is approximately 15 minutes, so this is a fallback rather than an instant push service.

## Safety scope
Civilian-safety only. Do not expose real-time troop positions, military movements, bases, vehicles or other operational military data.

## Build
GitHub Actions produces a debug APK artifact on every push to `main`.
