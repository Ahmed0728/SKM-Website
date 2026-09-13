const loginView = document.getElementById("login-view");
const pendingView = document.getElementById("pending-view");
const paymentView = document.getElementById("payment-view");
const onboardingView = document.getElementById("onboarding-view");
const portalView = document.getElementById("portal-view");

const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const loginBtn = document.getElementById("login-btn");

const MERCH_ITEMS = [
  { name: "SKM Hoodie", image: "assets/merch/hoodie-pants-five-colorways.png" },
  { name: "SKM Wide Leg Pullover", image: "assets/merch/pullover-wide-leg-colorways.png" },
  { name: "SKM Hoodie & Pants Set", image: "assets/merch/hoodie-pants-four-colorways.png" },
];

let currentProfile = null;

function show(view) {
  loginView.hidden = view !== "login";
  pendingView.hidden = view !== "pending";
  paymentView.hidden = view !== "payment";
  onboardingView.hidden = view !== "onboarding";
  portalView.hidden = view !== "portal";
}

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    show("login");
    return;
  }
  await loadProfile(session.user);
}

async function loadProfile(user) {
  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    show("login");
    return;
  }

  currentProfile = profile;

  if (!profile.approved) {
    show("pending");
    return;
  }

  if (profile.payment_status !== "active" && !profile.is_admin) {
    const link = document.getElementById("payment-link");
    const linkReady = typeof STRIPE_PAYMENT_LINK !== "undefined" && STRIPE_PAYMENT_LINK;
    const paymentStatus = document.getElementById("payment-status");
    if (linkReady) {
      link.href = `${STRIPE_PAYMENT_LINK}?prefilled_email=${encodeURIComponent(profile.email)}`;
      link.removeAttribute("aria-disabled");
      paymentStatus.textContent = "";
      paymentStatus.removeAttribute("data-state");
    } else {
      link.href = "#";
      link.setAttribute("aria-disabled", "true");
      paymentStatus.textContent = "Payment isn't set up yet — try reloading the page, or check back shortly.";
      paymentStatus.setAttribute("data-state", "error");
    }
    show("payment");
    return;
  }

  if (!profile.onboarded) {
    show("onboarding");
    return;
  }

  show("portal");
  document.getElementById("portal-name").textContent = profile.name ? `, ${profile.name}` : "";
  fillProfileForm(profile);
  loadEvents();
  loadDirectory();
  loadConnections();
  loadMerch();
}

const signupBtn = document.getElementById("signup-btn");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in…";
  loginStatus.textContent = "";
  loginStatus.removeAttribute("data-state");

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  loginBtn.disabled = false;
  loginBtn.textContent = "Sign In";

  if (error) {
    loginStatus.textContent = "Incorrect email or password.";
    loginStatus.setAttribute("data-state", "error");
    return;
  }

  await loadProfile(data.user);
});

signupBtn.addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  if (!email || password.length < 6) {
    loginStatus.textContent = "Enter your email and a password (6+ characters) first.";
    loginStatus.setAttribute("data-state", "error");
    return;
  }

  signupBtn.disabled = true;
  signupBtn.textContent = "Creating…";
  loginStatus.textContent = "";
  loginStatus.removeAttribute("data-state");

  const { data, error } = await supabaseClient.auth.signUp({ email, password });

  signupBtn.disabled = false;
  signupBtn.textContent = "First time? Create account";

  if (error) {
    loginStatus.textContent = error.message.includes("already registered")
      ? "That email already has an account — sign in instead."
      : "Something went wrong. Try again.";
    loginStatus.setAttribute("data-state", "error");
    return;
  }

  if (!data.session) {
    loginStatus.textContent = "Account created — check your email to confirm, then sign in.";
    loginStatus.setAttribute("data-state", "ok");
    return;
  }

  await loadProfile(data.user);
});

document.getElementById("onboarding-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("onboard-save-btn");
  const status = document.getElementById("onboard-status");
  btn.disabled = true;
  btn.textContent = "Saving…";

  const tags = document.getElementById("onboard-tags").value
    .split(",").map((t) => t.trim()).filter(Boolean);

  const updates = {
    name: document.getElementById("onboard-name").value.trim(),
    company: document.getElementById("onboard-company").value.trim(),
    industry: document.getElementById("onboard-industry").value,
    bio: document.getElementById("onboard-bio").value.trim(),
    tags,
    directory_visible: document.getElementById("onboard-visible").checked,
    onboarded: true,
  };

  const { error } = await supabaseClient.from("profiles").update(updates).eq("id", currentProfile.id);

  btn.disabled = false;
  btn.textContent = "Enter SKM";

  if (error) {
    status.textContent = "Couldn't save. Try again.";
    status.setAttribute("data-state", "error");
    console.error(error);
    return;
  }

  currentProfile = { ...currentProfile, ...updates };
  show("portal");
  document.getElementById("portal-name").textContent = updates.name ? `, ${updates.name}` : "";
  fillProfileForm(currentProfile);
  loadEvents();
  loadDirectory();
  loadConnections();
  loadMerch();
});

