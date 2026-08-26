# Stopping iOS from blurring your page under the status bar / Dynamic Island

**Applies to:** web apps added to the iPhone Home Screen (standalone / "Add to Home Screen"),
on iOS 26 and later — including the iOS 27 betas.

**Symptom:** the band across the top of the screen — the area containing the clock, the
Dynamic Island and the battery — is not showing your page cleanly. Whatever the app draws up
there looks frosted, smeared or washed out, as if a pane of glass sits over it. The rest of
the screen is sharp. Scrolling content under that band makes the smear move with it.

---

## 1. Before changing any code: rule out the OS bug

iOS 26.1 and the iOS 27 betas have a known system-level glitch where the status bar gets
stuck in a blurred state **everywhere**, not just in your web app.

Check the Home Screen, Settings, and a native app such as Messages. If the status bar looks
blurred there too, it is not your app — **restart the device** and re-check. Only continue
below if the blur is specific to your web app.

---

## 2. What is actually happening

Since iOS 26 ("Liquid Glass"), a Home Screen web app runs edge-to-edge and the system
composites its own translucent layer over the status bar region. That layer is **not** part
of your page and cannot be styled directly. What you *can* control is what the system decides
to put in it.

iOS picks between two modes:

| Mode | When it is chosen | Result |
|---|---|---|
| **Solid tint** | The system finds an opaque element pinned at the top edge of the viewport and samples its colour | A flat, solid band. Your content is never blurred. |
| **Glass** | It finds nothing opaque to sample | It falls back to blurring whatever page pixels sit behind the band. **This is the bug you are seeing.** |

So the fix is not "turn the blur off". **The fix is to give the system something opaque to
sample**, so it takes the solid-tint path and never reaches for the blur.

### The sampling rules

In order:

1. Elements with `position: fixed` or `position: sticky` whose box touches the **top edge of
   the viewport**. It reads their `background-color`.
2. Failing that, the `<body>` background colour.
3. Failing that, an OS default.

Four things about this matter in practice:

- It reads **`background-color` only**. A `background-image`, a `linear-gradient`, or a colour
  applied via a pseudo-element or a child is not sampled.
- **The colour must be fully opaque.** Any alpha below 1 (`rgba(...)`, `#RRGGBBAA`,
  `oklch(... / 0.9)`) makes the result unpredictable and usually re-triggers glass mode.
- **A `backdrop-filter` on the sampled element forces glass mode.** That property is exactly
  the signal that you *want* a translucent bar.
- **Sampling happens at initial render.** Changing the colour later from JavaScript does not
  reliably re-tint the band. Treat the colour as fixed at load; if the app has themes, set the
  right one before first paint.

---

## 3. The fix

### Step 1 — Opt into the full-height viewport

Required. Without it the page never extends under the status bar and the rest of this has
nothing to attach to.

```html
<meta name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

### Step 2 — Give the system an opaque element to sample

Add a bar pinned to the top edge, as tall as the safe-area inset, with a **flat, fully
opaque** `background-color`.

```css
.status-bar-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  /* Exactly covers the status bar / Dynamic Island band. */
  height: env(safe-area-inset-top, 0px);
  /* Opaque. No alpha, no gradient, no backdrop-filter. This is the colour the
     system will paint into the status bar band. */
  background-color: #0d0d10;
  /* Above page content, below modals. */
  z-index: 10;
  pointer-events: none;
}
```

```html
<body>
  <div class="status-bar-backdrop" aria-hidden="true"></div>
  <!-- rest of the app -->
</body>
```

Then keep your own UI clear of that band:

```css
.app-header {
  padding-top: env(safe-area-inset-top, 0px);
}
```

### Step 3 — Set an opaque body background as the fallback

Cheap insurance for the case where the pinned element is not found:

```css
html,
body {
  background-color: #0d0d10; /* opaque; match the bar above */
}
```

Set it on **both**. `<html>` alone is not reliably sampled, and `<body>` alone leaves the
overscroll canvas unpainted.

### Step 4 — Remove translucency from anything touching the top edge

Audit every `position: fixed` and `position: sticky` element that reaches `top: 0` and make
sure none of them has:

- a semi-transparent `background-color`
- a `backdrop-filter` or `-webkit-backdrop-filter`
- no `background-color` at all

If a header genuinely needs a frosted look, **do not put the effect on the pinned element**.
Keep the pinned container opaque and move the blur to a `position: absolute` child inside it.

### Step 5 — Hide with `display: none`, never `opacity: 0`

An element that is invisible but still laid out at the top edge is still sampled, and a
transparent one drags you straight back into glass mode.

```css
/* Wrong — still sampled. */
.top-overlay.is-hidden { opacity: 0; }

