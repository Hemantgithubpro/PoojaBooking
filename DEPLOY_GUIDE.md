# Deploy Guide: GitHub Pages + Google Apps Script

This project is split into:
- Static frontend on GitHub Pages
- Booking API on Google Apps Script + Google Sheet

## 1. Google Apps Script Setup (Backend)

### 1.1 Create the Google Sheet
1. Create a new Google Sheet.
2. Name the first tab as Bookings (or keep default; script will create Bookings tab if missing).
3. Keep this sheet open.

Expected columns (header row):
- BookingID
- Timestamp
- PanditName
- Date
- TimeSlot
- UserName
- Mobile

Note: The script auto-adds this header row if the Bookings tab is newly created.

### 1.2 Create a bound Apps Script project
1. In the Google Sheet, click Extensions > Apps Script.
2. Replace the default script content with the full content of code.gs from this repo.
3. Create a new HTML file in Apps Script named template.
4. Paste template.html content from this repo into that template file.

### 1.3 Configure admin email
1. In code.gs, update:
- ADMIN_EMAIL = admin@example.com
2. Replace with your real admin inbox.

### 1.3.2 Configure Pandit Ji emails
1. In code.gs, update:
- PANDIT_EMAIL_MAP for both Pandit Ji names.
2. Replace placeholder emails with real inboxes for each Pandit Ji.
3. Booking confirmation will be emailed to:
- Selected Pandit Ji
- User email
- Admin email

### 1.3.1 Configure admin access key (for admin page operations)
1. In code.gs, update:
- ADMIN_ACCESS_KEY = CHANGE_ME_ADMIN_KEY
2. Replace with a strong secret value.
3. Keep this key private. You will enter it in admin.html when using admin operations.

### 1.4 Save and authorize
1. Click Save.
2. Run any function once (for example doGet) to trigger authorization.
3. Approve required scopes for:
- Spreadsheet access
- Gmail send

### 1.5 Deploy as Web App
1. Click Deploy > New deployment.
2. Select type: Web app.
3. Description: v1 booking api (or similar).
4. Execute as: Me.
5. Who has access: Anyone.
6. Click Deploy.
7. Copy the Web app URL.

### 1.6 Verify backend is live
Open this URL in browser (replace values):
- YOUR_WEB_APP_URL?action=slots&panditName=Pandit%20Ji%20A&date=2026-04-10

Expected JSON response shape:
- success
- bookedSlots

## 2. Update Frontend API URL

1. Open main.js in this repo.
2. Replace this line:
- const GAS_WEB_APP_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";
3. Paste your deployed Apps Script Web app URL.
4. Commit the change.

## 3. Publish Frontend on GitHub Pages

### 3.1 Push project to GitHub
1. Create a GitHub repository.
2. Push these files to the default branch:
- index.html
- booking.html
- main.js
- admin.html
- admin.js

### 3.2 Enable Pages
1. Open repo on GitHub.
2. Go to Settings > Pages.
3. Under Build and deployment:
- Source: Deploy from a branch
- Branch: main (or master)
- Folder: / (root)
4. Click Save.

### 3.3 Access the website
GitHub will publish a URL like:
- https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/

Use:
- Home page: /index.html (or root URL)
- Booking page: /booking.html
- Admin page: /admin.html

### 3.4 Admin operations
1. Open admin page (/admin.html).
2. Enter your ADMIN_ACCESS_KEY.
3. Click Load Bookings.
4. Use filters for Pandit, Date, or Booking ID.
5. Update any row and click Save.
6. Delete any row with Delete.

## 4. Post-Deploy Test Checklist

1. Open booking page.
2. Select Pandit Ji A and a date.
3. Confirm slot availability loads.
4. Book one slot.
5. Confirm:
- Success message appears
- PDF download link works
- Admin email arrives with PDF
- Selected Pandit Ji email arrives with PDF
- User email arrives with PDF
6. Refresh and confirm booked slot is now disabled for same Pandit/date.
7. Check same slot is still available for the other Pandit Ji.

## 5. Updating After Changes

When you update code.gs or template in Apps Script:
1. Click Deploy > Manage deployments.
2. Edit the existing Web app deployment.
3. Deploy new version.

When you update index.html, booking.html, or main.js:
1. Commit and push to GitHub.
2. GitHub Pages auto-publishes the latest commit.

When you update admin.html or admin.js:
1. Commit and push to GitHub.
2. GitHub Pages auto-publishes the latest commit.

When you update ADMIN_ACCESS_KEY in code.gs:
1. Click Deploy > Manage deployments in Apps Script.
2. Edit and deploy a new Web app version.

## 6. Common Issues

1. Slots do not load
- Cause: Wrong GAS_WEB_APP_URL in main.js
- Fix: Recheck exact deployed Web app URL

2. Booking fails with permission errors
- Cause: Apps Script scopes not authorized
- Fix: Re-run script in Apps Script editor and grant permissions

3. Emails not sent
- Cause: Gmail authorization missing or ADMIN_EMAIL not updated
- Fix: Reauthorize and verify ADMIN_EMAIL

4. CORS/network errors on Pages
- Cause: Web app not deployed to Anyone
- Fix: Redeploy Apps Script as Web app with Anyone access

5. Admin page shows unauthorized
- Cause: Wrong ADMIN_ACCESS_KEY entered in admin page
- Fix: Recheck ADMIN_ACCESS_KEY in code.gs and redeploy Apps Script
