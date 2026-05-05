# MedAssist Care Platform - Class PPT Script

## Slide 1 - Title
**Title:** MedAssist Care Platform  
**Subtitle:** Smart Guardian-Patient Medication Management with Alerts and Escalation  
**Presented by:** [Your Name]  
**Department / Class:** [Your Class]

**Speaker notes:**
- This project solves missed medication issues using reminders, status tracking, and caretaker escalation.
- It supports both guardian and patient roles with secure login.

---

## Slide 2 - Problem Statement
**Title:** Problem We Are Solving
- Patients often miss medicine timings.
- Caretakers do not get timely status updates.
- Guardian-entered medication plans may not be tracked properly.
- People also need nearby medical stores/hospitals quickly.

**Speaker notes:**
- The main challenge is reliability in daily adherence, not just storing prescriptions.
- The platform focuses on end-to-end workflow from schedule creation to escalation.

---

## Slide 3 - Proposed Solution
**Title:** Our Solution: MedAssist
- Two role-based portals: **Guardian** and **Patient**.
- Real backend with authentication and database.
- Due reminders, missed-dose escalation, caretaker SMS/call alerts.
- Karnataka district-wise medical and hospital directory.
- Premium landing pages: Home, About, Premium, Login.

**Speaker notes:**
- This is not only a UI prototype; it includes backend APIs and persistent data.

---

## Slide 4 - Technology Stack
**Title:** Tech Stack
- **Frontend:** React + Vite
- **Backend:** Node.js HTTP server
- **Database:** SQLite
- **Authentication:** Token sessions + PBKDF2 password hashing
- **External APIs:** Twilio (SMS/Call), NewsAPI, OpenStreetMap Overpass

**Speaker notes:**
- We used a lightweight but production-style architecture.
- Vite proxy forwards frontend `/api` requests to backend.

---

## Slide 5 - System Architecture
**Title:** High-Level Architecture
1. User uses React web app.
2. Frontend calls backend REST APIs.
3. Backend validates auth and business logic.
4. Data stored in SQLite tables.
5. Scheduler checks overdue medicines every minute.
6. Twilio APIs send SMS/calls for escalation.

**Speaker notes:**
- The architecture is modular: UI, API layer, persistence, and notification services.

---

## Slide 6 - Folder Structure
**Title:** Project Structure
- `/Users/kishan/Desktop/MedCareGuardianApp/src/main.jsx` - app entry point
- `/Users/kishan/Desktop/MedCareGuardianApp/src/App.jsx` - full UI + state logic
- `/Users/kishan/Desktop/MedCareGuardianApp/src/api.js` - all backend API wrappers
- `/Users/kishan/Desktop/MedCareGuardianApp/src/countryCodes.js` - global dial codes
- `/Users/kishan/Desktop/MedCareGuardianApp/server/index.js` - backend + routes + scheduler
- MongoDB database configured with `MONGO_URI` and `MONGO_DB_NAME` - DB

**Speaker notes:**
- Main business logic is split between `App.jsx` on frontend and `server/index.js` on backend.

---

## Slide 7 - Database Design
**Title:** Database Tables
- `users` - account details and role (guardian/patient)
- `sessions` - token hashes and expiry
- `medications` - guardian-created schedules for patients
- `logs` - per-day medication status (taken/escalated)
- `notifications` - sent reminder/escalation/taken SMS history

**Speaker notes:**
- `notifications` table is important for auditability and caregiver visibility.

---

## Slide 8 - Authentication and Security
**Title:** Security Model
- Passwords stored as hash + salt (PBKDF2), never plain text.
- Login returns session token.
- Protected routes require bearer token.
- Role-based authorization for guardian-only and patient-only actions.
- Basic login attempt throttling.

**Speaker notes:**
- This protects sensitive patient workflow and prevents unauthorized edits.

---

## Slide 9 - Guardian Workflow
**Title:** Guardian Interface Flow
1. Guardian logs in.
2. Selects registered patient account.
3. Adds medicine, dosage, time, caretaker phone, notes.
4. Dashboard shows adherence metrics and trend charts.
5. Views notification history and directory tabs.

**Speaker notes:**
- Medication now links only to valid patient accounts, so patient side always receives schedules.

---

## Slide 10 - Patient Workflow
**Title:** Patient Interface Flow
1. Patient logs in.
2. Sees only schedules linked to their email.
3. Receives browser/sound reminder when due.
4. Marks dose as taken.
5. Caretaker gets status update SMS.

**Speaker notes:**
- This closes the loop between patient action and caretaker awareness.

---

## Slide 11 - Reminder and Escalation Engine
**Title:** Reminder + Escalation Logic
- Backend scheduler runs every minute.
- If dose is due: send reminder SMS.
- If overdue by threshold (15 min): escalate.
- Escalation sends missed SMS + optional Twilio call.
- Manual escalation endpoint also available.

**Speaker notes:**
- Automated and manual escalation both exist for reliability.

---

## Slide 12 - Karnataka Directory Feature
**Title:** Medical Stores and Hospitals Directory
- District list for Karnataka.
- Query by district and type (pharmacy/hospital/both).
- Open/closed status parsing from available timings.
- Map direction links for quick navigation.

**Speaker notes:**
- Hassan tab gives quick local view, and directory tab supports all districts.

---

## Slide 13 - Premium UI Features
**Title:** UI and UX Highlights
- Premium landing pages: Home, About, Premium, Login.
- Responsive layout for desktop/mobile.
- Role-based tabs and charts.
- Notification center and directory cards.
- International phone input with country dial codes.

**Speaker notes:**
- Designed to feel product-like, not basic classroom CRUD.

---

## Slide 14 - API Endpoints
**Title:** Key APIs
- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`
- Users: `/api/users/patients`
- Medication: `/api/medications`, `/api/medications/:id/taken`, `/api/medications/:id/escalate`
- Tracking: `/api/logs`, `/api/notifications`
- Public data: `/api/public/news`, `/api/public/pharmacies`, `/api/public/districts`, `/api/public/directory`

**Speaker notes:**
- This API layer allows easy extension to mobile apps in future.

---

## Slide 15 - Demo and Conclusion
**Title:** Demo Flow + Conclusion
**Demo plan:**
1. Login as guardian and create schedule.
2. Login as patient and mark dose.
3. Show notification history update.
4. Show district directory and open-status cards.

**Conclusion:**
- MedAssist provides practical, secure, and scalable medication adherence workflow.
- It solves real coordination gaps between guardian, patient, and caretaker.

**Speaker notes:**
- End with impact: better adherence, faster escalation, better local access.

---

## Optional Viva Questions (Prepare These)
1. Why SQLite instead of MySQL/PostgreSQL?
2. How is password security implemented?
3. What happens if Twilio keys are missing?
4. How does role-based access control work?
5. How do reminders avoid duplicate notifications?

**Suggested answers (short):**
- SQLite is simple and sufficient for prototype/small deployments.
- PBKDF2 with salt protects passwords.
- System falls back to simulated status (`missing_twilio_config`).
- Backend checks token + role before protected routes.
- Notifications table uses unique event keys to prevent duplicates.
