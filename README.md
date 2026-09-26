# 200 ms

An interactive scrollytelling story: one chat message travels from Moscow to New York and back in about 200 milliseconds. Scrolling drives story time, which is slowed down by up to ~10⁸ ×.

- **Live artifact:** https://claude.ai/artifact/8ZqxZ4fjKCHiiT3HX8zYAJ (private until shared from the page's Share menu)
- **Standalone file:** `index.html` (open directly in a browser, or host anywhere as a static file)
- **Languages:** Russian and English (toggle in the header, `L` key)

## Structure

```
src/
  template.html   page skeleton (HEAD / BODY / SCRIPTS parts)
  styles.css      all styles
  i18n.js         story structure, copy in RU + EN, sources
  core.js         utils, message model (UTF-8 + AES-GCM), layout, scroll → time, render loop, HUD
  audio.js        generative WebAudio beds per scene (no audio files)
  scenes-a.js     touch, bits, envelopes, radio, fiber
  scenes-b.js     relay map, Frankfurt, dive, Atlantic, New York, the way back
  features.js     chat + guess, quizzes, race chart, replay, reaction test, sandbox, postcard, autoplay, keys
  boot.js         entry point
  data/map-data.js  generated land outlines (Natural Earth via world-atlas)
tools/
  build-map.mjs   generates src/data/map-data.js
  build.mjs       bundles src/ into index.html and dist/artifact.html
```

## Build

```bash
npm install
npm run map     # only when map projection or data changes
npm run build   # writes index.html and dist/artifact.html
```

`dist/artifact.html` is the same page without `<html>/<head>/<body>` wrappers, for publishing as a claude.ai Artifact (declares the `downloads` capability for the postcard).

## Notes

- Scene timings are a model built from the speed of light in fibre (~204,000 km/s), real distances and typical equipment delays; facts were checked against the sources listed on the page.
- Libraries (pinned, from jsdelivr): d3-array 3.2.4, d3-geo 3.1.1, lenis 1.3.26. Fonts: Source Serif 4, Source Code Pro (Google Fonts).
