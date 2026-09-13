const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const loginBtn = document.getElementById("login-btn");
const signoutBtn = document.getElementById("signout-btn");

const STATUSES = ["new", "contacted", "approved", "declined"];

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    showDashboard();
  } else {
    showLogin();
  }
}

function showLogin() {
  loginView.hidden = false;
  dashboardView.hidden = true;
}

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  loadApplications();
  loadMembers();
  loadEvents();
  loadMatches();
  loadAttendees();
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in…";
  loginStatus.textContent = "";
  loginStatus.removeAttribute("data-state");

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  loginBtn.disabled = false;
  loginBtn.textContent = "Sign In";

  if (error) {
    loginStatus.textContent = "Invalid email or password.";
    loginStatus.setAttribute("data-state", "error");
    return;
  }

  showDashboard();
});

signoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  showLogin();
});

// ---------- tabs ----------

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.hidden = p.dataset.panel !== tab;
    });
  });
});

// ---------- applications ----------

async function loadApplications() {
  const body = document.getElementById("applications-body");
  const empty = document.getElementById("applications-empty");

  const { data, error } = await supabaseClient
    .from("members")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    body.innerHTML = "";
    empty.hidden = false;
    empty.textContent = "Couldn't load applications. Check console for details.";
    return;
  }

  renderStats(data);
  renderApplicationsTable(data);
}

function renderStats(members) {
  const counts = { total: members.length };
  STATUSES.forEach((s) => (counts[s] = members.filter((m) => m.status === s).length));

  document.getElementById("stats").innerHTML = `
    <div class="stat"><div class="stat__num">${counts.total}</div><div class="stat__label">Total</div></div>
    <div class="stat"><div class="stat__num">${counts.new}</div><div class="stat__label">New</div></div>
    <div class="stat"><div class="stat__num">${counts.contacted}</div><div class="stat__label">Contacted</div></div>
    <div class="stat"><div class="stat__num">${counts.approved}</div><div class="stat__label">Approved</div></div>
  `;
}

