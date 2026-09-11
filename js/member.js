const loginView = document.getElementById("login-view");
const pendingView = document.getElementById("pending-view");
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

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginBtn.disabled = true;
  loginBtn.textContent = "Sending…";
  loginStatus.textContent = "";
  loginStatus.removeAttribute("data-state");

  const email = document.getElementById("login-email").value.trim();
  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  });

  loginBtn.disabled = false;
  loginBtn.textContent = "Send Magic Link";

  if (error) {
    loginStatus.textContent = "Something went wrong. Try again.";
    loginStatus.setAttribute("data-state", "error");
    return;
  }

  loginStatus.textContent = "Check your email for a sign-in link.";
  loginStatus.setAttribute("data-state", "ok");
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
      </div>
    </div>
  `).join("");
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
