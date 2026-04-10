const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyTQDboZyk4ns3YJCKPW4LoxJ9n9QgNN6-CdlX4j-QW_Ph4vF-1f9hDG_7wUStscfQPEw/exec";

const SLOTS = ["9:00 AM - 11:00 AM", "11:00 AM - 1:00 PM", "1:00 PM - 3:00 PM", "3:00 PM - 5:00 PM"];

const bookingForm = document.getElementById("bookingForm");
const panditField = document.getElementById("panditName");
const dateField = document.getElementById("bookingDate");
const slotGrid = document.getElementById("slotGrid");
const timeSlotField = document.getElementById("timeSlot");
const slotHint = document.getElementById("slotHint");
const resultCard = document.getElementById("resultCard");
const submitBtn = document.getElementById("submitBtn");

let bookedSlotSet = new Set();

function toISODate(value) {
  return value;
}

function setMinDate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  dateField.min = `${yyyy}-${mm}-${dd}`;
}

function buildSlotGrid() {
  slotGrid.innerHTML = "";

  SLOTS.forEach((slot) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "slot-btn rounded-xl border border-orange-300 px-3 py-3 text-sm font-semibold text-orange-900 bg-white hover:bg-orange-50 transition";
    button.textContent = slot;
    button.dataset.slot = slot;

    button.addEventListener("click", () => {
      if (button.disabled) {
        return;
      }

      document.querySelectorAll(".slot-btn").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      timeSlotField.value = slot;
    });

    slotGrid.appendChild(button);
  });
}

function paintSlots() {
  const selected = timeSlotField.value;

  document.querySelectorAll(".slot-btn").forEach((btn) => {
    const slot = btn.dataset.slot;
    const isBooked = bookedSlotSet.has(slot);

    btn.disabled = isBooked;
    btn.classList.toggle("active", slot === selected && !isBooked);

    if (isBooked && slot === selected) {
      timeSlotField.value = "";
    }
  });
}

async function fetchBookedSlots() {
  const panditName = panditField.value;
  const date = toISODate(dateField.value);

  if (!panditName || !date) {
    bookedSlotSet = new Set();
    paintSlots();
    slotHint.textContent = "Select Pandit Ji and date to view live availability.";
    return;
  }

  slotHint.textContent = "Checking live slot availability...";

  try {
    const endpoint = `${GAS_WEB_APP_URL}?action=slots&panditName=${encodeURIComponent(panditName)}&date=${encodeURIComponent(date)}`;
    const response = await fetch(endpoint, { method: "GET" });

    if (!response.ok) {
      throw new Error("Could not fetch slot details.");
    }

    const data = await response.json();
    const booked = Array.isArray(data.bookedSlots) ? data.bookedSlots : [];
    bookedSlotSet = new Set(booked);
    paintSlots();

    const availableCount = SLOTS.filter((slot) => !bookedSlotSet.has(slot)).length;
    slotHint.textContent =
      availableCount > 0
        ? `${availableCount} slot(s) available for ${panditName} on ${date}.`
        : `No slots available for ${panditName} on ${date}. Please choose another date or Pandit Ji.`;
  } catch (error) {
    bookedSlotSet = new Set();
    paintSlots();
    slotHint.textContent = "Unable to load availability right now. Please try again.";
  }
}

function renderSuccess(result) {
  const pdfDataUri = `data:application/pdf;base64,${result.pdfBase64}`;

  resultCard.className = "mt-8 p-5 bg-white border border-orange-200 rounded-2xl";
  resultCard.innerHTML = `
    <h3 class="text-2xl font-bold text-orange-800">Thank You! Booking Confirmed.</h3>
    <p class="mt-2 text-orange-900/80">Booking ID: <strong>${result.bookingId}</strong></p>
    <p class="mt-1 text-orange-900/80">A confirmation email has been sent to your email inbox.</p>
    <a
      href="${pdfDataUri}"
      download="${result.pdfFileName || "Temple-Booking-Confirmation.pdf"}"
      class="inline-flex mt-4 px-5 py-2 rounded-lg bg-orange-700 text-white font-semibold hover:bg-orange-800 transition"
    >
      Download Confirmation PDF
    </a>
  `;
}

function renderError(message) {
  resultCard.className = "mt-8 p-5 bg-white border border-red-200 rounded-2xl";
  resultCard.innerHTML = `<p class="text-red-700 font-semibold">${message}</p>`;
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!timeSlotField.value) {
    renderError("Please select an available time slot before submitting.");
    return;
  }

  const formData = new FormData(bookingForm);
  const payload = {
    panditName: formData.get("panditName"),
    date: toISODate(formData.get("bookingDate")),
    timeSlot: formData.get("timeSlot"),
    userName: formData.get("userName"),
    email: formData.get("email"),
    mobile: formData.get("mobile")
  };

  submitBtn.disabled = true;
  submitBtn.textContent = "Processing Booking...";
  resultCard.classList.add("hidden");

  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      }
    });

    if (!response.ok) {
      throw new Error("Booking request failed.");
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "Could not complete booking.");
    }

    renderSuccess(result);
    resultCard.classList.remove("hidden");
    bookingForm.reset();
    timeSlotField.value = "";
    bookedSlotSet = new Set();
    paintSlots();
    slotHint.textContent = "Booking complete. Choose details again for a new booking.";
  } catch (error) {
    renderError(error.message || "Something went wrong while booking.");
    resultCard.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirm Booking";
    fetchBookedSlots();
  }
}

function init() {
  if (!bookingForm) {
    return;
  }

  setMinDate();
  buildSlotGrid();
  panditField.addEventListener("change", fetchBookedSlots);
  dateField.addEventListener("change", fetchBookedSlots);
  bookingForm.addEventListener("submit", handleSubmit);
}

init();
