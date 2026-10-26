# Jay's Feed

The installable app for Jay's Feed - one card per screen from his team. This repository holds only the app's screens: no data, no keys. The cards and answers live in Jay's own Google account behind his Switchboard (see `system/switchboard/` and `system/feed.md` in the private jay-assistant repository). The app learns where to find them, and the key, from a one-time setup link, and keeps them on the phone only.

## Version 4 (27 October 2026)

- `index.html` - the frame: the sky canvas, the page, the three tabs (Home, For you, Tell us).
- `sky.js` - the real sun and moon over Crick, worked out on the phone from the time: sunrise, sunset, the moon's phase, the colour of the light, clouds, stars and the fields. Nothing is fetched.
- `app.js` - Home (replaces the Morning and Evening emails), For you (one post per screen, swipe right for done and left for not now, with undo), Answered and done (the clock on any post), Tell us.
- `app.css` - the look. Each post brings its own theme; Home takes its colours from the sky.

Preview any moment with `?now=2026-10-27T07:20` on the address.
