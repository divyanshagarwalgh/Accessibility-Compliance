# Page builder — a Designer Extension

Builds the four `/tools/*` page bodies inside the Webflow Designer, as native
elements with real classes.

## Why this exists

Applying `webflow-pages/*.html` needed a route into the Designer's element API.
Every route from outside was closed (all re-tested 7 August 2026):

| Route | Result |
|---|---|
| Webflow MCP `data_whtml_builder` | Advertises an empty input schema, so the client serialises the required `actions` array as a string and the server rejects its own request — `expected array, received string`. Scalars marshal; arrays cannot. |
| Webflow Data API | Token authenticates and reads the site, but 403s on `pages`. Granting the scope would not help: there is no create-element endpoint, only static-content rewriting of nodes that already exist. |
| Manual paste into the canvas | Documented fallback; did not work. |

The Designer API has `insertElementFromWHTML(whtml, anchor, position)` — the same
capability the MCP wraps — and inside the Designer there is no array-marshalling
problem. So this extension is that call, wrapped in a button.

## What it does

1. Creates the 26 classes `shared.css` defines and applies all 32 rule sets,
   including the `small`-breakpoint rules and the `:hover` / `:focus-visible`
   states. It reuses a class of the same name if one already exists, so running
   it twice is safe.
2. For each page: switches to it, finds `main.page_main`, and inserts the body.

**A page whose `page_main` already has children is skipped, not appended to.**
There is no undo, and a second run would otherwise duplicate the whole body.

Styles are created before any markup is inserted, and that order is load-bearing:
`insertElementFromWHTML` binds elements to an existing class of the same name, so
creating them first is what makes the pages arrive styled.

## Running it

```bash
node run.mjs
```

That is the whole thing: generate, compile, serve. Leave the window open; Ctrl+C
when done.

**Do not use `npm run`.** Two separate things break it on this machine, and
`run.mjs` exists to sidestep both:

1. **PowerShell's execution policy blocks `npm.ps1`** — *"running scripts is
   disabled on this system"*. Fixing that means changing a system security
   setting, which this project should not require.
2. **The `&` in this project's path truncates npm's Windows shims**, so even
   where npm runs, a bare `tsc` fails with `MODULE_NOT_FOUND`.

`node.exe` is a real executable, so neither applies to it. Every step in
`run.mjs` is a direct `node` invocation for that reason. The `npm run *` scripts
in `package.json` are kept for CI and non-Windows use.

PowerShell will print a red `NativeCommandError` block around the CLI's
update-check line. That is PowerShell 5.1 wrapping a native command's stderr, not
a failure — the server is running if you see the localhost URL.

Then in the Designer: **Apps** → this app → **Launch development app**, pointing
at the URL it prints (usually `http://localhost:1337`).

Registering the app once, in Workspace settings → **Apps & integrations** →
**Create new app**, with the *Designer extension* capability, is the only step
that cannot be scripted.

## After it runs

1. Check each page in the Designer.
2. Publish to **staging only** — production needs an explicit go-ahead.
3. Re-run `node webflow-pages/validate.mjs` if you edit the source files, then
   `node generate-data.mjs` to re-bake.

## Regenerating

`src/pages-data.ts` is generated — do not edit it. It exists because the
extension is served as static files to an iframe and cannot read the repo at
runtime. Re-run `generate-data.mjs` after any change to `webflow-pages/`.

The CSS parser it uses only accepts single-class selectors with at most one
pseudo state, which is exactly the constraint `webflow-pages/validate.mjs`
already enforces. It exits non-zero and names the offender rather than silently
dropping a rule.
