const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const loginBtn = document.getElementById("login-btn");
const signoutBtn = document.getElementById("signout-btn");
const membersBody = document.getElementById("members-body");
const emptyState = document.getElementById("empty-state");
const statsEl = document.getElementById("stats");

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
  loadMembers();
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

async function loadMembers() {
  const { data, error } = await supabaseClient
    .from("members")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    membersBody.innerHTML = "";
    emptyState.hidden = false;
    emptyState.textContent = "Couldn't load members. Check console for details.";
    return;
  }

  renderStats(data);
  renderTable(data);
}

function renderStats(members) {
  const counts = { total: members.length };
  STATUSES.forEach((s) => (counts[s] = members.filter((m) => m.status === s).length));

  statsEl.innerHTML = `
    <div class="stat"><div class="stat__num">${counts.total}</div><div class="stat__label">Total</div></div>
    <div class="stat"><div class="stat__num">${counts.new}</div><div class="stat__label">New</div></div>
    <div class="stat"><div class="stat__num">${counts.contacted}</div><div class="stat__label">Contacted</div></div>
    <div class="stat"><div class="stat__num">${counts.approved}</div><div class="stat__label">Approved</div></div>
  `;
}

function renderTable(members) {
  if (!members.length) {
    membersBody.innerHTML = "";
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  membersBody.innerHTML = members.map((m) => `
    <tr data-id="${m.id}">
      <td class="cell-name">${escapeHtml(m.name)}</td>
      <td>
        <div>${escapeHtml(m.email)}</div>
        ${m.phone ? `<div>${escapeHtml(m.phone)}</div>` : ""}
      </td>
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

  membersBody.querySelectorAll("select[data-field]").forEach((el) => {
    el.addEventListener("change", (e) => updateMember(e.target));
  });
  membersBody.querySelectorAll("input[data-field]").forEach((el) => {
    el.addEventListener("blur", (e) => updateMember(e.target));
  });
}

async function updateMember(el) {
  const row = el.closest("tr");
  const id = row.dataset.id;
  const field = el.dataset.field;
  const value = el.value;

  const { error } = await supabaseClient.from("members").update({ [field]: value }).eq("id", id);
  if (error) console.error(error);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

init();