function renderApplicationsTable(members) {
  const body = document.getElementById("applications-body");
  const empty = document.getElementById("applications-empty");

  if (!members.length) {
    body.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  body.innerHTML = members.map((m) => `
    <tr data-id="${m.id}">
      <td class="cell-name">${escapeHtml(m.name)}</td>
      <td>
        <div>${escapeHtml(m.email)}</div>
        ${m.phone ? `<div>${escapeHtml(m.phone)}</div>` : ""}
      </td>
      <td>${m.company ? escapeHtml(m.company) : "—"}${m.industry ? `<div class="card__meta">${escapeHtml(m.industry)}</div>` : ""}</td>
      <td>${m.referral ? escapeHtml(m.referral) : "—"}</td>
      <td style="max-width:260px;">${escapeHtml(m.message || "")}</td>
      <td>
        <select class="status-select" data-field="status">
          ${STATUSES.map((s) => `<option value="${s}" ${m.status === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
      <td>
        <input class="notes-input" data-field="notes" type="text" value="${escapeHtml(m.notes || "")}" placeholder="Add a note…" />
      </td>
      <td>${new Date(m.created_at).toLocaleDateString()}</td>
    </tr>
  `).join("");

  body.querySelectorAll("select[data-field]").forEach((el) => {
    el.addEventListener("change", (e) => updateApplication(e.target));
  });
  body.querySelectorAll("input[data-field]").forEach((el) => {
    el.addEventListener("blur", (e) => updateApplication(e.target));
  });
}

async function updateApplication(el) {
  const row = el.closest("tr");
  const id = row.dataset.id;
  const field = el.dataset.field;
  const value = el.value;

  const { error } = await supabaseClient.from("members").update({ [field]: value }).eq("id", id);
  if (error) console.error(error);
}

// ---------- members (roster) ----------

let allProfiles = [];

async function loadMembers() {
  const body = document.getElementById("members-body");
  const empty = document.getElementById("members-empty");

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    empty.hidden = false;
    empty.textContent = "Couldn't load members.";
    return;
  }

  allProfiles = data || [];

  if (!allProfiles.length) {
    body.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  body.innerHTML = allProfiles.map((p) => `
    <tr data-id="${p.id}">
      <td class="cell-name">${escapeHtml(p.name || "—")}</td>
      <td>${escapeHtml(p.email)}</td>
      <td>${p.company ? escapeHtml(p.company) : "—"}${p.industry ? `<div class="card__meta">${escapeHtml(p.industry)}</div>` : ""}</td>
      <td>${(p.tags || []).map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join(" ")}</td>
      <td><input type="checkbox" data-field="approved" ${p.approved ? "checked" : ""} /></td>
      <td><input type="checkbox" data-field="payment_status" ${p.payment_status === "active" ? "checked" : ""} /></td>
      <td><input type="checkbox" data-field="directory_visible" ${p.directory_visible ? "checked" : ""} /></td>
      <td><input type="checkbox" data-field="is_admin" ${p.is_admin ? "checked" : ""} /></td>
      <td>${new Date(p.created_at).toLocaleDateString()}</td>
    </tr>
  `).join("");

  body.querySelectorAll("input[type=checkbox]").forEach((el) => {
    el.addEventListener("change", (e) => updateProfileFlag(e.target));
  });
}

async function updateProfileFlag(el) {
  const row = el.closest("tr");
  const id = row.dataset.id;
  const field = el.dataset.field;
  const value = field === "payment_status" ? (el.checked ? "active" : "pending") : el.checked;
  const { error } = await supabaseClient.from("profiles").update({ [field]: value }).eq("id", id);
  if (error) {
    console.error(error);
    el.checked = !el.checked;
    return;
  }
  loadMatches();
}

// ---------- events ----------

async function loadEvents() {
  const list = document.getElementById("events-list");
  const empty = document.getElementById("events-empty");

  const { data, error } = await supabaseClient
    .from("events")
    .select("*")
    .order("starts_at", { ascending: true });

  if (error || !data || !data.length) {
    list.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.innerHTML = data.map((ev) => `
    <div class="card">
      ${ev.image_url ? `<img class="card__image" src="${escapeHtml(ev.image_url)}" alt="" />` : ""}
      <div class="card__body">
        <p class="card__meta">${ev.starts_at ? new Date(ev.starts_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Date TBA"}</p>
        <h3 class="card__title">${escapeHtml(ev.title)}</h3>
        ${ev.location ? `<p class="card__meta">${escapeHtml(ev.location)}</p>` : ""}
        ${ev.description ? `<p class="card__desc">${escapeHtml(ev.description)}</p>` : ""}
        <button class="btn btn--ghost" style="margin-top:12px;padding:8px 16px;" data-delete-event="${ev.id}">Delete</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll("[data-delete-event]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this event?")) return;
      await supabaseClient.from("events").delete().eq("id", btn.dataset.deleteEvent);
      loadEvents();
    });
  });
}

document.getElementById("event-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("event-save-btn");
  const status = document.getElementById("event-status");
  btn.disabled = true;
  btn.textContent = "Posting…";

  const startsRaw = document.getElementById("event-starts").value;
  const payload = {
    title: document.getElementById("event-title").value.trim(),
    location: document.getElementById("event-location").value.trim() || null,
    image_url: document.getElementById("event-image").value.trim() || null,
    description: document.getElementById("event-description").value.trim() || null,
    starts_at: startsRaw ? new Date(startsRaw).toISOString() : null,
  };

  const { error } = await supabaseClient.from("events").insert(payload);

  btn.disabled = false;
  btn.textContent = "Post Event";

  if (error) {
    status.textContent = "Couldn't post event.";
    status.setAttribute("data-state", "error");
    console.error(error);
    return;
  }

  status.textContent = "Posted.";
  status.setAttribute("data-state", "ok");
  document.getElementById("event-form").reset();
  loadEvents();
});

// ---------- matches ----------

