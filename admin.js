const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyTQDboZyk4ns3YJCKPW4LoxJ9n9QgNN6-CdlX4j-QW_Ph4vF-1f9hDG_7wUStscfQPEw/exec";

const SLOT_OPTIONS = ["9:00 AM - 11:00 AM", "11:00 AM - 1:00 PM", "1:00 PM - 3:00 PM", "3:00 PM - 5:00 PM"];

const adminKeyField = document.getElementById("adminKey");
const filterPanditField = document.getElementById("filterPandit");
const filterDateField = document.getElementById("filterDate");
const filterBookingIdField = document.getElementById("filterBookingId");
const loadBtn = document.getElementById("loadBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const statusText = document.getElementById("statusText");
const bookingTableBody = document.getElementById("bookingTableBody");

let currentFilteredBookings = [];

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.className = isError ? "text-sm text-red-700" : "text-sm text-orange-900/80";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slotSelect(currentValue) {
  const options = SLOT_OPTIONS.map((slot) => {
    const selected = slot === currentValue ? "selected" : "";
    return `<option value="${escapeHtml(slot)}" ${selected}>${escapeHtml(slot)}</option>`;
  }).join("");

  return `<select class="edit-slot w-full rounded-lg border border-orange-300 bg-white px-2 py-1">${options}</select>`;
}

function renderRows(bookings) {
  bookingTableBody.innerHTML = "";

  if (!bookings.length) {
    bookingTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="px-4 py-6 text-center text-orange-900/70">No bookings found for current filters.</td>
      </tr>
    `;
    return;
  }

  const rows = bookings.map((booking) => {
    return `
      <tr class="border-t border-amber-100" data-booking-id="${escapeHtml(booking.bookingId)}">
        <td class="px-4 py-3 font-semibold text-orange-900">${escapeHtml(booking.bookingId)}</td>
        <td class="px-4 py-3 text-orange-900/80">${escapeHtml(booking.timestamp)}</td>
        <td class="px-4 py-3">
          <select class="edit-pandit w-full rounded-lg border border-orange-300 bg-white px-2 py-1">
            <option value="Pandit Ji A" ${booking.panditName === "Pandit Ji A" ? "selected" : ""}>Pandit Ji A</option>
            <option value="Pandit Ji B" ${booking.panditName === "Pandit Ji B" ? "selected" : ""}>Pandit Ji B</option>
          </select>
        </td>
        <td class="px-4 py-3"><input class="edit-date w-full rounded-lg border border-orange-300 bg-white px-2 py-1" type="date" value="${escapeHtml(booking.date)}" /></td>
        <td class="px-4 py-3">${slotSelect(booking.timeSlot)}</td>
        <td class="px-4 py-3"><input class="edit-user w-full rounded-lg border border-orange-300 bg-white px-2 py-1" type="text" value="${escapeHtml(booking.userName)}" /></td>
        <td class="px-4 py-3"><input class="edit-mobile w-full rounded-lg border border-orange-300 bg-white px-2 py-1" type="text" value="${escapeHtml(booking.mobile)}" /></td>
        <td class="px-4 py-3">
          <div class="flex gap-2">
            <button type="button" class="save-btn px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800">Save</button>
            <button type="button" class="delete-btn px-3 py-1.5 rounded-lg bg-red-700 text-white font-semibold hover:bg-red-800">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  bookingTableBody.innerHTML = rows;
}

function escapeCsv(value) {
  const text = String(value == null ? "" : value);
  const escaped = text.replaceAll('"', '""');
  return `"${escaped}"`;
}

function buildCsv(bookings) {
  const headers = ["BookingID", "Timestamp", "PanditName", "Date", "TimeSlot", "UserName", "Mobile"];
  const rows = bookings.map((booking) => [
    booking.bookingId,
    booking.timestamp,
    booking.panditName,
    booking.date,
    booking.timeSlot,
    booking.userName,
    booking.mobile
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
    .join("\n");
}

function downloadCsvFile(csvContent) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  const fileName = `bookings-export-${stamp}.csv`;

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(objectUrl);
}

function exportFilteredBookingsCsv() {
  if (!currentFilteredBookings.length) {
    setStatus("No filtered bookings to export. Load bookings first.", true);
    return;
  }

  const csv = buildCsv(currentFilteredBookings);
  downloadCsvFile(csv);
  setStatus(`Exported ${currentFilteredBookings.length} booking(s) to CSV.`);
}

function getAdminKey() {
  return adminKeyField.value.trim();
}

function buildAdminListUrl() {
  const params = new URLSearchParams({
    action: "adminList",
    adminKey: getAdminKey(),
    limit: "300"
  });

  if (filterPanditField.value) {
    params.set("panditName", filterPanditField.value);
  }

  if (filterDateField.value) {
    params.set("date", filterDateField.value);
  }

  if (filterBookingIdField.value.trim()) {
    params.set("bookingId", filterBookingIdField.value.trim());
  }

  return `${GAS_WEB_APP_URL}?${params.toString()}`;
}

async function loadBookings() {
  if (!getAdminKey()) {
    setStatus("Admin key is required.", true);
    return;
  }

  setStatus("Loading bookings...");
  loadBtn.disabled = true;

  try {
    const response = await fetch(buildAdminListUrl(), { method: "GET" });
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to load bookings.");
    }

    const bookings = Array.isArray(result.bookings) ? result.bookings : [];
    currentFilteredBookings = bookings;
    renderRows(bookings);
    setStatus(`Loaded ${bookings.length} booking(s).`);
  } catch (error) {
    currentFilteredBookings = [];
    renderRows([]);
    setStatus(error.message || "Unable to load bookings.", true);
  } finally {
    loadBtn.disabled = false;
  }
}

async function deleteBooking(bookingId) {
  const ok = window.confirm(`Delete booking ${bookingId}? This cannot be undone.`);
  if (!ok) {
    return;
  }

  setStatus(`Deleting ${bookingId}...`);

  const response = await fetch(GAS_WEB_APP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action: "adminDelete",
      adminKey: getAdminKey(),
      bookingId
    })
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to delete booking.");
  }

  setStatus(`Deleted booking ${bookingId}.`);
}

