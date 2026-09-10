document.getElementById("year").textContent = new Date().getFullYear();

const form = document.getElementById("apply-form");
const statusEl = document.getElementById("form-status");
const submitBtn = document.getElementById("submit-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim() || null,
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
  statusEl.textContent = "Application received. We'll be in touch.";
  statusEl.setAttribute("data-state", "ok");
  submitBtn.textContent = "Submitted";
});
