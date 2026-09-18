# UA LIVES MATTER

Android civilian-safety app for Ukraine.

## v0.2
- OpenStreetMap + Leaflet
- Kyiv official shelter GeoJSON layer
- Nearby OpenStreetMap bomb-shelter discovery
- Community alerts with realtime-ready validation
- General and regional realtime-ready chat
- Supabase schema with RLS + Realtime
- Official air-alert proxy function prepared for the official Ukraine Alarm API
- Public transport/station map layer
- SOS, emergency numbers and offline 72-hour checklist
- GitHub Actions APK build on every push

## Backend activation
The app works offline/local without a backend. For cross-device chat and community alerts, configure a Supabase project using `backend/supabase.sql`, then place the project URL and anon key in `app/src/main/assets/config.js`.

For official air alerts, deploy `supabase/functions/air-alerts` and configure the server-side secret `UKRAINE_ALARM_API_KEY`. The key must not be embedded in the APK.

## Safety scope
Civilian-safety only. Do not expose real-time troop positions, military movements, bases, vehicles or other operational military data.

## Build
GitHub Actions produces a debug APK artifact on every push to `main`.
