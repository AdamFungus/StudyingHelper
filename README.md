# StudyingHelper

A local study website with an included Financial Accounting guide, chapter and topic navigation, personal notes, and review progress.

## Open the website

With Node.js installed, run `npm start` from this folder, then open http://127.0.0.1:4173. Use the same browser and address each time to access your saved notes. Stop the server with Ctrl+C. No package installation is required.

Alternatively, open `website/index.html` directly. Browser storage behaviour for local files varies, so the local server is recommended.

## Local data

Personal notes, reviewed topics, and the last topic are saved in this browser's localStorage under `studyinghelper.v1`. Nothing is sent to a server. Clearing browser data or using a different browser/profile/address will not retain that data. Use **Export my data** for a JSON backup and **Restore a backup** to merge it back in. Conflicting note versions are retained together. The supplied guide is bundled with the site and does not depend on browser storage.

The site has no remote scripts, fonts, accounts, analytics, or external runtime dependencies. It works offline while the local server is running.

## Content provenance

Chapters 1–3 are sectioned from the available Chapters 1–12 master response in the referenced “Create Study Guide Notes” conversation. The connector truncates that response at 20,000 characters during Chapter 4. Chapters 4–12 therefore preserve text from the attached Libby Financial Accounting, Eighth Canadian Edition slide decks, grouped by topic. Original PowerPoint downloads are provided for tables, diagrams, and visual examples that text extraction cannot preserve. These chapters are not represented as a verbatim copy of the unavailable remainder of the ChatGPT response.

The bundled content contains 12 chapters and 375 topics, including 68 original visual placements and 42 extracted tables. Course-era Canadian terminology and statements are preserved, not independently updated. The source presentations are included for personal study; this version has not been published.

`website/content.js` contains the bundled chapter data. The scripts in `scripts/` document source extraction; their temporary input files are ignored because they contain machine-specific attachment paths.

## Check syntax

Run `npm run check`.
