# SAFEKRAY

Free, independent Android civilian-safety and community app for Ukraine. A VISIONE project.

## v0.8
- UA-State-inspired safety dashboard
- Live air-alert polygons using NEPTUN region GeoJSON + alert snapshot API
- Civilian risk zones rendered as red / orange / yellow overlays
- Community reports feed into risk overlays in realtime
- Backend support for curated civil-risk GeoJSON polygons
- Safer-route mode using OSRM route alternatives and current app risk overlays
- One-tap route to nearest civilian bomb shelter from OpenStreetMap
- Tap-anywhere destination route mode
- Full-bleed Leaflet map with floating controls and legend
- Shelters, public transport, electricity, water and heating layers
- Verified-help section with Ukrainian Red Cross, UNHCR Ukraine and UNITED24
- Emergency-kit shortcut and editable per-user checklist
- Photo/video feed, Stories, chat, accounts and profiles retained from v0.5
- Ukrainian, Russian and English UI
- Android deep-link handler for email confirmation
- App remains locked when Android geolocation resolves the device country as RU

## Important route behavior
The route feature is informational. It requests alternative road routes and scores the returned alternatives against the risk areas currently visible to the app. It is **not** an official evacuation order and cannot guarantee that a road is open or safe.

The project deliberately does not expose live troop positions, bases, military vehicle movements or other operational military tracking.

## Air-alert data
The app uses NEPTUN's open alert API and its matching oblast/raion GeoJSON boundaries. NEPTUN attribution is displayed on the map. NEPTUN is an informational aggregator and does not replace official civil-defense alerts.

## Shelters
The general shelter search uses civilian OpenStreetMap objects tagged:
`amenity=shelter + shelter_type=bomb_shelter`

Kyiv's official open-data shelter layer remains supported separately where available.

## Verified resources
The backend currently lists:
- Ukrainian Red Cross
- UNHCR Ukraine
- UNITED24

These entries link to the organizations' official websites. The app does not process donations itself.

## Email confirmation redirect
The Android app accepts:

`safekray://auth/callback`

Signup requests send this as their `emailRedirectTo`.

Supabase also requires this callback in **Auth → URL Configuration → Additional Redirect URLs**. If it is missing, Supabase may fall back to the project Site URL.

## Backend
Supabase stores:
- accounts / profiles
- posts, Stories and likes
- realtime chat
- community alerts and votes
- utility incidents
- editable checklists
- civil risk zones
- evacuation points
- verified help resources

SQL migrations live under `backend/`.

## Build
GitHub Actions validates all embedded JavaScript and produces a debug APK artifact on every push to `main`.


## Project page
https://visione.one/SAFEKRAY/

SAFEKRAY is independent and is not affiliated with similarly named organizations.