async function loadMatches() {
  const suggestedEl = document.getElementById("suggested-matches");
  const matchesEmpty = document.getElementById("matches-empty");
  const existingEl = document.getElementById("existing-connections");
  const connectionsEmpty = document.getElementById("connections-empty");

  const approved = allProfiles.filter((p) => p.approved && ((p.tags && p.tags.length) || p.bio || p.industry));

  const { data: connections, error } = await supabaseClient.from("connections").select("*");
  if (error) console.error(error);
  const existingPairs = new Set((connections || []).map((c) => pairKey(c.member_a, c.member_b)));

  const suggestions = [];
  for (let i = 0; i < approved.length; i++) {
    for (let j = i + 1; j < approved.length; j++) {
      const a = approved[i], b = approved[j];
      if (existingPairs.has(pairKey(a.id, b.id))) continue;
      const m = matchScore(a, b);
      if (m.score > 0) suggestions.push({ a, b, ...m });
    }
  }
  suggestions.sort((x, y) => y.score - x.score);

  if (!suggestions.length) {
    suggestedEl.innerHTML = "";
    matchesEmpty.hidden = false;
  } else {
    matchesEmpty.hidden = true;
    suggestedEl.innerHTML = suggestions.map((s, idx) => `
      <div class="match-card" data-idx="${idx}">
        <div class="match-card__names">
          <strong>${escapeHtml(s.a.name || s.a.email)}</strong> &amp; <strong>${escapeHtml(s.b.name || s.b.email)}</strong>
          <div class="fg-dim">${s.reasons.map(escapeHtml).join(" · ")} — match score ${s.score}</div>
        </div>
        <button class="btn form__submit" style="padding:10px 20px;" data-connect="${idx}">Connect</button>
      </div>
    `).join("");

    suggestedEl.querySelectorAll("[data-connect]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const s = suggestions[btn.dataset.connect];
        btn.disabled = true;
        btn.textContent = "Connecting…";
        const { error } = await supabaseClient.from("connections").insert({
          member_a: s.a.id,
          member_b: s.b.id,
          note: `Matched on: ${s.reasons.join(", ")}`,
          status: "connected",
        });
        if (error) {
          console.error(error);
          btn.disabled = false;
          btn.textContent = "Connect";
          return;
        }
        loadMatches();
      });
    });
  }

  if (!connections || !connections.length) {
    existingEl.innerHTML = "";
    connectionsEmpty.hidden = false;
  } else {
    connectionsEmpty.hidden = true;
    const byId = Object.fromEntries(allProfiles.map((p) => [p.id, p]));
    existingEl.innerHTML = connections.map((c) => {
      const a = byId[c.member_a], b = byId[c.member_b];
      return `
        <div class="match-card">
          <div class="match-card__names">
            <strong>${escapeHtml(a?.name || a?.email || "Unknown")}</strong> &amp; <strong>${escapeHtml(b?.name || b?.email || "Unknown")}</strong>
            ${c.note ? `<div class="fg-dim">${escapeHtml(c.note)}</div>` : ""}
          </div>
        </div>
      `;
    }).join("");
  }
}

function pairKey(a, b) {
  return [a, b].sort().join("|");
}

// Lightweight matching heuristic: weighted overlap across tags, bio, and
// company/role text. Not an LLM call — a fast, zero-infra stand-in that's
// meaningfully smarter than plain exact-tag equality (catches "fashion"
// vs. "streetwear designer" style near-matches via shared keywords).
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "in", "on", "for", "to", "with",
  "is", "are", "i", "my", "we", "our", "at", "by", "looking", "co", "founder",
]);

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function matchScore(a, b) {
  const aTags = (a.tags || []).map((t) => t.toLowerCase());
  const bTags = (b.tags || []).map((t) => t.toLowerCase());
  const sharedTags = aTags.filter((t) => bTags.includes(t));
  const sameIndustry = a.industry && b.industry && a.industry === b.industry;

  const aWords = new Set([...tokenize(a.bio), ...tokenize(a.company), ...aTags.flatMap(tokenize)]);
  const bWords = new Set([...tokenize(b.bio), ...tokenize(b.company), ...bTags.flatMap(tokenize)]);
  const sharedWords = [...aWords].filter((w) => bWords.has(w) && !sharedTags.includes(w));

  const score = sharedTags.length * 3 + (sameIndustry ? 2 : 0) + sharedWords.length;
  const reasons = [];
  if (sameIndustry) reasons.push(`both in ${a.industry}`);
  if (sharedTags.length) reasons.push(`shared tags: ${sharedTags.join(", ")}`);
  if (sharedWords.length) reasons.push(`shared keywords: ${sharedWords.slice(0, 5).join(", ")}`);

  return { score, reasons };
}