/* Right — removed from consideration. */
.top-overlay.is-hidden { display: none; }
```

---

## 4. Meta tags that do *not* fix this

Do not spend time on these. They are the answers older articles will give you.

### `apple-mobile-web-app-status-bar-style`

```html
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

- It does **not** control the Liquid Glass layer.
- It is deprecated on iOS 26+ and logs a console warning.
- iOS reads it **only when the icon is added to the Home Screen**. Editing it and reloading
  changes nothing — the icon has to be deleted and re-added.
- `black-translucent` has a long-standing quirk of its own: the page paints from `y=0`, but
  the viewport is still shortened by the status bar height, leaving an unreachable strip at
  the bottom.

Keep the tag if you still support older iOS. Do not expect it to solve this.

### `theme-color`

```html
<meta name="theme-color" content="#0d0d10" />
```

Safari 26+ **ignores it** for status bar and toolbar tinting; the element sampling described
above replaced it. Keep it — Android Chrome and others still honour it — but it will not
change anything on iOS.

---

## 5. Verifying the fix

The install is cached, so a plain reload proves nothing.

1. Deploy the change.
2. On the phone, **delete the Home Screen icon and re-add it** from Safari. Mandatory if you
   touched any `apple-mobile-web-app-*` tag, and worth doing regardless.
3. Open from the Home Screen icon, not from Safari — standalone mode is the only place this
   behaviour appears.
4. Put high-contrast content directly under the status bar and scroll it. The band should stay
   a flat, dead-solid colour and never pick up any part of what passes beneath it.
5. Check both orientations. In landscape the inset moves to the sides
   (`env(safe-area-inset-left` / `-right)`) and the top inset collapses toward `0px`. The
   `env(..., 0px)` fallbacks above handle that, but confirm nothing jumps.

---

## 6. If the app cannot use `position: fixed`

Some apps deliberately avoid `position: fixed`: on iOS a fixed element is placed against the
*layout* viewport, so a rotation that leaves the visual viewport offset drags fixed elements
visibly out of place, and no scroll reset clears it.

If that is your situation, do not make the whole app shell fixed. Two options:

- **A dedicated strip.** Keep the shell laid out normally and make *only* the small
  `status-bar-backdrop` element from Step 2 fixed. It is `env(safe-area-inset-top)` tall and
  one flat colour, so even if a rotation offsets it briefly there is nothing to see.
- **`position: sticky` instead.** A sticky element at `top: 0` inside a scroll container is
  sampled the same way and is not subject to the layout-viewport problem.

Either way, the opaque `html, body` background from Step 3 stays as the safety net.

---

## 7. Checklist

- [ ] Ruled out the OS-wide iOS 26.1 / 27-beta blur bug (restart the device)
- [ ] `viewport-fit=cover` present in the viewport meta tag
- [ ] An opaque, full-width element pinned at `top: 0`, `height: env(safe-area-inset-top)`
- [ ] That element's `background-color` is flat and fully opaque — no alpha, no gradient, no
      `backdrop-filter`
- [ ] `html, body { background-color: <same opaque colour>; }`
- [ ] No other pinned element at the top edge is translucent or backdrop-filtered
- [ ] Top-edge elements hidden with `display: none`, not `opacity: 0`
- [ ] Home Screen icon deleted and re-added before testing
- [ ] Verified in standalone mode, in both orientations

---

## Notes on sourcing

Apple does not document the status-bar sampling behaviour for web apps. The rules in section 2
come from developer reverse-engineering of Safari 26 and match observed behaviour; treat the
ordering as reliable and the edge cases as empirical. The blur is a *fallback*, not a feature
with an off switch — everything above works by making sure the fallback is never reached.
Apple may change the details in a future release, so re-verify after major iOS updates.
