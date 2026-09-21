# UI design references for v0.5

The v0.5 redesign was informed by public GitHub projects, but the SAFEKRAY UI is implemented independently.

## References reviewed

- `AlexAsplund/Vanchor` (MIT)
  - Useful pattern: full-bleed Leaflet map on mobile, slim chrome, floating controls, progressive disclosure instead of large dashboard cards.
  - We reused the interaction idea, not project-specific navigation or control code.

- `mdanics/fluttergram`
  - Useful pattern: media-first social feed, compact post header, profile-first identity, photo upload flow.
  - Used as a product/UI reference only.

- `iampawan/Flutter-Instagram-UI-Clone`
  - Useful pattern: restrained Instagram-style hierarchy and bottom navigation.
  - Repository does not expose a standard license, so no source code was copied.

## v0.5 design direction

- Light neutral canvas with Ukrainian blue as the primary action color.
- Media and map content get visual priority.
- Less boxed-dashboard UI.
- Vector navigation icons instead of emoji navigation.
- Full-screen map with floating filter chips.
- Lazy viewport loading for shelters and transport to reduce map load.
- Social cards retain Tinder-like swipe gestures while looking closer to a polished social app.
