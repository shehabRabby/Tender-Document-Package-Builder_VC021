# Tender Document Package Builder

TenderPack validates tender requirements, supporting PDFs, document expiry dates, and assignments before producing an ordered submission package entirely in the browser.

## Live Demo

https://devfest-232-15-467.vercel.app/

## Developer

Md. Shehab Al Rabby

Registration ID: 232-15-467  
Repository: https://github.com/shehabRabby/devfest-232-15-467

## Problem

Tender packages are easy to get wrong: required documents can be missed, certificates can expire before submission, duplicate files can be assigned twice, and manual ordering creates avoidable errors.

## Solution

Load a validated `requirements.json`, upload PDFs, match documents one-to-one, resolve blocking status issues, and generate a single ordered PDF package locally in the browser.

## Main Features

- Structural validation for tender JSON and numeric requirement ordering.
- Multiple PDF upload, page counting, a 30-file limit, and a 50 MiB combined limit.
- Damaged and encrypted PDF handling; SHA-256 duplicate detection and duplicate-content assignment protection.
- One-to-one matching, expiry-date validation, live statuses, and package-readiness checks.
- English/Bangla interface and persistent Light/Dark themes. With no saved preference, the initial theme follows the system preference; System is not a selectable mode.
- Responsive dashboard with labeled controls, visible keyboard focus, and reduced-motion support.
- Browser-only document processing and Unicode/Bangla tender metadata on the generated PDF cover.
- English cover page, matched documents merged in requirement order, original pages preserved, and a `Tender ID | Page X of Y` footer on every page.
- Focused Framer Motion transitions and a subtle GSAP workspace accent animation.

## Status Rules

- **Missing:** a mandatory requirement has no matched file; blocks generation.
- **Expiry date needed:** a matched expiry-required document has no valid expiry date; blocks generation.
- **Expired:** the expiry date is before the submission deadline; blocks generation.
- **Not provided:** an optional requirement has no matched file; does not block generation.
- **OK:** the matched file does not require expiry, or expires on or after the deadline. An expiry date equal to the deadline is OK.

## PDF Package Rules

The package starts with an English cover containing tender details and the ordered list of included documents. Matched documents follow in numeric requirement order; unmatched optional documents are skipped. Every original page is retained in order, each page receives a footer, and the file is named `<tender_id>_Package.pdf`. Unsafe path and control characters in the download filename are sanitized without changing the tender ID displayed in the package.

## Tech Stack

- Next.js 16.3.8, React 19.3.0, TypeScript 6.0.3, Tailwind CSS 4.3.3
- pdf-lib 1.17.1, @pdf-lib/fontkit 1.1.1, regenerator-runtime 0.14.1
- Web Crypto API, Lucide React 1.52.0, Framer Motion 14.0.0, GSAP 3.15.0
- Noto Sans Bengali (SIL Open Font License; bundled locally in `public/fonts/`)
- Vercel

## Privacy

Tender PDFs and JSON are processed entirely in the user's browser and are not uploaded to participant-controlled servers. Documents stay in memory and remain available for reuse when another requirements file is loaded; requirement assignments and expiry dates reset for the new tender. The bundled cover font is served by the application itself.

## How to Run

```sh
npm install
npm run dev
```

## Tests

```sh
npm test
npm run lint
npm run typecheck
node tests/browser-smoke.mjs
```

Run the browser smoke test after the production build. It uses the installed Chrome executable; set `TENDER_TEST_BROWSER` if Chrome is installed elsewhere.

## Production Build

```sh
npm run build
```

## Known Limitations

No known critical application issues. Cover text uses the bundled Noto Sans Bengali glyph set; unsupported characters fail with a clear message rather than being substituted. The theme control offers Light and Dark; System preference is followed only when no explicit preference is saved. The development lint dependency chain currently reports five high npm audit findings through `braces`, `micromatch`, and `fast-glob`; `npm audit --omit=dev` reports zero production dependency vulnerabilities. The suggested automatic remediation is a breaking downgrade, so it was not applied in this hardening pass.

## AI Tools Used

ChatGPT · Codex

## License

MIT — see [LICENSE](LICENSE).
