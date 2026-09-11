"use strict";

/* ---------- Storage ---------- */
const TEMPLATES_KEY = "formshare_templates_v2";
const ENTRIES_KEY = "formshare_entries_v2";
const BUSINESSES_KEY = "formshare_businesses_v1";
const SEED_KEY = "formshare_seeded_v2";
const DISMISS_KEY = "formshare_install_dismissed_v1";
const APP_VERSION = "1.1.0";

function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY)) || []; }
  catch { return []; }
}
function saveTemplates(list) { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list)); }
function loadEntries() {
  try { return JSON.parse(localStorage.getItem(ENTRIES_KEY)) || []; }
  catch { return []; }
}
function saveEntries(list) { localStorage.setItem(ENTRIES_KEY, JSON.stringify(list)); }
function loadBusinesses() {
  try { return JSON.parse(localStorage.getItem(BUSINESSES_KEY)) || []; }
  catch { return []; }
}
function saveBusinesses(list) { localStorage.setItem(BUSINESSES_KEY, JSON.stringify(list)); }

let templates = loadTemplates(); // form designs you've built ("My Forms")
let entries = loadEntries();     // completed/signed submissions ("Submissions")
let businesses = loadBusinesses(); // saved business profiles (yours, or ones you manage for others)
let draft = {};                  // working copy of field values while filling out a form
let builderDraft = { id: null, name: "", accent: "#2856d6", fields: [] }; // working copy while designing a form
let businessDraft = { id: null, name: "", phone: "", email: "", address: "", accent: "#2856d6" }; // working copy while editing a business profile
const sigState = {};             // per-field signature pad state while filling

/* ---------- Utilities ---------- */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function slug(s) {
  return (String(s || "form").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")) || "form";
}
function isIOS() { return /iP(hone|ad|od)/.test(navigator.userAgent); }
const PALETTE = ["#2856d6", "#0f7a5c", "#a6335c", "#b3691e", "#5b4fc4", "#0f8a8a"];

function defaultBusiness() {
  if (!businesses.length) return null;
  return businesses.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0];
}
function setHeaderTitle(title, subtitle) {
  document.getElementById("headerTitle").textContent = title;
  const subEl = document.getElementById("headerSubtitle");
  if (subtitle) {
    subEl.textContent = subtitle;
    subEl.classList.remove("hidden");
  } else {
    subEl.textContent = "";
    subEl.classList.add("hidden");
  }
}

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

