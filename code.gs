const SHEET_NAME = 'Bookings';
const ADMIN_EMAIL = 'hemantjha2005@gmail.com';
const ADMIN_ACCESS_KEY = '12345';
const PANDIT_EMAIL_MAP = {
  'Pandit Ji A': 'pandit.a@example.com',
  'Pandit Ji B': 'pandit.b@example.com'
};
const TEMPLE_NAME = 'Divine Temple Seva Kendra';
const TIMEZONE = Session.getScriptTimeZone() || 'Asia/Kolkata';
const SLOT_LIST = ['9:00 AM - 11:00 AM', '11:00 AM - 1:00 PM', '1:00 PM - 3:00 PM', '3:00 PM - 5:00 PM'];

function doGet(e) {
  try {
    const action = (e.parameter.action || '').trim();

    if (action === 'adminList') {
      requireAdminAccess((e.parameter.adminKey || '').trim());

      const panditName = (e.parameter.panditName || '').trim();
      const date = (e.parameter.date || '').trim();
      const bookingId = (e.parameter.bookingId || '').trim();
      const limit = Math.max(1, Math.min(500, Number(e.parameter.limit || 200)));

      const bookings = getAdminFilteredBookings({
        panditName: panditName,
        date: date,
        bookingId: bookingId,
        limit: limit
      });

      return jsonResponse({ success: true, bookings: bookings });
    }

    if (action === 'slots') {
      const panditName = (e.parameter.panditName || '').trim();
      const date = (e.parameter.date || '').trim();

      if (!panditName || !date) {
        return jsonResponse({ success: false, message: 'panditName and date are required.' });
      }

      const bookedSlots = getBookedSlotsForPanditAndDate(panditName, date);
      return jsonResponse({ success: true, bookedSlots: bookedSlots });
    }

    return jsonResponse({
      success: true,
      message: 'Pandit Ji Booking API is running.',
      endpoints: {
        slots: '?action=slots&panditName=Pandit%20Ji%20A&date=2026-04-10'
      }
    });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message });
  }
}

function doPost(e) {
  try {
    const payload = parsePostData(e.postData && e.postData.contents);

    const action = String(payload.action || '').trim();
    if (action === 'adminDelete') {
      requireAdminAccess(payload.adminKey);
      return handleAdminDelete(payload);
    }

    if (action === 'adminUpdate') {
      requireAdminAccess(payload.adminKey);
      return handleAdminUpdate(payload);
    }

    const validation = validateBookingPayload(payload);

    if (!validation.valid) {
      return jsonResponse({ success: false, message: validation.message });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const bookedSlots = getBookedSlotsForPanditAndDate(payload.panditName, payload.date);
      if (bookedSlots.indexOf(payload.timeSlot) !== -1) {
        return jsonResponse({ success: false, message: 'Selected slot is already booked. Please choose another slot.' });
      }

      const sheet = getOrCreateBookingSheet();
      const bookingId = createBookingId();
      const timestamp = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

      sheet.appendRow([
        bookingId,
        timestamp,
        payload.panditName,
        payload.date,
        payload.timeSlot,
        payload.userName,
        payload.mobile
      ]);

      const bookingData = {
        bookingId: bookingId,
        timestamp: timestamp,
        panditName: payload.panditName,
        panditEmail: getPanditEmail(payload.panditName),
        date: payload.date,
        timeSlot: payload.timeSlot,
        userName: payload.userName,
        mobile: payload.mobile,
        email: payload.email,
        templeName: TEMPLE_NAME
      };

      const pdfBlob = generateConfirmationPdf(bookingData);
      sendBookingEmails(bookingData, pdfBlob);

      const pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());

      return jsonResponse({
        success: true,
        message: 'Booking completed successfully.',
        bookingId: bookingId,
        pdfFileName: pdfBlob.getName(),
        pdfBase64: pdfBase64
      });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return jsonResponse({ success: false, message: error.message });
  }
}

function getPanditEmail(panditName) {
  return String(PANDIT_EMAIL_MAP[panditName] || '').trim();
}

function parsePostData(rawBody) {
  if (!rawBody) {
    throw new Error('Missing request body.');
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw new Error('Invalid JSON body.');
  }
}

function requireAdminAccess(adminKey) {
  if (!adminKey || String(adminKey).trim() !== ADMIN_ACCESS_KEY) {
    throw new Error('Unauthorized admin request. Invalid admin key.');
  }
}

