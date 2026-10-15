# PGH Forms

A browser-only workspace for filling PGH forms, grouping lab orders into physical containers and paper requests, and copying four-line tube labels for Niimbot.

**Live app:** https://ajgilooo.github.io/pgh-forms/

## Use

1. Enter the patient details once.
2. Paste lab orders or search the catalog. Choose between tests with overlapping names; resolve or remove unmatched entries.
3. Review specimen groups, collection requirements, special tube sets, and request templates.
4. Preview/download a printable or editable PDF. Enter collection details when known and copy labels into your own labeling interface.

Central Lab requests print four per A4 sheet. The supplied two-page Surgical Pathology form keeps its original layout. Other destinations require a blank template uploaded and mapped in Template studio.

**PhilHealth CF-2:** Use **Add CF-2** on Patient details or Forms & labels. It works without lab orders or a hospital case number. Patient names carry over in capitals; expand the grouped sections to enter confinement, diagnoses, procedures, professional and billing information. Add another CF-2 when needed. Both printable and editable downloads preserve the official two-page 8.5 × 13 inch layout. Certification choices, consent details, charges and dates remain blank until entered; sign separately.

The built-in CF-2 is the [September 2018 revision currently linked by PhilHealth](https://www.philhealth.gov.ph/downloads/claim/ClaimForm2_092018.pdf). Its field mapping can be rebuilt with `python3 scripts/build-cf2-fields.py`.

## Data handling

- Patient details, orders, collection information, PDF previews, and extra clinical fields exist only in React memory. Refreshing or clearing removes them.
- No patient database, analytics, remote PDF processing, or external fonts/scripts. A same-origin Content Security Policy restricts network connections.
- Browser storage contains only **blank templates**, field mappings, and explicitly edited catalog rules. Upload only blank forms. Existing interactive field values are removed during template import; the app cannot detect patient information printed into the background of a scan.
- Exported PDFs and clipboard contents remain under the user's control. Clearing the app does not delete downloads or clear the system clipboard.
- The public repository contains only blank form assets, source guidance, application code, and synthetic test fixtures.

## Source guidance

The catalog transcribes the user-supplied “Grand Guide to PGH Labs” Telegram export, with entries dated 2023–2025. Original message dates and text remain available in the Lab catalog. The extracted sources are in `src/data/sources.json`; `scripts/build-catalog.py` builds the curated rules and specimen-specific variants.

This is a documentation and form-preparation tool. Source availability, fees, schedules, volumes and compatibility are historical reference information, not independently verified current laboratory policy. Missing or contradictory requirements need explicit review. The app never calculates an additive collection volume or prescribes a change in treatment.

## Development

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

The Vite base path is `/pgh-forms/`. GitHub Actions runs tests/builds and deploys `dist` to GitHub Pages after a push to `main`. Pull requests run validation without deploying.

### Architecture

- `src/lib/engine.ts`: deterministic matching, unresolved entries, container grouping, separate paper requests, labels.
- `src/lib/pdf.ts`: local PDF generation, unique editable fields, flattened print output, overflow rejection, sanitized template imports.
- `src/lib/storage.ts`: explicit storage boundary for blank templates and catalog changes.
- Template mappings use top-left page coordinates. Shared patient/order bindings and per-request manual values remain separate.
- PDF.js renders previews; pdf-lib and an embedded Liberation Sans font generate forms. All runtime assets are bundled.

### Verification

`npm test` covers grouping exceptions, ambiguity, exact label text, PDF pagination/values/checkboxes, multiple pathology requests, overflow, template imports, and storage/clipboard failure behavior. Synthetic PDFs for additional visual checks are generated in ignored `tmp/qa/`.

### Assets

Blank laboratory and pathology forms were supplied by the user. Laboratory guidance is retained with source message dates. PGH marks are part of the original form artwork; this tool does not claim official hospital endorsement. Liberation font licensing is included in `public/fonts/LICENSE.txt`; PDF.js font/runtime licenses are distributed beside their assets.