/* ---------- Date helpers ---------- */
function pad(n) { return String(n).padStart(2, "0"); }
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatDateTime(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/* ---------- Field type registry ---------- */
const FIELD_TYPE_OPTIONS = [
  { type: "text", label: "Short Text", icon: "✏️" },
  { type: "textarea", label: "Long Text", icon: "📄" },
  { type: "tel", label: "Phone Number", icon: "📞" },
  { type: "email", label: "Email", icon: "✉️" },
  { type: "number", label: "Number", icon: "#️⃣" },
  { type: "date", label: "Date", icon: "📅" },
  { type: "dateChoice", label: "Choose a Date", icon: "🗓️" },
  { type: "terms", label: "Terms & Agreement", icon: "📜" },
  { type: "signature", label: "Signature", icon: "✍️" }
];
function fieldTypeLabel(type) {
  const opt = FIELD_TYPE_OPTIONS.find(o => o.type === type);
  return opt ? opt.label : type;
}
function defaultLabelForType(type) {
  return {
    text: "Short Answer", textarea: "Long Answer", tel: "Phone Number", email: "Email Address",
    number: "Number", date: "Date", dateChoice: "Choose a Date", terms: "Terms & Agreement", signature: "Signature"
  }[type] || "Field";
}

function defaultDataForFields(fields) {
  const data = {};
  fields.forEach(f => {
    if (f.type === "signature" || f.type === "terms") { data[f.id] = ""; return; }
    if (f.default === "today") data[f.id] = todayISO();
    else data[f.id] = f.default || "";
  });
  return data;
}

/* ---------- Starter templates (seeded once, fully editable/deletable afterward) ---------- */
const STARTER_TEMPLATES = [
  {
    name: "Business Form",
    fields: [
      { type: "text", label: "Form Title", placeholder: "Invoice, Receipt, Estimate...", default: "Service Form" },
      { type: "text", label: "Business Name", placeholder: "e.g. Riverside Plumbing", required: true },
      { type: "tel", label: "Business Phone", placeholder: "(555) 123-4567" },
      { type: "email", label: "Business Email", placeholder: "you@business.com" },
      { type: "textarea", label: "Business Address", placeholder: "Street, City, State ZIP" },
      { type: "text", label: "Client / Customer Name", placeholder: "Who is this for?" },
      { type: "date", label: "Date", default: "today" },
      { type: "textarea", label: "Details / Description", placeholder: "Work performed, items, services..." },
      { type: "text", label: "Amount / Total", placeholder: "$0.00" },
      { type: "textarea", label: "Notes / Terms", placeholder: "Payment terms, warranty, thank-you note..." }
    ]
  },
  {
    name: "Customer Business Info",
    fields: [
      { type: "text", label: "Store / Business Name", placeholder: "e.g. Maya's Bakery", required: true },
      { type: "text", label: "Owner / Contact Name", placeholder: "Full name" },
      { type: "tel", label: "Phone Number", placeholder: "(555) 123-4567" },
      { type: "email", label: "Email Address", placeholder: "name@store.com" },
      { type: "textarea", label: "Business Address", placeholder: "Street, City, State ZIP" },
      { type: "text", label: "Type of Business", placeholder: "e.g. Bakery, Salon, Retail" },
      { type: "text", label: "Website / Social Media", placeholder: "@handle or url" },
      { type: "date", label: "Date", default: "today" },
      { type: "textarea", label: "Additional Notes", placeholder: "Anything else to share..." }
    ]
  },
  {
    name: "Class Sign-Up Form",
    fields: [
      { type: "text", label: "Full Name", required: true },
      { type: "tel", label: "Phone Number" },
      { type: "email", label: "Email Address" },
      { type: "dateChoice", label: "Choose a Date", required: true, options: ["Sat, Sept 20 — 10:00 AM", "Sat, Sept 27 — 10:00 AM", "Sat, Oct 4 — 10:00 AM"] },
      { type: "textarea", label: "Notes / Special Requests" },
      { type: "terms", label: "Terms & Agreement", required: true, termsText: "By signing below, I confirm my registration for the selected class date and agree to the studio's cancellation and refund policy." },
      { type: "signature", label: "Signature", required: true }
    ]
  }
];

function ensureSeedTemplates() {
  if (localStorage.getItem(SEED_KEY)) return;
  localStorage.setItem(SEED_KEY, "1");
  if (templates.length > 0) return;
  const now = Date.now();
  templates = STARTER_TEMPLATES.map((t, i) => ({
    id: uid(),
    name: t.name,
    accent: PALETTE[i % PALETTE.length],
    fields: t.fields.map(f => ({ ...f, id: uid() })),
    createdAt: now + i,
    updatedAt: now + i
  }));
  saveTemplates(templates);
}

/* ---------- Sharing via link (data encoded directly in the URL, no server) ---------- */
function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function toUrlSafeB64(b64) { return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function fromUrlSafeB64(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return s;
}
function encodeShareData(payload) {
  return toUrlSafeB64(bytesToBase64(new TextEncoder().encode(JSON.stringify(payload))));
}
function decodeShareData(str) {
  return JSON.parse(new TextDecoder().decode(base64ToBytes(fromUrlSafeB64(str))));
}
// kind: "template" -> a blank form for someone else to fill out and sign
// kind: "submission" -> a completed, signed form being sent back
function buildShareLink(template, data, kind) {
  const base = location.href.split("#")[0];
  const payload = kind === "template"
    ? { k: "template", name: template.name, accent: template.accent, fields: template.fields }
    : { k: "submission", name: template.name, accent: template.accent, fields: template.fields, data };
  const path = kind === "template" ? "fill" : "view";
  return `${base}#/${path}?f=${encodeShareData(payload)}`;
}
function clearSharedHash() {
  if (location.hash.startsWith("#/view") || location.hash.startsWith("#/fill")) {
    history.replaceState(null, "", location.pathname + location.search);
  }
}
function tryLoadSharedLink() {
  const m = location.hash.match(/^#\/(view|fill)\?f=(.+)$/);
  if (!m) return false;
  try {
    const payload = decodeShareData(decodeURIComponent(m[2]));
    if (!payload || !Array.isArray(payload.fields)) return false;
    const snapshot = { name: payload.name || "Form", accent: payload.accent || "#2856d6", fields: payload.fields };
    if (m[1] === "fill" || payload.k === "template") {
      draft = defaultDataForFields(snapshot.fields);
      state = { view: "fill", formId: null, templateId: null, templateSnapshot: snapshot };
    } else {
      draft = { ...defaultDataForFields(snapshot.fields), ...(payload.data || {}) };
      state = { view: "preview", formId: null, templateId: null, templateSnapshot: snapshot };
    }
    return true;
  } catch {
    return false;
  }
}

/* ---------- State / Router ---------- */
let state = { view: "home", formId: null, templateId: null, templateSnapshot: null };

function navigate(view, opts = {}) {
  if (view === "home") clearSharedHash();
  state = { view, formId: null, templateId: null, templateSnapshot: null, ...opts };
  render();
  window.scrollTo(0, 0);
}

function goBack() {
  if (state.view === "fill") { cancelFill(); return; }
  if (state.view === "builder") { cancelBuilder(); return; }
  navigate("home");
}

/* ---------- Rendering: Home ---------- */
function firstMeaningfulValue(template, data) {
  for (const f of template.fields) {
    if (f.type === "signature" || f.type === "terms") continue;
    if (data[f.id] && String(data[f.id]).trim()) return String(data[f.id]);
  }
  return null;
}

function renderHome() {
  const homeBusiness = defaultBusiness();
  setHeaderTitle("FormShare", homeBusiness ? homeBusiness.name : null);
  document.getElementById("backBtn").classList.add("hidden");
  document.getElementById("newFormBtn").classList.remove("hidden");

  const sortedBusinesses = businesses.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const businessCards = sortedBusinesses.map(b => `
    <div class="form-card" onclick="openBusinessEditor('${b.id}')">
      <div class="form-card-icon" style="background:${b.accent || "#2856d6"}">🏢</div>
      <div class="form-card-body">
        <div class="form-card-title">${escapeHtml(b.name)}</div>
        <div class="form-card-sub">${escapeHtml(b.phone || b.email || "Tap to edit")}</div>
      </div>
    </div>`).join("");

  const sortedTemplates = templates.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const tplCards = sortedTemplates.map(t => `
    <div class="form-card" onclick="navigate('templateDetail', {templateId:'${t.id}'})">
      <div class="form-card-icon" style="background:${t.accent || "#2856d6"}">📝</div>
      <div class="form-card-body">
        <div class="form-card-title">${escapeHtml(t.name)}</div>
        <div class="form-card-sub">${t.fields.length} field${t.fields.length === 1 ? "" : "s"}</div>
      </div>
    </div>`).join("");

  const sortedEntries = entries.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const entryCards = sortedEntries.map(e => {
    const primary = firstMeaningfulValue(e.templateSnapshot, e.data) || "Untitled";
    return `
      <div class="form-card" onclick="navigate('preview', {formId:'${e.id}'})">
        <div class="form-card-icon" style="background:${e.templateSnapshot.accent || "#2856d6"}">✅</div>
        <div class="form-card-body">
          <div class="form-card-title">${escapeHtml(primary)}</div>
          <div class="form-card-sub">${escapeHtml(e.templateSnapshot.name)}</div>
          <div class="form-card-date">Updated ${formatDateTime(e.updatedAt)}</div>
        </div>
      </div>`;
  }).join("");

  return `
    <div class="section-title" style="margin-top:2px;">My Businesses</div>
    ${businesses.length ? businessCards : `<div class="empty-state" style="padding:20px 10px;">Save your business info (or a friend's) once, then fill it into any form in one tap.</div>`}
    <button class="btn btn-secondary btn-full" style="margin:6px 0 26px;" onclick="openBusinessEditor(null)">+ Add a Business</button>

    <div class="section-title">My Forms</div>
    ${templates.length ? tplCards : `<div class="empty-state" style="padding:20px 10px;">No forms yet — design one to get started.</div>`}
    <button class="btn btn-secondary btn-full" style="margin:6px 0 26px;" onclick="startNewTemplate()">+ Design a New Form</button>

    <div class="section-title">Submissions</div>
    ${entries.length ? entryCards : `<div class="empty-state" style="padding:20px 10px;">Completed, signed forms — yours or sent back to you — will show up here.</div>`}

    <div class="footer-note">FormShare v${APP_VERSION} · <button class="footer-link" onclick="checkForUpdates()">Check for updates</button></div>
  `;
}

function startNewTemplate() {
  builderDraft = { id: null, name: "", accent: PALETTE[templates.length % PALETTE.length], fields: [] };
  navigate("builder", {});
}

/* ---------- Rendering: Template Detail ---------- */
function renderTemplateDetail() {
  const tpl = templates.find(t => t.id === state.templateId);
  if (!tpl) { navigate("home"); return ""; }
  setHeaderTitle(tpl.name, null);
  document.getElementById("backBtn").classList.remove("hidden");
  document.getElementById("newFormBtn").classList.add("hidden");

  const fieldSummary = tpl.fields.map(f => `
    <li>${escapeHtml(f.label)}${f.required ? " *" : ""} <span class="field-type-tag">${fieldTypeLabel(f.type)}</span></li>`).join("");

  return `
    <div class="form-type-banner" style="background:${tpl.accent || "#2856d6"}">
      <span class="form-type-icon">📝</span>
      <div>
        <div class="form-type-name">${escapeHtml(tpl.name)}</div>
        <div class="form-type-desc">${tpl.fields.length} field${tpl.fields.length === 1 ? "" : "s"}</div>
      </div>
    </div>
    <div class="fields-card">
      <div class="section-title" style="margin-top:0;">Fields in this form</div>
      <ul class="field-summary-list">${fieldSummary}</ul>
    </div>
    <button class="btn btn-primary btn-full" style="margin-bottom:8px;" onclick="fillTemplateMyself('${tpl.id}')">Fill it out myself</button>
    <button class="btn btn-secondary btn-full" style="margin-bottom:8px;" onclick="openTemplateShareModal('${tpl.id}')">Send blank form to someone</button>
    <button class="btn btn-secondary btn-full" style="margin-bottom:8px;" onclick="editTemplate('${tpl.id}')">Edit Fields</button>
    <button class="btn btn-danger btn-full" onclick="deleteTemplate('${tpl.id}')">Delete Form</button>
  `;
}

function fillTemplateMyself(templateId) {
  const tpl = templates.find(t => t.id === templateId);
  if (!tpl) return;
  draft = defaultDataForFields(tpl.fields);
  navigate("fill", { templateSnapshot: { id: tpl.id, name: tpl.name, accent: tpl.accent, fields: tpl.fields } });
}

function editTemplate(templateId) {
  const tpl = templates.find(t => t.id === templateId);
  if (!tpl) return;
  builderDraft = { id: tpl.id, name: tpl.name, accent: tpl.accent, fields: tpl.fields.map(f => ({ ...f, options: f.options ? [...f.options] : undefined })) };
  navigate("builder", {});
}

function deleteTemplate(templateId) {
  if (!confirm("Delete this form design? Submissions already saved from it will be kept.")) return;
  templates = templates.filter(t => t.id !== templateId);
  saveTemplates(templates);
  navigate("home");
  showToast("Form deleted");
}

/* ---------- Business Profiles (yours, or one you manage for someone else) ---------- */
function openBusinessEditor(businessId) {
  const existing = businessId ? businesses.find(b => b.id === businessId) : null;
  businessDraft = existing
    ? { ...existing }
    : { id: null, name: "", phone: "", email: "", address: "", accent: PALETTE[businesses.length % PALETTE.length] };
  renderBusinessEditorModal();
}

function updateBusinessDraft(prop, value) { businessDraft[prop] = value; }
function selectBusinessColor(c) { businessDraft.accent = c; renderBusinessEditorModal(); }

function renderBusinessEditorModal() {
  const isEdit = !!businessDraft.id;
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-sheet">
        <div class="modal-head">
          <h3>${isEdit ? "Edit Business" : "Add a Business"}</h3>
          <button class="icon-btn small" onclick="closeModal()" style="color:#1f2430;background:#eef1f7;">×</button>
        </div>
        <div class="field">
          <label>Business Name</label>
          <input type="text" value="${escapeHtml(businessDraft.name)}" placeholder="e.g. Riverside Plumbing, or a friend's business" oninput="updateBusinessDraft('name', this.value)" />
        </div>
        <div class="field">
          <label>Phone</label>
          <input type="tel" value="${escapeHtml(businessDraft.phone)}" placeholder="(555) 123-4567" oninput="updateBusinessDraft('phone', this.value)" />
        </div>
        <div class="field">
          <label>Email</label>
          <input type="email" value="${escapeHtml(businessDraft.email)}" placeholder="you@business.com" oninput="updateBusinessDraft('email', this.value)" />
        </div>
        <div class="field">
          <label>Address</label>
          <textarea rows="2" placeholder="Street, City, State ZIP" oninput="updateBusinessDraft('address', this.value)">${escapeHtml(businessDraft.address)}</textarea>
        </div>
        <div class="field">
          <label>Color</label>
          <div class="color-row">
            ${PALETTE.map(c => `<div class="color-dot ${businessDraft.accent === c ? "selected" : ""}" style="background:${c}" onclick="selectBusinessColor('${c}')"></div>`).join("")}
          </div>
        </div>
        <button class="btn btn-primary btn-full" style="margin-bottom:8px;" onclick="saveBusiness()">Save Business</button>
        ${isEdit ? `<button class="btn btn-danger btn-full" onclick="deleteBusiness()">Delete Business</button>` : ""}
      </div>
    </div>`;
}

function saveBusiness() {
  if (!businessDraft.name.trim()) { showToast("Please name this business"); return; }
  const now = Date.now();
  if (businessDraft.id) {
    businesses = businesses.map(b => b.id === businessDraft.id ? { ...businessDraft, name: businessDraft.name.trim(), updatedAt: now } : b);
  } else {
    businesses.push({ ...businessDraft, id: uid(), name: businessDraft.name.trim(), createdAt: now, updatedAt: now });
  }
  saveBusinesses(businesses);
  closeModal();
  render();
  showToast("Business saved");
}

function deleteBusiness() {
  if (!businessDraft.id) return;
  if (!confirm("Delete this business profile? Forms already filled out won't be affected.")) return;
  businesses = businesses.filter(b => b.id !== businessDraft.id);
  saveBusinesses(businesses);
  closeModal();
  render();
  showToast("Business deleted");
}

// Matches a form field's label to a business-profile property, so "Fill in
// business info" works on any form regardless of who designed it — as long
// as the label isn't clearly about the other party (customer/client).
function businessFieldMatch(label) {
  const l = label.toLowerCase();
  if (l.includes("customer") || l.includes("client")) return null;
  if (l.includes("name") && (l.includes("business") || l.includes("store") || l.includes("company"))) return "name";
  if (l.includes("phone")) return "phone";
  if (l.includes("email")) return "email";
  if (l.includes("address")) return "address";
  return null;
}

function applyBusinessById(businessId) {
  const business = businesses.find(b => b.id === businessId);
  if (!business) return;
  const tpl = state.templateSnapshot;
  if (!tpl) return;
  let matched = 0;
  tpl.fields.forEach(f => {
    if (f.type === "signature" || f.type === "terms" || f.type === "dateChoice") return;
    const prop = businessFieldMatch(f.label);
    if (prop && business[prop]) { draft[f.id] = business[prop]; matched++; }
  });
  closeModal();
  render();
  showToast(matched ? `Filled in ${business.name}'s info` : "No matching fields found on this form");
}

function fillWithBusiness() {
  if (businesses.length === 1) { applyBusinessById(businesses[0].id); return; }
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-sheet">
        <div class="modal-head">
          <h3>Fill in which business?</h3>
          <button class="icon-btn small" onclick="closeModal()" style="color:#1f2430;background:#eef1f7;">×</button>
        </div>
        ${businesses.slice().sort((a, b) => b.updatedAt - a.updatedAt).map(b => `
          <div class="type-pick-card" onclick="applyBusinessById('${b.id}')">
            <div class="type-pick-icon" style="background:${b.accent || "#2856d6"}">🏢</div>
            <div>
              <div class="type-pick-name">${escapeHtml(b.name)}</div>
              <div class="type-pick-desc">${escapeHtml(b.phone || b.email || "")}</div>
            </div>
          </div>`).join("")}
      </div>
    </div>`;
}

/* ---------- Sharing a blank template ---------- */
function openTemplateShareModal(templateId) {
  const tpl = templates.find(t => t.id === templateId);
  if (!tpl) return;
  const link = buildShareLink(tpl, null, "template");
  const text = `Please fill out this form: ${tpl.name}\n\n${link}\n\nSent from FormShare`;
  const encoded = encodeURIComponent(text);
  const subject = encodeURIComponent(`Please fill out: ${tpl.name}`);
  const smsHref = isIOS() ? `sms:&body=${encoded}` : `sms:?body=${encoded}`;

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-sheet">
        <div class="modal-head">
          <h3>Send "${escapeHtml(tpl.name)}"</h3>
          <button class="icon-btn small" onclick="closeModal()" style="color:#1f2430;background:#eef1f7;">×</button>
        </div>
        <div class="share-text-box">${escapeHtml(link)}</div>
        <button class="btn btn-primary btn-full" style="margin-bottom:8px;" onclick="nativeShareTemplate('${tpl.id}')">📤 Share via Messages / Email / Apps</button>
        <a class="btn btn-secondary btn-full" style="margin-bottom:8px; display:block; text-align:center; text-decoration:none; box-sizing:border-box;" href="${smsHref}">Text message</a>
        <a class="btn btn-secondary btn-full" style="margin-bottom:8px; display:block; text-align:center; text-decoration:none; box-sizing:border-box;" href="mailto:?subject=${subject}&body=${encoded}">Email</a>
        <button class="btn btn-ghost btn-full" onclick="copyTemplateLink('${tpl.id}')">Copy link</button>
      </div>
    </div>`;
}

async function nativeShareTemplate(templateId) {
  const tpl = templates.find(t => t.id === templateId);
  if (!tpl) return;
  const link = buildShareLink(tpl, null, "template");
  if (navigator.share) {
    try {
      await navigator.share({ title: `Please fill out: ${tpl.name}`, text: `Please fill out this form: ${tpl.name}`, url: link });
      return;
    } catch (err) {
      if (err && err.name !== "AbortError") showToast("Couldn't open share sheet");
      return;
    }
  }
  showToast("Sharing isn't supported in this browser — try Copy link instead");
}

async function copyTemplateLink(templateId) {
  const tpl = templates.find(t => t.id === templateId);
  if (!tpl) return;
  try {
    await navigator.clipboard.writeText(buildShareLink(tpl, null, "template"));
    showToast("Link copied to clipboard");
  } catch {
    showToast("Couldn't copy — select and copy manually");
  }
}

/* ---------- Rendering: Fill ---------- */
function updateDraft(key, value) { draft[key] = value; }

function fieldFillHtml(f) {
  const val = draft[f.id] ?? "";
  switch (f.type) {
    case "textarea":
      return `<textarea id="fld_${f.id}" rows="${f.rows || 3}" placeholder="${escapeHtml(f.placeholder || "")}" oninput="updateDraft('${f.id}', this.value)">${escapeHtml(val)}</textarea>`;
    case "dateChoice":
      return `<div class="choice-list">${
        (f.options || []).length
          ? f.options.map(opt => `
            <label class="choice-row">
              <input type="radio" name="fld_${f.id}" value="${escapeHtml(opt)}" ${val === opt ? "checked" : ""} onchange="updateDraft('${f.id}', this.value)" />
              <span>${escapeHtml(opt)}</span>
            </label>`).join("")
          : `<div class="choice-empty">No date options were set for this field.</div>`
      }</div>`;
    case "terms":
      return `
        <div class="terms-box">${escapeHtml(f.termsText || "")}</div>
        <label class="agree-row">
          <input type="checkbox" id="fld_${f.id}" ${val === "agreed" ? "checked" : ""} onchange="updateDraft('${f.id}', this.checked ? 'agreed' : '')" />
          <span>I have read and agree to the terms above.</span>
        </label>`;
    case "signature":
      return `
        <canvas id="sig_${f.id}" class="sig-pad" width="600" height="180"
          onpointerdown="sigStart(event,'${f.id}')" onpointermove="sigMove(event,'${f.id}')"
          onpointerup="sigEnd(event,'${f.id}')" onpointerleave="sigEnd(event,'${f.id}')"></canvas>
        <button type="button" class="btn btn-ghost" style="margin-top:6px;" onclick="sigClear('${f.id}')">Clear signature</button>`;
    default:
      return `<input type="${f.type}" id="fld_${f.id}" value="${escapeHtml(val)}" placeholder="${escapeHtml(f.placeholder || "")}" oninput="updateDraft('${f.id}', this.value)" />`;
  }
}

function renderFillFields(fields) {
  return fields.map(f => `
    <div class="field">
      <label>${escapeHtml(f.label)}${f.required ? " *" : ""}</label>
      ${fieldFillHtml(f)}
    </div>`).join("");
}

function renderFill() {
  const tpl = state.templateSnapshot;
  if (!tpl) { navigate("home"); return ""; }
  setHeaderTitle(state.formId ? "Edit Submission" : tpl.name, null);
  document.getElementById("backBtn").classList.remove("hidden");
  document.getElementById("newFormBtn").classList.add("hidden");

  return `
    <div class="form-type-banner" style="background:${tpl.accent || "#2856d6"}">
      <span class="form-type-icon">📝</span>
      <div><div class="form-type-name">${escapeHtml(tpl.name)}</div></div>
    </div>
    ${businesses.length ? `<button class="btn btn-secondary btn-full" style="margin-bottom:14px;" onclick="fillWithBusiness()">🏢 Fill in business info</button>` : ""}
    <div class="fields-card">${renderFillFields(tpl.fields)}</div>
    <button class="btn btn-primary btn-full" style="margin-bottom:10px;" onclick="saveDraft()">${state.formId ? "Save Changes" : "Submit"}</button>
    <button class="btn btn-ghost btn-full" onclick="cancelFill()">Cancel</button>
  `;
}

function cancelFill() {
  if (state.formId) navigate("preview", { formId: state.formId });
  else navigate("home");
}

function saveDraft() {
  const tpl = state.templateSnapshot;
  if (!tpl) return;

  // capture any signature pads present on screen into the draft
  tpl.fields.forEach(f => {
    if (f.type !== "signature") return;
    const canvas = document.getElementById(`sig_${f.id}`);
    if (!canvas) return; // not on the fill screen right now — leave existing value untouched
    const st = sigState[f.id];
    draft[f.id] = (st && st.hasInk) ? captureSignatureDataUrl(canvas) : "";
  });

  const missing = tpl.fields.filter(f => f.required && !String(draft[f.id] || "").trim());
  if (missing.length) { showToast(`Please complete: ${missing.map(f => f.label).join(", ")}`); return; }

  const now = Date.now();
  let id = state.formId;
  if (id) {
    entries = entries.map(e => e.id === id ? { ...e, data: { ...draft }, updatedAt: now } : e);
  } else {
    id = uid();
    entries.push({ id, templateSnapshot: tpl, data: { ...draft }, createdAt: now, updatedAt: now });
  }
  saveEntries(entries);
  const wasEdit = !!state.formId;
  clearSharedHash();
  navigate("preview", { formId: id });
  showToast(wasEdit ? "Saved" : "Submitted");
}

/* ---------- Signature pad ---------- */
function sigPos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (evt.clientX - rect.left) * scaleX, y: (evt.clientY - rect.top) * scaleY };
}
function sigStart(evt, key) {
  evt.preventDefault();
  const canvas = document.getElementById(`sig_${key}`);
  if (!canvas) return;
  try { canvas.setPointerCapture(evt.pointerId); } catch {}
  const pos = sigPos(canvas, evt);
  sigState[key] = { drawing: true, lastX: pos.x, lastY: pos.y, hasInk: (sigState[key] && sigState[key].hasInk) || false };
}
function sigMove(evt, key) {
  const st = sigState[key];
  if (!st || !st.drawing) return;
  evt.preventDefault();
  const canvas = document.getElementById(`sig_${key}`);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const pos = sigPos(canvas, evt);
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(st.lastX, st.lastY);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  st.lastX = pos.x;
  st.lastY = pos.y;
  st.hasInk = true;
}
function sigEnd(evt, key) {
  const st = sigState[key];
  if (st) st.drawing = false;
}
function sigClear(key) {
  const canvas = document.getElementById(`sig_${key}`);
  if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  sigState[key] = { drawing: false, hasInk: false };
  draft[key] = "";
}
// Downscale + JPEG-compress a signature before it goes into storage/links —
// a raw full-resolution PNG signature can balloon a share link to 10-15KB,
// which is too fragile for SMS/email/mailto links to carry reliably.
function captureSignatureDataUrl(canvas) {
  const targetW = 360;
  const targetH = Math.round(targetW * (canvas.height / canvas.width));
  const off = document.createElement("canvas");
  off.width = targetW;
  off.height = targetH;
  const ctx = off.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(canvas, 0, 0, targetW, targetH);
  return off.toDataURL("image/jpeg", 0.82);
}
function initSignaturePads() {
  const tpl = state.templateSnapshot;
  if (!tpl) return;
  tpl.fields.filter(f => f.type === "signature").forEach(f => {
    const canvas = document.getElementById(`sig_${f.id}`);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const existing = draft[f.id];
    if (existing) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = existing;
      sigState[f.id] = { drawing: false, hasInk: true };
    } else {
      sigState[f.id] = { drawing: false, hasInk: false };
    }
  });
}

/* ---------- Rendering: Preview ---------- */
function currentPreviewData() {
  if (state.formId) {
    const e = entries.find(x => x.id === state.formId);
    if (!e) return null;
    return { template: e.templateSnapshot, data: e.data, saved: true, formId: e.id };
  }
  if (state.templateSnapshot) return { template: state.templateSnapshot, data: draft, saved: false, formId: null };
  return null;
}

function renderPreview() {
  const cur = currentPreviewData();
  if (!cur) { navigate("home"); return ""; }
  setHeaderTitle(cur.template.name, null);
  document.getElementById("backBtn").classList.remove("hidden");
  document.getElementById("newFormBtn").classList.add("hidden");

  const bannerHtml = !cur.saved ? `
    <div class="link-banner">
      📨 You received this form via a shared link. It hasn't been saved on this device yet.
      <button class="btn btn-primary btn-full" style="margin-top:12px;" onclick="saveDraft()">Save to My Forms</button>
    </div>` : "";

  return `
    ${bannerHtml}
    <div class="preview-frame">
      <img id="previewImg" alt="${escapeHtml(cur.template.name)} preview" class="preview-img" />
    </div>
    <div class="action-row">
      <button class="btn btn-secondary" onclick="editCurrent()">Edit</button>
      <button class="btn btn-secondary" onclick="openShareModal()">Share</button>
    </div>
    <div class="action-row">
      <button class="btn btn-primary" onclick="downloadCurrentImage()">⬇ Image</button>
      <button class="btn btn-primary" onclick="downloadCurrentPdf()">⬇ PDF</button>
    </div>
    ${cur.saved ? `<button class="btn btn-danger btn-full" style="margin-top:2px;" onclick="deleteCurrentForm()">Delete Submission</button>` : ""}
    <div class="privacy-note">🔒 Saved forms stay on this device only. A shared link encodes the form's data directly in the link itself — nothing is uploaded to a server.</div>
  `;
}

async function refreshPreviewImage() {
  const cur = currentPreviewData();
  if (!cur) return;
  const canvas = await generateFormCanvas(cur.template, cur.data);
  const imgEl = document.getElementById("previewImg");
  if (imgEl) imgEl.src = canvas.toDataURL("image/png");
}

function editCurrent() {
  const cur = currentPreviewData();
  if (!cur) return;
  draft = { ...cur.data };
  navigate("fill", { templateSnapshot: cur.template, formId: cur.formId });
}

function deleteCurrentForm() {
  const cur = currentPreviewData();
  if (!cur || !cur.formId) return;
  if (!confirm("Delete this submission? This can't be undone.")) return;
  entries = entries.filter(e => e.id !== cur.formId);
  saveEntries(entries);
  navigate("home");
  showToast("Submission deleted");
}

/* ---------- Canvas rendering (on-screen preview, image export, and PDF export) ---------- */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const paragraphs = String(text).split(/\n/);
  let curY = y;
  paragraphs.forEach(para => {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) { curY += lineHeight; return; }
    let line = "";
    words.forEach(w => {
      const test = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(test).width > maxWidth) {
        ctx.fillText(line, x, curY);
        curY += lineHeight;
        line = w;
      } else {
        line = test;
      }
    });
    if (line) { ctx.fillText(line, x, curY); curY += lineHeight; }
  });
  return curY;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function generateFormCanvas(template, data) {
  const W = 1275, H = 1650; // matches US Letter aspect ratio at 150dpi
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const accent = template.accent || "#2856d6";
  const headH = 150;
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, headH);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 50px sans-serif";
  ctx.fillText(template.name || "Form", 70, 95);

  const leftX = 70, rightEdge = W - 70;
  let y = headH + 60;

  for (const f of template.fields) {
    ctx.font = "700 18px sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.fillText(f.label.toUpperCase(), leftX, y);
    y += 30;

    if (f.type === "signature") {
      const val = data[f.id];
      if (val) {
        try {
          const img = await loadImage(val);
          const boxW = 420, boxH = Math.round(boxW * 0.3);
          ctx.strokeStyle = "#e5e7eb";
          ctx.strokeRect(leftX, y, boxW, boxH);
          ctx.drawImage(img, leftX + 4, y + 4, boxW - 8, boxH - 8);
          y += boxH + 14;
        } catch {
          ctx.font = "500 24px sans-serif";
          ctx.fillStyle = "#9ca3af";
          ctx.fillText("(signature could not be loaded)", leftX, y);
          y += 34;
        }
      } else {
        ctx.font = "500 24px sans-serif";
        ctx.fillStyle = "#9ca3af";
        ctx.fillText("(not signed)", leftX, y);
        y += 34;
      }
    } else if (f.type === "terms") {
      ctx.font = "500 22px sans-serif";
      ctx.fillStyle = "#4b5563";
      y = wrapText(ctx, f.termsText || "", leftX, y, rightEdge - leftX, 28);
      y += 8;
      const agreed = data[f.id] === "agreed";
      ctx.font = "700 24px sans-serif";
      ctx.fillStyle = agreed ? "#16a34a" : "#b3261e";
      ctx.fillText(agreed ? "✓ Agreed" : "✗ Not agreed", leftX, y);
      y += 34;
    } else {
      const raw = data[f.id];
      const val = raw && String(raw).trim() ? String(raw) : "—";
      ctx.font = "500 27px sans-serif";
      ctx.fillStyle = "#1f2937";
      y = wrapText(ctx, val, leftX, y, rightEdge - leftX, 34);
    }

    y += 16;
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftX, y);
    ctx.lineTo(rightEdge, y);
    ctx.stroke();
    y += 30;
  }

  ctx.font = "500 18px sans-serif";
  ctx.fillStyle = "#9ca3af";
  ctx.fillText(`Generated ${new Date().toLocaleDateString()} · Created with FormShare`, leftX, H - 40);

  return canvas;
}

