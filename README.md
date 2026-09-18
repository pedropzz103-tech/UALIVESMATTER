# UA LIVES MATTER

Android civilian-safety app for Ukraine.

## v0.3
- OpenStreetMap + Leaflet
- Kyiv official shelter GeoJSON layer
- Nearby OpenStreetMap bomb-shelter discovery
- Community alerts with confirmation/rejection
- Dedicated electricity, heating and water outage alerts
- Separate utility layer for verified/provider incidents
- General and regional realtime-ready chat
- Supabase schema with RLS + Realtime
- Official air-alert proxy function prepared for the Ukraine Alarm API
- Public transport/station map layer
- SOS, emergency numbers and offline 72-hour checklist
- GitHub Actions APK build on every push

## Utility alerts
Community users can report:
- electricity outage
- heating outage
- water outage

Reports stay clearly marked as community/unverified until enough independent users confirm them.

The `utility_incidents` table is reserved for trusted/verified provider or administrator data and is read-only to public app clients. It supports current status, source, coordinates and expected restoration time.

## Backend activation
The app works offline/local without a backend. For cross-device chat and community alerts, configure a Supabase project using:
1. `backend/supabase.sql`
2. `backend/002_utility_incidents.sql`

Then place the project URL and publishable/anon key in `app/src/main/assets/config.js`.

For official air alerts, deploy `supabase/functions/air-alerts` and configure the server-side secret `UKRAINE_ALARM_API_KEY`. The secret must never be embedded in the APK.

## Safety scope
Civilian-safety only. Do not expose real-time troop positions, military movements, bases, vehicles or other operational military data.

## Build
GitHub Actions produces a debug APK artifact on every push to `main`.