function getAdminFilteredBookings(filters) {
  const sheet = getOrCreateBookingSheet();
  const values = sheet.getDataRange().getValues();
  const results = [];

  const requestedPandit = String(filters.panditName || '').trim();
  const requestedDate = String(filters.date || '').trim();
  const requestedBookingId = String(filters.bookingId || '').trim().toLowerCase();
  const limit = Number(filters.limit || 200);

  for (var i = values.length - 1; i >= 1; i--) {
    const row = values[i];
    const booking = {
      rowNumber: i + 1,
      bookingId: row[0],
      timestamp: row[1],
      panditName: row[2],
      date: String(row[3]),
      timeSlot: row[4],
      userName: row[5],
      mobile: String(row[6])
    };

    if (requestedPandit && booking.panditName !== requestedPandit) {
      continue;
    }

    if (requestedDate && booking.date !== requestedDate) {
      continue;
    }

    if (requestedBookingId && String(booking.bookingId).toLowerCase().indexOf(requestedBookingId) === -1) {
      continue;
    }

    results.push(booking);

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

function findBookingRowById(sheet, bookingId) {
  const values = sheet.getDataRange().getValues();
  const target = String(bookingId || '').trim();

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === target) {
      return {
        rowNumber: i + 1,
        row: values[i]
      };
    }
  }

  return null;
}

function isSlotTakenByOtherBooking(sheet, bookingId, panditName, date, timeSlot) {
  const values = sheet.getDataRange().getValues();
  const targetId = String(bookingId || '').trim();

  for (var i = 1; i < values.length; i++) {
    const row = values[i];
    const rowBookingId = String(row[0]).trim();
    const rowPandit = row[2];
    const rowDate = String(row[3]);
    const rowSlot = row[4];

    if (rowBookingId !== targetId && rowPandit === panditName && rowDate === date && rowSlot === timeSlot) {
      return true;
    }
  }

  return false;
}

