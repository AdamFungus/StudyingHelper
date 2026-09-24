# StudyingHelper

A local study website with Accounting and Microeconomics guides, chapter and topic navigation, randomized chapter quizzes, personal notes, and review progress.

## Open the website

With Node.js installed, run `npm start` from this folder, then open http://127.0.0.1:4173. Use the same browser and address each time to access your saved notes. Stop the server with Ctrl+C. No package installation is required.

Alternatively, open `website/index.html` directly. Browser storage behaviour for local files varies, so the local server is recommended.

## Local data

Personal notes, reviewed topics, the last topic, quiz attempt counts, and each chapter's highest quiz score are saved in this browser's localStorage under `studyinghelper.v1`. Nothing is sent to a server. Clearing browser data or using a different browser/profile/address will not retain that data. Use **Export my data** for a JSON backup and **Restore a backup** to merge it back in. Conflicting note versions are retained together, and restored quiz results keep the highest score. The supplied guide and quizzes are bundled with the site and do not depend on browser storage.

The site has no remote scripts, fonts, accounts, analytics, or external runtime dependencies. It works offline while the local server is running.

## Content provenance

Chapters 1–3 are sectioned from the available Chapters 1–12 master response in the referenced “Create Study Guide Notes” conversation. The connector truncates that response at 20,000 characters during Chapter 4. Chapters 4–12 therefore preserve text from the attached Libby Financial Accounting, Eighth Canadian Edition slide decks, grouped by topic. Original PowerPoint downloads are provided for tables, diagrams, and visual examples that text extraction cannot preserve. These chapters are not represented as a verbatim copy of the unavailable remainder of the ChatGPT response.

The bundled content contains 12 chapters and 375 topics, including 68 original visual placements and 42 extracted tables. Every chapter also has a 15-question quiz sourced from the referenced “Create Chapter Quiz Bank” conversation. The order of questions and answer choices changes on every attempt. Course-era Canadian terminology and statements are preserved, not independently updated. The source presentations are included for personal study; this version has not been published.

`website/content.js` contains the bundled chapter data and `website/quiz-data.js` contains the quiz bank. The scripts in `scripts/` document source extraction; their temporary input files are ignored because they contain machine-specific attachment paths.

## Microeconomics

The Microeconomics guide contains 5 chapters, 97 topics, and 130 multiple-choice questions. Each attempt samples 15 questions and shuffles the answer choices. The notes and Chapters 1–4 questions come from “Create Chapter Notes and Graphs.” The chat preview cuts off during the Chapter 5 notes and Chapter 4 answer key. The remaining Chapter 5 sections and its 25 supplemental questions were created from the attached Chapter 5 slides, and the remaining Chapter 4 answers were checked against the notes. These distinctions appear in the guide and quizzes.

Original PDF slide figures are placed beside the related topics because the conversation's generated sandbox image files were unavailable. Chapter PDFs are bundled for reference. `website/microeconomics-data.js` holds the notes and questions; `website/courses.js` registers both courses. The source builder is `scripts/build-micro.py`.

Accounting topic IDs and score keys remain unchanged. Microeconomics uses separate topic IDs and score keys in the same local backup, so existing Accounting notes, progress, scores, and backups remain compatible.

## Validation

Run `npm run check`.