document.getElementById("pending-signout-btn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  show("login");
});

document.getElementById("onboard-signout-btn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  show("login");
});

document.getElementById("payment-link").addEventListener("click", (e) => {
  const link = e.currentTarget;
  if (link.getAttribute("aria-disabled") === "true") {
    e.preventDefault();
    const status = document.getElementById("payment-status");
    status.textContent = "Payment isn't set up yet — try reloading the page, or check back shortly.";
    status.setAttribute("data-state", "error");
  }
});

document.getElementById("payment-signout-btn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  show("login");
});

document.getElementById("payment-refresh-btn").addEventListener("click", async () => {
  const btn = document.getElementById("payment-refresh-btn");
  const status = document.getElementById("payment-status");
  btn.disabled = true;
  btn.textContent = "Checking…";

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) await loadProfile(session.user);

  btn.disabled = false;
  btn.textContent = "Already paid? Check again";

  if (currentProfile && currentProfile.payment_status !== "active") {
    status.textContent = "Not showing as paid yet — payments can take a few minutes to confirm.";
    status.setAttribute("data-state", "error");
  }
});

document.getElementById("signout-btn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  show("login");
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

// ---------- events ----------

let allEvents = [];
let eventsFilter = "past";
let eventRsvpCounts = {};
let myRsvpEventIds = new Set();

async function loadEvents() {
  const { data, error } = await supabaseClient
    .from("events")
    .select("*")
    .order("starts_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }
  allEvents = data || [];

  const { data: rsvps, error: rsvpError } = await supabaseClient
    .from("event_rsvps")
    .select("event_id, member_id");

  eventRsvpCounts = {};
  myRsvpEventIds = new Set();
  if (rsvpError) {
    console.error(rsvpError);
  } else {
    (rsvps || []).forEach((r) => {
      eventRsvpCounts[r.event_id] = (eventRsvpCounts[r.event_id] || 0) + 1;
      if (r.member_id === currentProfile.id) myRsvpEventIds.add(r.event_id);
    });
  }

  renderEvents();
}

function renderEvents() {
  const list = document.getElementById("events-list");
  const empty = document.getElementById("events-empty");
  const now = new Date();

  let events = allEvents.filter((ev) => {
    const isPast = ev.starts_at && new Date(ev.starts_at) < now;
    return eventsFilter === "past" ? isPast : !isPast;
  });
  if (eventsFilter === "past") events = [...events].reverse();

  if (!events.length) {
    list.innerHTML = "";
    empty.hidden = false;
    empty.textContent = eventsFilter === "past" ? "No past events yet." : "No upcoming events yet — check back soon.";
    return;
  }
  empty.hidden = true;

  list.innerHTML = renderEventGroups(events, {
    rsvpCounts: eventRsvpCounts,
    myRsvpEventIds,
    showRsvp: eventsFilter === "upcoming",
  });

  list.querySelectorAll("[data-rsvp-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => toggleRsvp(btn));
  });
}

document.querySelectorAll(".events-toggle button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".events-toggle button").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    eventsFilter = btn.dataset.eventsFilter;
    renderEvents();
  });
});

async function toggleRsvp(btn) {
  const eventId = btn.dataset.rsvpToggle;
  const going = myRsvpEventIds.has(eventId);
  btn.disabled = true;

  if (going) {
    const { error } = await supabaseClient.from("event_rsvps").delete()
      .eq("event_id", eventId).eq("member_id", currentProfile.id);
    if (error) console.error(error);
  } else {
    const { error } = await supabaseClient.from("event_rsvps").insert({
      event_id: eventId,
      member_id: currentProfile.id,
    });
    if (error) console.error(error);
  }

  loadEvents();
}

// ---------- directory ----------