async function updateBooking(bookingId, updates) {
  setStatus(`Saving ${bookingId}...`);

  const response = await fetch(GAS_WEB_APP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action: "adminUpdate",
      adminKey: getAdminKey(),
      bookingId,
      updates
    })
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to update booking.");
  }

  setStatus(`Saved booking ${bookingId}.`);
}

async function handleTableClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const row = target.closest("tr[data-booking-id]");
  if (!row) {
    return;
  }

  const bookingId = row.getAttribute("data-booking-id") || "";
  if (!bookingId) {
    return;
  }

  if (!getAdminKey()) {
    setStatus("Admin key is required.", true);
    return;
  }

  try {
    if (target.classList.contains("delete-btn")) {
      await deleteBooking(bookingId);
      await loadBookings();
      return;
    }

    if (target.classList.contains("save-btn")) {
      const updates = {
        panditName: row.querySelector(".edit-pandit")?.value || "",
        date: row.querySelector(".edit-date")?.value || "",
        timeSlot: row.querySelector(".edit-slot")?.value || "",
        userName: row.querySelector(".edit-user")?.value.trim() || "",
        mobile: row.querySelector(".edit-mobile")?.value.trim() || ""
      };

      await updateBooking(bookingId, updates);
      await loadBookings();
    }
  } catch (error) {
    setStatus(error.message || "Operation failed.", true);
  }
}

function initAdminPanel() {
  loadBtn.addEventListener("click", loadBookings);
  exportCsvBtn.addEventListener("click", exportFilteredBookingsCsv);
  bookingTableBody.addEventListener("click", handleTableClick);

  filterPanditField.addEventListener("change", loadBookings);
  filterDateField.addEventListener("change", loadBookings);
  filterBookingIdField.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      loadBookings();
    }
  });
}

initAdminPanel();
