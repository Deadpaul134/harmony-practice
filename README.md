# Harmony Practice (Rimon, Harmony 1)

Interactive drills for the course "Jazz & Pop Harmony 1", based on the book
*Foundations of Jazz and Pop Harmony* (Benkut & Kimelman).

Topics:
- **Intervals** – semitone counts, naming, building, interval chains (like page 119).
- **Modes** – build, identify, parent scale, characteristic note.
- **Chromatic degrees** – "B = #2 of which major scale?" and the reverse.

Answers are checked the book's way: any note name that sounds right is accepted.
Progress is stored in the browser on each device. Signing in with Google
syncs it across devices (Firebase Auth + Cloud Firestore, project
`concrete-spider-453418-s2`, free Spark plan). Each user has one doc,
`users/{uid}`, and `firestore.rules` lets only that user read or write it.
The rules are published in the Firebase console (Firestore > Rules); keep
the file and the console in sync.

## Run

Open `index.html` in a browser. No build step.

## Test

```
npm test
```

(or `node tests/logic.test.js`)

## Piano sound

Lessons play a sampled grand piano (`js/piano-sampler.js`, samples in
`assets/piano/`, one every minor third A1–C7, 22 mono MP3 files, ~612 KB).
Samples load lazily after the first tap, octaves C3–C6 first; until a sample is
decoded (or if it fails) that note uses the small built-in synth. The service
worker precaches 8 core samples and caches the rest on first use
(`ha-piano-v1` cache, kept across app versions).

## Credits / קרדיטים

- צלילי פסנתר: Salamander Grand Piano V3 מאת Alexander Holm, ברישיון CC BY 3.0
  (https://creativecommons.org/licenses/by/3.0/). See `assets/piano/LICENSE.txt`.
- Piano sounds: Salamander Grand Piano V3 by Alexander Holm, licensed
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Samples trimmed to
  3.5 s with a fade-out and converted to mono 64 kbps MP3.