/* ---------- Export: PNG ---------- */
function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function downloadCurrentImage() {
  const cur = currentPreviewData();
  if (!cur) return;
  const canvas = await generateFormCanvas(cur.template, cur.data);
  const blob = await canvasToBlob(canvas, "image/png");
  triggerDownload(blob, `${slug(cur.template.name)}.png`);
}

/* ---------- Export: PDF (hand-built single-page PDF wrapping a JPEG — no external library needed) ---------- */
function buildPdfFromJpeg(jpegBytes, imgW, imgH) {
  const enc = new TextEncoder();
  const chunks = [];
  let offset = 0;
  const objOffsets = {};

  function add(part) {
    const bytes = typeof part === "string" ? enc.encode(part) : part;
    chunks.push(bytes);
    offset += bytes.length;
  }
  function beginObj(n) { objOffsets[n] = offset; }

  add("%PDF-1.4\n");
  add(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  beginObj(1);
  add("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  beginObj(2);
  add("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  const pageW = 612, pageH = 792; // US Letter, points
  beginObj(3);
  add(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);

  beginObj(4);
  add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  add(jpegBytes);
  add("\nendstream\nendobj\n");

  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  beginObj(5);
  add(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

  const xrefStart = offset;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) xref += `${String(objOffsets[i]).padStart(10, "0")} 00000 n \n`;
  add(xref);
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return new Blob(chunks, { type: "application/pdf" });
}

async function downloadCurrentPdf() {
  const cur = currentPreviewData();
  if (!cur) return;
  const canvas = await generateFormCanvas(cur.template, cur.data);
  const jpegBlob = await canvasToBlob(canvas, "image/jpeg", 0.92);
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const pdfBlob = buildPdfFromJpeg(jpegBytes, canvas.width, canvas.height);
  triggerDownload(pdfBlob, `${slug(cur.template.name)}.pdf`);
}

/* ---------- Sharing a completed submission ---------- */
function closeModal() { document.getElementById("modalRoot").innerHTML = ""; }

function openShareModal() {
  const cur = currentPreviewData();
  if (!cur) return;
  const link = buildShareLink(cur.template, cur.data, "submission");
  const text = `${cur.template.name} — completed form\n\nView / download: ${link}\n\nSent from FormShare`;
  const encoded = encodeURIComponent(text);
  const subject = encodeURIComponent(cur.template.name);
  const smsHref = isIOS() ? `sms:&body=${encoded}` : `sms:?body=${encoded}`;

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-sheet">
        <div class="modal-head">
          <h3>Share ${escapeHtml(cur.template.name)}</h3>
          <button class="icon-btn small" onclick="closeModal()" style="color:#1f2430;background:#eef1f7;">×</button>
        </div>
        <div class="share-text-box">${escapeHtml(link)}</div>
        <button class="btn btn-primary btn-full" style="margin-bottom:8px;" onclick="nativeShareForm()">📤 Share via Messages / Email / Apps</button>
        <a class="btn btn-secondary btn-full" style="margin-bottom:8px; display:block; text-align:center; text-decoration:none; box-sizing:border-box;" href="${smsHref}">Text message</a>
        <a class="btn btn-secondary btn-full" style="margin-bottom:8px; display:block; text-align:center; text-decoration:none; box-sizing:border-box;" href="mailto:?subject=${subject}&body=${encoded}">Email</a>
        <button class="btn btn-ghost btn-full" onclick="copyShareLink()">Copy link</button>
      </div>
    </div>`;
}

async function nativeShareForm() {
  const cur = currentPreviewData();
  if (!cur) return;
  const title = cur.template.name;
  const link = buildShareLink(cur.template, cur.data, "submission");

  try {
    const canvas = await generateFormCanvas(cur.template, cur.data);
    const blob = await canvasToBlob(canvas, "image/png");
    const file = new File([blob], `${slug(title)}.png`, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title, text: `${title} — view or download: ${link}`, files: [file] });
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return;
  }

  if (navigator.share) {
    try {
      await navigator.share({ title, text: `${title} — completed form`, url: link });
      return;
    } catch (err) {
      if (err && err.name !== "AbortError") showToast("Couldn't open share sheet");
      return;
    }
  }
  showToast("Sharing isn't supported in this browser — try Copy link or Download instead");
}

async function copyShareLink() {
  const cur = currentPreviewData();
  if (!cur) return;
  try {
    await navigator.clipboard.writeText(buildShareLink(cur.template, cur.data, "submission"));
    showToast("Link copied to clipboard");
  } catch {
    showToast("Couldn't copy — select and copy manually");
  }
}

/* ---------- Rendering: Form Builder ---------- */
function renderBuilder() {
  setHeaderTitle(builderDraft.id ? "Edit Form" : "New Form", null);
  document.getElementById("backBtn").classList.remove("hidden");
  document.getElementById("newFormBtn").classList.add("hidden");

  const fieldRows = builderDraft.fields.map((f, i) => `
    <div class="builder-field-card">
      <div class="builder-field-head">
        <span class="field-type-tag">${fieldTypeLabel(f.type)}</span>
        <div class="builder-field-actions">
          <button type="button" class="icon-btn small" onclick="moveField('${f.id}', -1)" ${i === 0 ? "disabled" : ""}>↑</button>
          <button type="button" class="icon-btn small" onclick="moveField('${f.id}', 1)" ${i === builderDraft.fields.length - 1 ? "disabled" : ""}>↓</button>
          <button type="button" class="icon-btn small" onclick="removeField('${f.id}')">×</button>
        </div>
      </div>
      <div class="field">
        <label>Field Label</label>
        <input type="text" value="${escapeHtml(f.label)}" oninput="updateFieldProp('${f.id}','label', this.value)" />
      </div>
      ${f.type !== "signature" && f.type !== "terms" && f.type !== "dateChoice" ? `
      <div class="field">
        <label>Placeholder (optional)</label>
        <input type="text" value="${escapeHtml(f.placeholder || "")}" oninput="updateFieldProp('${f.id}','placeholder', this.value)" />
      </div>` : ""}
      ${f.type === "terms" ? `
      <div class="field">
        <label>Terms Text</label>
        <textarea rows="4" oninput="updateFieldProp('${f.id}','termsText', this.value)">${escapeHtml(f.termsText || "")}</textarea>
      </div>` : ""}
      ${f.type === "dateChoice" ? `
      <div class="field">
        <label>Date Options</label>
        ${(f.options || []).map((opt, oi) => `
          <div class="option-row">
            <input type="text" value="${escapeHtml(opt)}" placeholder="e.g. Sat, Sept 20 - 10am" oninput="updateFieldOption('${f.id}', ${oi}, this.value)" />
            <button type="button" class="icon-btn small" onclick="removeFieldOption('${f.id}', ${oi})">×</button>
          </div>`).join("")}
        <button type="button" class="btn btn-ghost" onclick="addFieldOption('${f.id}')">+ Add date option</button>
      </div>` : ""}
      <label class="required-row">
        <input type="checkbox" ${f.required ? "checked" : ""} onchange="toggleFieldRequired('${f.id}', this.checked)" ${(f.type === "terms" || f.type === "signature") ? "disabled" : ""} />
        <span>Required</span>
      </label>
    </div>`).join("");

  return `
    <div class="fields-card">
      <div class="field">
        <label>Form Name</label>
        <input type="text" id="builderName" value="${escapeHtml(builderDraft.name)}" placeholder="e.g. Class Sign-Up Form" oninput="updateBuilderName(this.value)" />
      </div>
      <div class="field">
        <label>Color</label>
        <div class="color-row">
          ${PALETTE.map(c => `<div class="color-dot ${builderDraft.accent === c ? "selected" : ""}" style="background:${c}" onclick="selectBuilderColor('${c}')"></div>`).join("")}
        </div>
      </div>
    </div>

    ${fieldRows}

    <button class="btn btn-secondary btn-full" style="margin-bottom:14px;" onclick="openAddFieldPicker()">+ Add Field</button>
    <button class="btn btn-primary btn-full" style="margin-bottom:10px;" onclick="saveTemplate()">Save Form</button>
    <button class="btn btn-ghost btn-full" onclick="cancelBuilder()">Cancel</button>
  `;
}

function updateBuilderName(v) { builderDraft.name = v; }
function selectBuilderColor(c) { builderDraft.accent = c; render(); }
function updateFieldProp(fieldId, prop, value) {
  const f = builderDraft.fields.find(x => x.id === fieldId);
  if (f) f[prop] = value;
}
function toggleFieldRequired(fieldId, val) {
  const f = builderDraft.fields.find(x => x.id === fieldId);
  if (f) f.required = val;
}
function updateFieldOption(fieldId, idx, value) {
  const f = builderDraft.fields.find(x => x.id === fieldId);
  if (f && f.options) f.options[idx] = value;
}
function addFieldOption(fieldId) {
  const f = builderDraft.fields.find(x => x.id === fieldId);
  if (!f) return;
  f.options = f.options || [];
  f.options.push("");
  render();
}
function removeFieldOption(fieldId, idx) {
  const f = builderDraft.fields.find(x => x.id === fieldId);
  if (f && f.options) { f.options.splice(idx, 1); render(); }
}
function moveField(fieldId, dir) {
  const idx = builderDraft.fields.findIndex(f => f.id === fieldId);
  const newIdx = idx + dir;
  if (idx < 0 || newIdx < 0 || newIdx >= builderDraft.fields.length) return;
  const [item] = builderDraft.fields.splice(idx, 1);
  builderDraft.fields.splice(newIdx, 0, item);
  render();
}
function removeField(fieldId) {
  builderDraft.fields = builderDraft.fields.filter(f => f.id !== fieldId);
  render();
}
function cancelBuilder() { navigate("home"); }

function openAddFieldPicker() {
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-sheet">
        <div class="modal-head">
          <h3>Add Field</h3>
          <button class="icon-btn small" onclick="closeModal()" style="color:#1f2430;background:#eef1f7;">×</button>
        </div>
        ${FIELD_TYPE_OPTIONS.map(o => `
          <div class="type-pick-card" onclick="addField('${o.type}')">
            <div class="type-pick-icon" style="background:${builderDraft.accent || "#2856d6"}">${o.icon}</div>
            <div class="type-pick-name">${escapeHtml(o.label)}</div>
          </div>`).join("")}
      </div>
    </div>`;
}

function addField(type) {
  const f = { id: uid(), type, label: defaultLabelForType(type), required: type === "terms" || type === "signature" };
  if (type === "dateChoice") f.options = ["", ""];
  if (type === "terms") f.termsText = "";
  builderDraft.fields.push(f);
  closeModal();
  render();
}

function saveTemplate() {
  if (!builderDraft.name.trim()) { showToast("Please name this form"); return; }
  if (builderDraft.fields.length === 0) { showToast("Add at least one field"); return; }
  for (const f of builderDraft.fields) {
    if (f.type === "dateChoice" && (!f.options || f.options.filter(o => o.trim()).length === 0)) {
      showToast(`Add at least one date option for "${f.label}"`);
      return;
    }
    if (f.type === "terms" && !(f.termsText || "").trim()) {
      showToast(`Add the terms text for "${f.label}"`);
      return;
    }
  }

  const now = Date.now();
  const cleanFields = builderDraft.fields.map(f => f.type === "dateChoice" ? { ...f, options: f.options.filter(o => o.trim()) } : f);
  let id = builderDraft.id;
  if (id) {
    templates = templates.map(t => t.id === id ? { ...t, name: builderDraft.name.trim(), accent: builderDraft.accent, fields: cleanFields, updatedAt: now } : t);
  } else {
    id = uid();
    templates.push({ id, name: builderDraft.name.trim(), accent: builderDraft.accent, fields: cleanFields, createdAt: now, updatedAt: now });
  }
  saveTemplates(templates);
  navigate("home");
  showToast("Form saved");
}

/* ---------- Render dispatch ---------- */
function render() {
  const app = document.getElementById("app");
  if (state.view === "fill") {
    app.innerHTML = renderFill();
    initSignaturePads();
  } else if (state.view === "builder") {
    app.innerHTML = renderBuilder();
  } else if (state.view === "templateDetail") {
    app.innerHTML = renderTemplateDetail();
  } else if (state.view === "preview") {
    app.innerHTML = renderPreview();
    refreshPreviewImage();
  } else {
    app.innerHTML = renderHome();
  }
}

document.getElementById("backBtn").addEventListener("click", goBack);
document.getElementById("newFormBtn").addEventListener("click", () => startNewTemplate());

/* ---------- Install banner ---------- */
let deferredInstallPrompt = null;

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function initInstallBanner() {
  if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;
  document.getElementById("installBanner").classList.remove("hidden");
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

document.getElementById("installDismissBtn").addEventListener("click", () => {
  localStorage.setItem(DISMISS_KEY, "1");
  document.getElementById("installBanner").classList.add("hidden");
});

document.getElementById("installHowBtn").addEventListener("click", openInstallHelp);

function openInstallHelp() {
  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-sheet">
        <div class="modal-head">
          <h3>Add to your phone</h3>
          <button class="icon-btn small" onclick="closeModal()" style="color:#1f2430;background:#eef1f7;">×</button>
        </div>
        ${deferredInstallPrompt ? `<button class="btn btn-primary btn-full" style="margin-bottom:14px;" onclick="triggerInstall()">Install now</button>` : ""}
        <div class="install-steps">
          <h4>📱 iPhone / iPad (Safari)</h4>
          <ol>
            <li>Tap the Share icon (square with an arrow) in Safari's toolbar.</li>
            <li>Scroll down and tap "Add to Home Screen".</li>
            <li>Tap "Add" — the app icon appears on your home screen.</li>
          </ol>
          <h4>🤖 Android (Chrome)</h4>
          <ol>
            <li>Tap the ⋮ menu in the top right of Chrome.</li>
            <li>Tap "Install app" or "Add to Home screen".</li>
            <li>Confirm — the app icon appears on your home screen.</li>
          </ol>
          <p style="margin-top:12px; color:#6b7280;">Once installed, it opens like a normal app and works fully offline. Design a form, then use "Send blank form to someone" to text or email it — they fill it out and sign it, then send it back to you.</p>
        </div>
      </div>
    </div>`;
}

async function triggerInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  closeModal();
}

/* ---------- Service worker ---------- */
let swRegistration = null;
let swRefreshing = false;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js")
      .then(reg => { swRegistration = reg; })
      .catch(() => {});
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (swRefreshing) return;
    swRefreshing = true;
    window.location.reload();
  });
}

// Lets you pull in a newer version of the app after you've pushed changes,
// instead of staying stuck on whatever the service worker cached earlier.
async function checkForUpdates() {
  if (!("serviceWorker" in navigator)) { showToast("Updates aren't supported in this browser"); return; }
  showToast("Checking for updates…");
  try {
    const reg = swRegistration || await navigator.serviceWorker.getRegistration();
    if (!reg) { showToast("Reload the page once to enable update checks"); return; }
    await reg.update();
    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    else if (!reg.installing) showToast("You're on the latest version");
  } catch {
    showToast("Couldn't check for updates — check your connection");
  }
}

/* ---------- Init ---------- */
if (!tryLoadSharedLink()) state = { view: "home", formId: null, templateId: null, templateSnapshot: null };
ensureSeedTemplates();
initInstallBanner();
render();
