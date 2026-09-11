# FormShare

FormShare is an offline, installable Progressive Web App (PWA) for designing forms and collecting signed submissions — with no backend, database, or account.

There are two roles:

- **You (the sender)** design a form with a drag-free field builder — short/long text, phone, email, number, date, a "choose one of these specific dates" field (for class or appointment sign-ups), a terms-and-agreement block, and a signature pad — then either fill it out yourself, or send the **blank form as a link** for someone else to fill out.
- **The recipient** opens that link (no app or account needed), fills in their own info, picks a date, agrees to your terms, and signs with a finger or mouse. Submitting gives them a **link back** to the completed, signed form, which they text or email to you.
- **You** open that link and tap **Save to My Forms** to keep a permanent local copy, downloadable as a PNG or PDF.

Since there's no backend, every link carries the form's structure (and, for a completed submission, its answers and signature) encoded directly in the URL — nothing is uploaded anywhere. Signatures are downscaled and compressed before being embedded so links stay a reasonable length for SMS and email.

- **Form builder**: build any form from scratch — add, remove, reorder, and configure fields of any type — or start from one of three starter templates (Business Form, Customer Business Info, Class Sign-Up Form).
- **Business profiles**: save your own business's info (or a friend's) once — name, phone, email, address — and reuse it. Saved businesses show as cards on the home screen (your most recently updated one appears as a subtitle under the app title), and "Fill in business info" on any form auto-fills matching fields (business name, phone, email, address) in one tap. You can save more than one profile if you're managing forms for more than one business.
- **Download**: export any submission as a PNG or a PDF. The PDF is generated entirely client-side (a hand-built single-page PDF wrapping a JPEG snapshot) — no library, no network call, works offline.
- **Share**: the native share sheet, a text message, or email — for both blank forms (to be filled out) and completed submissions (sent back to you).
- **Private by default**: everything lives only in the browser's local storage on that device unless explicitly shared via a link.

## Releasing updates

Since this is an installed PWA with an offline service worker, browsers only notice a new version when `service-worker.js` itself changes byte-for-byte. Whenever you push a change to the app's files:

1. Bump `APP_VERSION` in `app.js`.
2. Bump the version suffix in `CACHE_NAME` in `service-worker.js` (e.g. `formshare-v1.2.0`) to match.
3. Commit and push.

Installed users can then tap **Check for updates** at the bottom of the home screen to pull in the new version immediately, instead of waiting for the browser to notice on its own.

As of v1.2.0, the service worker fetches the app's own code (HTML/CSS/JS) network-first and only falls back to the cache when offline, so a device that's online picks up new releases automatically on the next open — the "Check for updates" button and manual cache-clearing are now just a fallback for when you're offline or want it immediately.

## Backups & long-term storage

There's no server and no account — every form, submission, and business profile lives only in this browser's local storage on this one device. That has a few consequences worth knowing about if you use this for years:

- **No cross-device sync.** Losing or replacing your phone loses this data unless you've backed it up. Use **Back up my data** at the bottom of the home screen periodically (especially before a phone upgrade) — it downloads one JSON file with everything, and **Restore a backup** loads it back in (on this device or a new one).
- **Mobile Safari can evict storage after inactivity.** If you're using this as a bookmarked Safari tab rather than an installed home-screen app, iOS can clear local storage after about a week of not opening it. Installing it via Add to Home Screen (see above) avoids this.
- **Storage has a limit** (commonly 5-10MB on mobile Safari). Each signed submission includes an embedded signature image, so thousands of old submissions over the years can add up. If storage fills up, the app will tell you rather than silently losing data — at that point, back up, then delete old submissions you no longer need (open a submission → Delete Submission).

## Enabling GitHub Pages

To publish this app, enable GitHub Pages for this repository:

1. Go to **Settings → Pages**
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**
3. Set the branch to **main** and the folder to **/ (root)**
4. Save

Once enabled, the app will be published at:

https://officework5868-pixel.github.io/form-share/
