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
