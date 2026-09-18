# UA LIVES MATTER

Android civilian-safety and community app for Ukraine.

## v0.5
- Clean mobile social design inspired by open-source GitHub UI patterns
- Required email/password accounts with Supabase Auth
- Native Android deep-link handler for email confirmation
- Community feed with photo/video posts
- 24-hour Stories
- Tinder-style swipe actions on feed cards
- Vector bottom navigation
- Full-bleed OpenStreetMap + Leaflet map
- Lazy viewport loading for shelters and transport to reduce map load
- Community alerts with confirmation/rejection
- Electricity, heating and water outage alerts
- Nearby alert notifications
- General and regional realtime chat
- Editable per-user emergency checklist
- SOS and emergency numbers
- Ukrainian, Russian and English UI
- Regional app lock when Android geolocation resolves the device country as RU

## Email confirmation redirect
The Android app accepts:

`ualivesmatter://auth/callback`

Signup requests already send this as their `emailRedirectTo`.

Supabase also requires this callback to be included in the project's **Auth → URL Configuration → Additional Redirect URLs**. The current ChatGPT Supabase connector does not expose that dashboard setting, so it must be added once in the Supabase dashboard. Without it Supabase falls back to the project's Site URL, which can appear as localhost.

## Map performance
Map-heavy layers are not loaded globally anymore. Shelters and public transport are fetched only for the current viewport and useful zoom levels, and pending requests are cancelled when the map moves.

## Design references
See `docs/DESIGN_REFERENCES.md`.

## Safety scope
Civilian-safety only. Do not expose real-time troop positions, military movements, bases, vehicles or other operational military data.

## Build
GitHub Actions validates embedded JavaScript and produces a debug APK artifact on every push to `main`.