function handleAdminDelete(payload) {
  const bookingId = String(payload.bookingId || '').trim();
  if (!bookingId) {
    return jsonResponse({ success: false, message: 'bookingId is required.' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getOrCreateBookingSheet();
    const found = findBookingRowById(sheet, bookingId);

    if (!found) {
      return jsonResponse({ success: false, message: 'Booking not found.' });
    }

    sheet.deleteRow(found.rowNumber);
    return jsonResponse({ success: true, message: 'Booking deleted successfully.', bookingId: bookingId });
  } finally {
    lock.releaseLock();
  }
}

function handleAdminUpdate(payload) {
  const bookingId = String(payload.bookingId || '').trim();
  const updates = payload.updates || {};

  if (!bookingId) {
    return jsonResponse({ success: false, message: 'bookingId is required.' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getOrCreateBookingSheet();
    const found = findBookingRowById(sheet, bookingId);

    if (!found) {
      return jsonResponse({ success: false, message: 'Booking not found.' });
    }

    const current = {
      panditName: found.row[2],
      date: String(found.row[3]),
      timeSlot: found.row[4],
      userName: found.row[5],
      mobile: String(found.row[6])
    };

    const next = {
      panditName: String(updates.panditName || current.panditName).trim(),
      date: String(updates.date || current.date).trim(),
      timeSlot: String(updates.timeSlot || current.timeSlot).trim(),
      userName: String(updates.userName || current.userName).trim(),
      mobile: String(updates.mobile || current.mobile).trim()
    };

    if (['Pandit Ji A', 'Pandit Ji B'].indexOf(next.panditName) === -1) {
      return jsonResponse({ success: false, message: 'Invalid panditName selected.' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(next.date)) {
      return jsonResponse({ success: false, message: 'Date must be in yyyy-mm-dd format.' });
    }

    if (SLOT_LIST.indexOf(next.timeSlot) === -1) {
      return jsonResponse({ success: false, message: 'Invalid time slot selected.' });
    }

    if (!next.userName) {
      return jsonResponse({ success: false, message: 'userName is required.' });
    }

    if (!/^\d{10}$/.test(next.mobile)) {
      return jsonResponse({ success: false, message: 'Mobile number must be exactly 10 digits.' });
    }

    if (isSlotTakenByOtherBooking(sheet, bookingId, next.panditName, next.date, next.timeSlot)) {
      return jsonResponse({ success: false, message: 'Another booking already has this slot for the selected pandit and date.' });
    }

    sheet.getRange(found.rowNumber, 3, 1, 5).setValues([[next.panditName, next.date, next.timeSlot, next.userName, next.mobile]]);

    return jsonResponse({
      success: true,
      message: 'Booking updated successfully.',
      booking: {
        bookingId: bookingId,
        panditName: next.panditName,
        date: next.date,
        timeSlot: next.timeSlot,
        userName: next.userName,
        mobile: next.mobile
      }
    });
  } finally {
    lock.releaseLock();
  }
}

function validateBookingPayload(payload) {
  const required = ['panditName', 'date', 'timeSlot', 'userName', 'mobile', 'email'];
  for (var i = 0; i < required.length; i++) {
    if (!payload[required[i]]) {
      return { valid: false, message: required[i] + ' is required.' };
    }
  }

  if (['Pandit Ji A', 'Pandit Ji B'].indexOf(payload.panditName) === -1) {
    return { valid: false, message: 'Invalid panditName selected.' };
  }

  if (SLOT_LIST.indexOf(payload.timeSlot) === -1) {
    return { valid: false, message: 'Invalid time slot selected.' };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    return { valid: false, message: 'Date must be in yyyy-mm-dd format.' };
  }

  if (!/^\d{10}$/.test(String(payload.mobile))) {
    return { valid: false, message: 'Mobile number must be exactly 10 digits.' };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return { valid: false, message: 'Invalid email format.' };
  }

  return { valid: true };
}

function getOrCreateBookingSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.appendRow(['BookingID', 'Timestamp', 'PanditName', 'Date', 'TimeSlot', 'UserName', 'Mobile']);
  }

  return sheet;
}

function getBookedSlotsForPanditAndDate(panditName, date) {
  const sheet = getOrCreateBookingSheet();
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const bookedSlots = [];

  for (var i = 1; i < values.length; i++) {
    const row = values[i];
    const rowPandit = row[2];
    const rowDate = String(row[3]);
    const rowSlot = row[4];

    if (rowPandit === panditName && rowDate === date) {
      bookedSlots.push(rowSlot);
    }
  }

  return bookedSlots;
}

function createBookingId() {
  const now = new Date();
  const prefix = Utilities.formatDate(now, TIMEZONE, 'yyyyMMdd');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return 'BK-' + prefix + '-' + randomPart;
}

function generateConfirmationPdf(bookingData) {
  const template = HtmlService.createTemplateFromFile('template');
  template.booking = bookingData;
  const htmlOutput = template.evaluate().getContent();

  const blob = Utilities.newBlob(htmlOutput, 'text/html', 'booking-confirmation.html').getAs(MimeType.PDF);
  blob.setName('Temple-Booking-' + bookingData.bookingId + '.pdf');
  return blob;
}

function sendBookingEmails(bookingData, pdfBlob) {
  const adminSubject = 'New Temple Booking: ' + bookingData.bookingId;
  const adminBody = [
    'A new booking has been made.',
    '',
    'Temple: ' + bookingData.templeName,
    'Booking ID: ' + bookingData.bookingId,
    'Pandit Name: ' + bookingData.panditName,
    'Date: ' + bookingData.date,
    'Time Slot: ' + bookingData.timeSlot,
    'User Name: ' + bookingData.userName,
    'Mobile: ' + bookingData.mobile,
    'Email: ' + (bookingData.email || 'Not provided')
  ].join('\n');

  GmailApp.sendEmail(ADMIN_EMAIL, adminSubject, adminBody, {
    attachments: [pdfBlob]
  });

  if (bookingData.panditEmail) {
    const panditSubject = 'New Assigned Booking: ' + bookingData.bookingId;
    const panditBody = [
      'Namaste ' + bookingData.panditName + ',',
      '',
      'A new booking has been assigned to you.',
      '',
      'Temple: ' + bookingData.templeName,
      'Booking ID: ' + bookingData.bookingId,
      'Date: ' + bookingData.date,
      'Time Slot: ' + bookingData.timeSlot,
      'Devotee Name: ' + bookingData.userName,
      'Mobile: ' + bookingData.mobile,
      'Email: ' + (bookingData.email || 'Not provided'),
      '',
      'Please find booking confirmation attached.'
    ].join('\n');

    GmailApp.sendEmail(bookingData.panditEmail, panditSubject, panditBody, {
      attachments: [pdfBlob]
    });
  }

  if (bookingData.email) {
    const userSubject = 'Booking Confirmed: ' + bookingData.bookingId;
    const userBody = [
      'Namaste ' + bookingData.userName + ',',
      '',
      'Your booking has been confirmed successfully.',
      '',
      'Temple: ' + bookingData.templeName,
      'Pandit Name: ' + bookingData.panditName,
      'Date: ' + bookingData.date,
      'Time Slot: ' + bookingData.timeSlot,
      'Booking ID: ' + bookingData.bookingId,
      '',
      'Please find your confirmation PDF attached.',
      '',
      'Dhanyavaad.'
    ].join('\n');

    GmailApp.sendEmail(bookingData.email, userSubject, userBody, {
      attachments: [pdfBlob]
    });
  }
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
