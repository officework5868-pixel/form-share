# FormShare

FormShare is an offline, installable Progressive Web App (PWA) for designing forms and collecting signed submissions — with no backend, database, or account.

There are two roles:

- **You (the sender)** design a form with a drag-free field builder — short/long text, phone, email, number, date, a "choose one of these specific dates" field (for class or appointment sign-ups), a terms-and-agreement block, and a signature pad — then either fill it out yourself, or send the **blank form as a link** for someone else to fill out.
- **The recipient** opens that link (no app or account needed), fills in their own info, picks a date, agrees to your terms, and signs with a finger or mouse. Submitting gives them a **link back** to the completed, signed form, which they text or email to you.
- **You** open that link and tap **Save to My Forms** to keep a permanent local copy, downloadable as a PNG or PDF.

Since there's no backend, every link carries the form's structure (and, for a completed submission, its answers and signature) encoded directly in the URL — nothing is uploaded anywhere. Signatures are downscaled and compressed before being embedded so links stay a reasonable length for SMS and email.

- **Form builder**: build any form from scratch — add, remove, reorder, and configure fields of any type — or start from one of three starter templates (Business Form, Customer Business Info, Class Sign-Up Form).
- **Download**: export any submission as a PNG or a PDF. The PDF is generated entirely client-side (a hand-built single-page PDF wrapping a JPEG snapshot) — no library, no network call, works offline.
- **Share**: the native share sheet, a text message, or email — for both blank forms (to be filled out) and completed submissions (sent back to you).
- **Private by default**: everything lives only in the browser's local storage on that device unless explicitly shared via a link.

## Enabling GitHub Pages

To publish this app, enable GitHub Pages for this repository:

1. Go to **Settings → Pages**
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**
3. Set the branch to **main** and the folder to **/ (root)**
4. Save

Once enabled, the app will be published at:

https://officework5868-pixel.github.io/form-share/