// ---------- CSV import ----------

document.getElementById("import-btn").addEventListener("click", async () => {
  const fileInput = document.getElementById("import-file");
  const status = document.getElementById("import-status");
  const file = fileInput.files[0];

  if (!file) {
    status.textContent = "Choose a CSV file first.";
    status.setAttribute("data-state", "error");
    return;
  }

  const text = await file.text();
  const rows = parseCsv(text);

  if (!rows.length) {
    status.textContent = "No rows found in that file.";
    status.setAttribute("data-state", "error");
    return;
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf("name");
  const emailIdx = header.indexOf("email");
  const companyIdx = header.indexOf("company");

  if (nameIdx === -1 || emailIdx === -1) {
    status.textContent = "CSV needs at least 'name' and 'email' columns.";
    status.setAttribute("data-state", "error");
    return;
  }

  const payloads = rows.slice(1)
    .filter((r) => r[emailIdx] && r[emailIdx].trim())
    .map((r) => ({
      name: r[nameIdx]?.trim() || "Unknown",
      email: r[emailIdx].trim(),
      company: companyIdx > -1 ? (r[companyIdx]?.trim() || null) : null,
      message: "Imported from existing contact list.",
      status: "approved",
    }));

  status.textContent = `Importing ${payloads.length} contacts…`;
  status.removeAttribute("data-state");

  const { error } = await supabaseClient.from("members").insert(payloads);

  if (error) {
    status.textContent = "Import failed. Check console for details.";
    status.setAttribute("data-state", "error");
    console.error(error);
    return;
  }

  status.textContent = `Imported ${payloads.length} contacts as approved.`;
  status.setAttribute("data-state", "ok");
  fileInput.value = "";
  loadApplications();
});

// ---------- attendees (past event guest list) ----------

let allAttendees = [];

async function loadAttendees() {
  const { data, error } = await supabaseClient
    .from("attendees")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error(error);
    document.getElementById("attendees-empty").hidden = false;
    document.getElementById("attendees-empty").textContent = "Couldn't load attendees.";
    return;
  }

  allAttendees = data || [];
  renderAttendeesTable(allAttendees);
}

function renderAttendeesTable(rows) {
  const body = document.getElementById("attendees-body");
  const empty = document.getElementById("attendees-empty");

  if (!rows.length) {
    body.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  body.innerHTML = rows.map((a) => `
    <tr>
      <td class="cell-name">${escapeHtml(a.name)}</td>
      <td>${a.email ? escapeHtml(a.email) : "—"}</td>
      <td>${a.company ? escapeHtml(a.company) : "—"}</td>
      <td>${a.title ? escapeHtml(a.title) : "—"}</td>
      <td>${a.attended_5_12_event ? "Yes" : "No"}</td>
      <td>${a.attended_6_9_dinner ? "Yes" : "No"}</td>
    </tr>
  `).join("");
}

document.getElementById("attendees-search").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    renderAttendeesTable(allAttendees);
    return;
  }
  const filtered = allAttendees.filter((a) =>
    (a.name || "").toLowerCase().includes(q) ||
    (a.company || "").toLowerCase().includes(q) ||
    (a.email || "").toLowerCase().includes(q) ||
    (a.title || "").toLowerCase().includes(q)
  );
  renderAttendeesTable(filtered);
});

function parseCsv(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length)
    .map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
}

// ---------- helpers ----------

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

init();
