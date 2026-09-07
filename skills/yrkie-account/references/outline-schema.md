# DOE Outline V1 — complete external authoring contract

Authoring edition: **2**. Schema identity: `urn:yrkie:doe-outline:v1:external-authoring:2`.

Use this reference when creating an outline with `yrkie_create_outline`. This is the same content structure used by DOE in Yrkie. It is separate from the Slide component schema. Generate content with the user's own agent; no Yrkie generation agent is required.

- [Machine-readable JSON Schema](doe-outline-v1.schema.json)
- [Five complete syntax examples](doe-outline-v1.examples.json): no-image, content-image, decorative-image, uploaded-image and mixed-image outlines. Uploaded references in examples are placeholders; replace them with real tool results.

## Content structure

```json
{
  "title": "Project kickoff",
  "page_count": 2,
  "body": [
    {
      "index": 1,
      "page": 1,
      "contents": [
        "Project kickoff: scope and outcome",
        "The meeting will establish the objective, responsibilities and acceptance criteria."
      ]
    },
    {
      "index": 2,
      "page": 2,
      "contents": [
        "Next steps",
        "The project owner documents the agreed scope.",
        "Each participant checks the responsibilities assigned to them."
      ]
    }
  ]
}
```

All fields shown above are required. No additional fields are accepted at any level.

| Field | Exact meaning | Limits |
| --- | --- | --- |
| `title` | Presentation/outline title; does not rename an existing project | Nonblank trimmed string, 300 UTF-8 bytes |
| `page_count` | Total number of authored pages | Integer 1–100, exactly `body.length` |
| `body` | Complete pages in reading order | Array of 1–100 page objects |
| `body[n].index` | Current 1-based page position | Integer exactly `n + 1` |
| `body[n].page` | Displayed page number | Integer exactly `n + 1`, equal to `index` |
| `body[n].contents` | Ordered, complete content for that page | 1–100 strings |
| Each content string | Title, paragraph, fact, data description, reference or image plan | Nonblank trimmed string, 8000 UTF-8 bytes |

Additional rules:

- The complete outline must fit within **1 MiB of serialized UTF-8 JSON**. The complete tool request must fit within 2 MiB. Characters such as Chinese commonly use three UTF-8 bytes; JSON Schema `maxLength` alone does not check this. The server checks byte limits too.
- Use integer JSON values such as `1`, not `"1"` or `1.0`. Do not omit fields, use null, repeat object keys, or supply fenced JSON, comments or trailing commas.
- Page numbers must be consecutive. Do not submit gaps, duplicates, old page positions, stable IDs or a `page_count` that describes a future plan.
- The server does not silently correct, shorten, reorder, pad or repair the document. A rejected request changes nothing.
- Internal LF (`\n`) and tabs (`\t`) are allowed. Leading/trailing whitespace, CR, other control characters and directional override controls are rejected. JSON must escape line breaks and quotation marks correctly.
- Text is data. HTML, SVG, executable markup, active URI schemes such as `javascript:`, `data:` or `file:`, and private references outside the exact standalone image-reference contract below are rejected. Ordinary punctuation, apostrophes, formulas, SQL terminology and normal multilingual prose are allowed. An ordinary HTTPS source citation is text only: creation does not fetch it or import an image.
- Do not include `operation`, `expected_revision`, `slides`, `schemaVersion`, database IDs, permissions, asset IDs, generation state, billing fields or Slide component objects inside `outline`. Those belong to other contracts or the server.

## Write useful, complete page content

There is no requirement to minimize the user's model tokens. Favor clear, complete content over compressed shorthand. Stay within the processing limits above; these limits are separate from membership rules for later platform generation.

Usually place the page title first, then its main statement, evidence and supporting details. This ordering is authoring guidance, not a hidden validator rule. Use additional strings for distinct paragraphs or facts. The server preserves their order; it does not invent a cover, agenda or conclusion.

Include the actual content that should appear in the eventual presentation. “Make a chart” is insufficient: include the chart's subject, categories, values, series, units and relevant qualifications. For a table, supply labels and row values in readable strings; for a process, give ordered steps and their descriptions. Visual design decisions can be described in plain text without embedding Slide layout properties.

Preserve the user's numbers, names, dates, sources and qualifications. If source material is missing, state the gap rather than manufacture facts. Use sample numbers only when the user accepts illustrative data, and label them in the affected content. Prefer splitting overloaded content across pages to deleting necessary meaning.

## Image plans

The optional image plan is one complete `contents` string:

```text
GENRATEIMG[type=content,ratio=4:3](A flat colorful 2D line illustration of a branching process, no lettering, complete subject, solid green background for background removal.)
GENRATEIMG[type=decorative,ratio=16:9](A flat colorful 2D line illustration of a quiet city park, no text, with clear open space.)
```

The spelling is **GENRATEIMG**, exactly as shown. Do not “correct” it to GENERATEIMG. Do not use the older untyped forms `GENRATEIMG(prompt)` or `GENRATEIMG[ratio=...](prompt)`.

| Part | Accepted values |
| --- | --- |
| `type` | `content` for an explanatory/evidence-bearing subject; `decorative` for atmosphere/context |
| `ratio` | `1:1`, `4:3`, `3:4`, `4:5`, `16:9`, `9:16` |
| Prompt | Nonempty plain text inside the parentheses; the entire string remains within 8000 UTF-8 bytes |
| Total | At most 16 image plans across the whole outline |

Use exactly `[type=...,ratio=...]` with that order and punctuation. Do not insert spaces into the metadata or put a marker inside another paragraph. A content-image prompt should follow the existing flat 2D/color-line-art and green-background convention; decorative images should suit the page's narrative purpose. Images are optional and need not appear on every page.

**Saving an outline only saves these plans. It does not confirm the outline, generate images, start a platform model, create slides or deduct generation credits.** Later platform confirmation/generation is a separate action governed by its own permissions and entitlements. Follow the approval and final-confirmation steps in [outline-workflow.md](outline-workflow.md).

## Uploaded image references

An approved image uploaded to this project may appear as one entire contents string: `yrkie-asset-data://<64 lowercase hexadecimal characters returned by the tool>`. No extra text, URI parameters or nested image objects are allowed. The server verifies ownership, project binding and availability; a syntactically correct invented hash is still rejected. At most 256 uploaded-image placements are accepted in one outline.

The image type and layout ratio come from the server's upload receipt and cannot be overridden in the outline. The same project's existing valid reference may be reused across pages and draft versions. Content references require transparent subjects; decorative references preserve complete images. Do not use an HTTP URL or Base64 as an image substitute.

Before generating or uploading anything, read [image-workflow.md](image-workflow.md) for the mandatory source, treatment and user-approval steps. Then use [outline-workflow.md](outline-workflow.md) to save and confirm the final reviewed version. Do not copy placeholder references from the examples into real requests.
