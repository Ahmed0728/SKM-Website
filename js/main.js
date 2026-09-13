document.getElementById("year").textContent = new Date().getFullYear();

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

const form = document.getElementById("apply-form");
const statusEl = document.getElementById("form-status");
const submitBtn = document.getElementById("submit-btn");
const applyModal = document.getElementById("apply-modal");
const applyModalClose = document.getElementById("apply-modal-close");

function closeApplyModal() {
  applyModal.hidden = true;
}
applyModalClose.addEventListener("click", closeApplyModal);
applyModal.addEventListener("click", (e) => {
  if (e.target === applyModal) closeApplyModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !applyModal.hidden) closeApplyModal();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim() || null,
    company: form.company.value.trim() || null,
    industry: form.industry.value || null,
    referral: form.referral.value.trim() || null,
    message: form.message.value.trim(),
    status: "new",
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";
  statusEl.textContent = "";
  statusEl.removeAttribute("data-state");

  const { error } = await supabaseClient.from("members").insert(payload);

  if (error) {
    statusEl.textContent = "Something went wrong. Please try again.";
    statusEl.setAttribute("data-state", "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Application";
    console.error(error);
    return;
  }

  form.reset();
  submitBtn.textContent = "Submitted";
  applyModal.hidden = false;
});