async function loadDirectory() {
  const list = document.getElementById("directory-list");
  const empty = document.getElementById("directory-empty");
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, name, company, industry, tags")
    .eq("approved", true)
    .eq("directory_visible", true)
    .neq("id", currentProfile.id)
    .order("name", { ascending: true });

  if (error || !data || !data.length) {
    list.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.innerHTML = data.map((m) => `
    <div class="card">
      <div class="card__body">
        <h3 class="card__title">${escapeHtml(m.name || "Member")}</h3>
        ${m.company ? `<p class="card__meta">${escapeHtml(m.company)}${m.industry ? ` · ${escapeHtml(m.industry)}` : ""}</p>` : m.industry ? `<p class="card__meta">${escapeHtml(m.industry)}</p>` : ""}
        ${renderTags(m.tags)}
      </div>
    </div>
  `).join("");
}

// ---------- connections ----------

async function loadConnections() {
  const list = document.getElementById("connections-list");
  const empty = document.getElementById("connections-empty");
  const { data, error } = await supabaseClient
    .from("connections")
    .select("*, a:member_a(id,name,company), b:member_b(id,name,company)")
    .or(`member_a.eq.${currentProfile.id},member_b.eq.${currentProfile.id}`)
    .eq("status", "connected");

  if (error || !data || !data.length) {
    list.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.innerHTML = data.map((c) => {
    const other = c.a.id === currentProfile.id ? c.b : c.a;
    return `
      <div class="card">
        <div class="card__body">
          <h3 class="card__title">${escapeHtml(other.name || "Member")}</h3>
          ${other.company ? `<p class="card__meta">${escapeHtml(other.company)}</p>` : ""}
          ${c.note ? `<p class="card__desc">${escapeHtml(c.note)}</p>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

// ---------- merch ----------

function loadMerch(filter = "") {
  const list = document.getElementById("merch-list");
  const items = MERCH_ITEMS.filter((m) => m.name.toLowerCase().includes(filter.toLowerCase()));
  list.innerHTML = items.map((m) => `
    <div class="card">
      <img class="card__image" src="${m.image}" alt="${escapeHtml(m.name)}" />
      <div class="card__body">
        <h3 class="card__title">${escapeHtml(m.name)}</h3>
        <p class="card__meta">Coming soon</p>
      </div>
    </div>
  `).join("");
}

document.getElementById("merch-search").addEventListener("input", (e) => loadMerch(e.target.value));

// ---------- profile ----------

function fillProfileForm(profile) {
  document.getElementById("profile-name").value = profile.name || "";
  document.getElementById("profile-company").value = profile.company || "";
  document.getElementById("profile-industry").value = profile.industry || "";
  document.getElementById("profile-bio").value = profile.bio || "";
  document.getElementById("profile-tags").value = (profile.tags || []).join(", ");
  document.getElementById("profile-visible").checked = !!profile.directory_visible;
}

document.getElementById("profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("profile-save-btn");
  const status = document.getElementById("profile-status");
  btn.disabled = true;
  btn.textContent = "Saving…";

  const tags = document.getElementById("profile-tags").value
    .split(",").map((t) => t.trim()).filter(Boolean);

  const updates = {
    name: document.getElementById("profile-name").value.trim(),
    company: document.getElementById("profile-company").value.trim() || null,
    industry: document.getElementById("profile-industry").value || null,
    bio: document.getElementById("profile-bio").value.trim() || null,
    tags,
    directory_visible: document.getElementById("profile-visible").checked,
  };

  const { error } = await supabaseClient.from("profiles").update(updates).eq("id", currentProfile.id);

  btn.disabled = false;
  btn.textContent = "Save";

  if (error) {
    status.textContent = "Couldn't save. Try again.";
    status.setAttribute("data-state", "error");
    return;
  }

  currentProfile = { ...currentProfile, ...updates };
  document.getElementById("portal-name").textContent = updates.name ? `, ${updates.name}` : "";
  status.textContent = "Saved.";
  status.setAttribute("data-state", "ok");
  loadDirectory();
});

// ---------- helpers ----------

const ICON_PIN = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-7.5 8-13a8 8 0 1 0-16 0c0 5.5 8 13 8 13z"/><circle cx="12" cy="9" r="2.5"/></svg>`;
const ICON_PEOPLE = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

function renderEventGroups(events, { rsvpCounts = {}, myRsvpEventIds = new Set(), showRsvp = false } = {}) {
  return events.map((ev) => {
    const date = ev.starts_at ? new Date(ev.starts_at) : null;
    const day = date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "TBA";
    const weekday = date ? date.toLocaleDateString(undefined, { weekday: "long" }) : "";
    const time = date ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
    const goingCount = rsvpCounts[ev.id] || 0;
    const iAmGoing = myRsvpEventIds.has(ev.id);

    return `
      <div class="events-timeline__group">
        <div class="events-timeline__date">
          <div class="events-timeline__date-day">${escapeHtml(day)}</div>
          <div class="events-timeline__date-weekday">${escapeHtml(weekday)}</div>
        </div>
        <div class="event-card">
          <div class="event-card__body">
            ${time ? `<div class="event-card__time">${escapeHtml(time)}</div>` : ""}
            <h3 class="event-card__title">${escapeHtml(ev.title)}</h3>
            ${ev.location ? `<div class="event-card__row">${ICON_PIN}<span>${escapeHtml(ev.location)}</span></div>` : ""}
            ${goingCount > 0 ? `<div class="event-card__row">${ICON_PEOPLE}<span>${goingCount} going</span></div>` : ""}
            ${ev.description ? `<p class="card__desc">${escapeHtml(ev.description)}</p>` : ""}
            ${showRsvp ? `<div class="event-card__actions"><button class="btn ${iAmGoing ? "btn--ghost" : ""}" style="padding:8px 16px;" data-rsvp-toggle="${ev.id}">${iAmGoing ? "Cancel RSVP" : "RSVP"}</button></div>` : ""}
          </div>
          ${ev.image_url ? `<img class="event-card__image" src="${escapeHtml(ev.image_url)}" alt="" />` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function renderTags(tags) {
  if (!tags || !tags.length) return "";
  return `<div class="tag-row">${tags.map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join("")}</div>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

init();
