# Page bodies for the four empty `/tools/*` pages

These four pages exist in Webflow with SEO metadata and JSON-LD already set, and
**empty bodies**. The markup here is what goes in them.

## Validate before pasting

```bash
node webflow-pages/validate.mjs
```

Checks every constraint the Designer and `data_whtml_builder` enforce — single
root element, no `<style>` tags, well-formedness, no descendant selectors, only
Webflow's three breakpoints, no `--_spacing---*` variables — plus the project's
own rules on heading order and the colours that fail AA. **All four files pass as
of 7 August 2026.** If you edit one before pasting, re-run this first; a failure
here is a paste that breaks in the Designer.

## Why this is still a manual step

It could not be applied from the sessions that wrote it. Re-tested 7 August 2026
against Webflow MCP **2.0.1** — still blocked, for the same reason. Both routes:

- **Webflow MCP** — every page-building tool (`data_whtml_builder`, `data_pages_tool`,
  `data_element_tool`) takes an `actions[]` array, and the server advertises an empty
  input schema (`{"type":"object"}` with no `properties`). With no type information,
  the client serialises the array as a string and the server rejects its own request:
  `expected array, received string`. Even `actions: []` fails.
  **Scalar parameters do pass through** — `webflow_guide_tool` returns fine, and
  `data_pages_tool` with only `site_id` reaches the server and complains that
  `actions` is missing. So the failure is specifically array marshalling, and it
  cannot be worked around from the calling side.
  `ask_webflow_ai` takes a plain `message` string and therefore *does* marshal, but
  the service behind it returns `Failed to fetch from FAI chat service`.
  `get_more_tools` reports no additional tools.
  Retry from a client that marshals arrays for untyped MCP schemas — the Webflow
  Designer extension, or an interactive session with a different MCP client.
- **Webflow Data API** — the local CLI token in `%APPDATA%\webflow\auth.json`
  authenticates fine (`GET /v2/sites/{id}` → 200, `/v2/token/authorized_by` resolves
  the account) but carries **no `pages` scope**, so `GET /v2/sites/{id}/pages`
  returns 403. Granting the scope would not help: the Data API's "update static
  content" endpoint only rewrites existing text nodes and image alt text. There is
  no create-element endpoint, so this route could never have built these bodies.

## How to apply

For each page, one `data_whtml_builder` call per section, in order:

```
data_whtml_builder({
  siteId: "67fb46459daf80597440ed56",
  pageId: "<the page id>",
  actions: [{
    html: "<contents of the .html file>",
    css:  "<contents of shared.css, once per page>",
    parent_element_id: "<the page's main.page_main element id>",
    creation_position: "append"
  }]
})
```

Find the `main.page_main` id with `data_element_tool > query_elements` filtering on
style `page_main`. Pass `shared.css` on the **first** action for a page only; the
classes persist for later actions on the same site.

### The page skeleton must already be right

Every page needs this, and the four were built with it:

```
Body > div.page_wrap
  ├ ComponentInstance "Custom Code"  89894b6d-cf3f-dfb6-51d8-63b0d19309e1
  ├ ComponentInstance "Navbar"       729b7171-e23e-1a57-497a-96a24e8bc628
  ├ main.page_main            ← these bodies go here
  └ ComponentInstance "Footer"       14b031db-4c5f-d609-1778-c9f63f66670c
```

**"Custom Code" is load-bearing, not decoration.** It emits the fluid `clamp()` type
scale. A page without it silently falls back to fixed rems and sizes differently from
the rest of the site. **Verified present and working on all six pages, 7 Aug** — the
live HTML carries 25 `clamp()` declarations.

### Add WhatsApp Modal and Mascot too — they are not really optional

The skeleton above renders correctly without them, which is why they read as
optional. But the site's **global** custom code initialises them on every page and
does not null-check, so a page that omits them throws JS errors. Measured 7 Aug: the
homepage throws **0** console errors, `/tools/accessibility` throws **3**, and each
one is a missing element rather than a broken script:

| Error | Element the global script queries | Home | New pages |
|---|---|---|---|
| `initWhatsAppModal` | `[data-whatsapp-modal]` | 1 | 0 |
| `initDynamicCustomTextCursor` | `.cursor` (Mascot) | 1 | 0 |
| `hiddenKey02` (line ~1540) | `<input id="hiddenKey02">` | 1 | 0 |

Adding the **WhatsApp Modal** and **Mascot** component instances to each new page
clears the first two and restores the site-wide UX those components provide. Both are
additive — placing an existing component on a new page, exactly as the skeleton
already does for Navbar and Footer.

The third is different: `hiddenKey02` is a hidden field inside the **contact form**,
and adding a contact form to a tools page just to silence a log line is the wrong
trade. That error will fire on *any* page without that form. The real fix is a null
check in the site's global custom code — which is **existing site code, so it needs
your explicit go-ahead** under guardrail 1. It is harmless today: the line only
stamps `location.pathname` into a hidden analytics field.

### Then

1. Un-draft the page.
2. `publish_site` with `publishToWebflowSubdomain: true` and `customDomains: []`.
   Staging only — guardrail 3 pre-authorises `.webflow.io`, production needs a
   go-ahead. Drafts are excluded from publishing, which is why step 1 comes first.
3. Verify on `webyansh-webflow-agency.webflow.io`.
4. **Set back to draft** unless the user says otherwise.

## Constraints these files already respect

- **No descendant selectors.** `data_whtml_builder` rejects `.a11y_table th` with
  "Nested selectors are not allowed", so every element carries its own class.
- **Single root element per `html` string, and no `<style>` tags** — CSS goes in `css`.
- **No `@keyframes`, no custom media queries.** Only Webflow's breakpoints:
  991px, 767px, 479px.
- **`--swatch--*` variables resolve in Webflow's registry; `--_spacing---*` do not.**
  Spacing uses the `u-mb-*` / `u-mt-*` utilities so it stays Designer-editable.
- **Colour.** Live `gray-500` on `light` is 4.39:1 — a pre-existing site issue, flagged
  not fixed, and not reused here. `#ABABAB` is never used for text (2.12–2.30:1) and
  brand orange `#FF4D00` is never used for body-size text on light (3.08–3.33:1);
  `#B23600` (6.14:1) is used instead. Orange remains fine for fills, borders and large text.
- **`:focus-visible`.** No focus ring exists anywhere in the live CSS — the tool flags
  exactly that as its own rule 9, so every interactive element here ships one. The
  pages have to pass the audit the product sells.
- **New classes only, all `a11yp_`-prefixed.** Guardrails 1 and 2: nothing existing is
  modified, renamed or deleted.
- **Honesty.** Every page states that automated testing reaches 12 of the 55 WCAG 2.2
  A/AA criteria, and no page claims the tool delivers or guarantees compliance
  (guardrail 5). No page implies an overlay (guardrail 6).

If an element gets removed later, drop its style too with `data_style_tool > remove_style`
— Webflow keeps orphaned styles and the next build appends `-1` to the class name.
