import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createMedication,
  deleteMedication,
  escalateMedication,
  fetchDirectory,
  fetchDistricts,
  fetchHealthNews,
  fetchLogs,
  fetchMe,
  fetchMedications,
  fetchNotifications,
  fetchPatients,
  fetchPharmacies,
  login,
  logout,
  markMedicationTaken,
  registerAccount,
} from './api.js';
import { COUNTRY_CODES } from './countryCodes.js';

const TOKEN_KEY = 'medassist_api_token_v1';
const ESCALATION_MINUTES = 5;

function getAuthStorage() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}
const HASSAN_TIMEZONE = 'Asia/Kolkata';

const HEALTH_NEWS_FALLBACK = [
  {
    id: 'news-fallback-1',
    title: 'WHO expands guidance on digital health for chronic care',
    source: 'World Health Organization',
    published: '2026-02-01',
    url: 'https://www.who.int/news',
  },
  {
    id: 'news-fallback-2',
    title: 'India public health update: stronger preventive screening programs',
    source: 'Ministry of Health and Family Welfare',
    published: '2026-01-26',
    url: 'https://www.mohfw.gov.in/',
  },
];

const PHARMACY_FALLBACK = [
  {
    id: 'ph-fallback-1',
    name: 'Hassan Medico Plus',
    area: 'BM Road, Hassan',
    hours: '07:00-23:00',
    phone: '+91 8172 223344',
    openStatus: 'unknown',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=BM+Road+Hassan+Pharmacy',
    category: 'pharmacy',
  },
  {
    id: 'ph-fallback-2',
    name: '24x7 Care Pharmacy',
    area: 'Near District Hospital, Hassan',
    hours: '24/7',
    phone: '+91 8172 265555',
    openStatus: 'open',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=District+Hospital+Hassan+Pharmacy',
    category: 'pharmacy',
  },
];

const DIRECTORY_FALLBACK = [
  {
    id: 'dir-fallback-ph-1',
    name: 'Hassan Central Medicals',
    area: 'Hassan, Karnataka',
    hours: 'Hours unavailable',
    phone: '-',
    openStatus: 'unknown',
    category: 'pharmacy',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Hassan+pharmacy',
  },
  {
    id: 'dir-fallback-hs-1',
    name: 'District Hospital Hassan',
    area: 'Hassan, Karnataka',
    hours: '24/7',
    phone: '-',
    openStatus: 'open',
    category: 'hospital',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=District+Hospital+Hassan',
  },
];

const NOTIFICATION_LABELS = {
  due_patient: 'Patient Reminder Sent',
  due_caretaker: 'Caretaker Reminder Sent',
  missed_patient: 'Patient Missed Dose Alert',
  missed_caretaker: 'Caretaker Missed Dose Alert',
  taken_caretaker: 'Taken Confirmation to Caretaker',
};

const SYMPTOM_LIBRARY = {
  fever: {
    label: 'Fever / Body pain',
    suggestions: [
      'Paracetamol 500 mg every 6-8 hours if needed (max daily limit applies).',
      'Drink fluids and monitor temperature every 4-6 hours.',
      'Seek clinical care if fever lasts more than 3 days.',
    ],
    redFlags: ['Breathing difficulty', 'Severe dehydration', 'Very high fever (>= 103F)'],
  },
  cold: {
    label: 'Cold / Sore throat',
    suggestions: [
      'Steam inhalation and warm saline gargles 2-3 times/day.',
      'Cetirizine 10 mg at night for allergy symptoms (if suitable).',
      'Use throat lozenges and maintain hydration.',
    ],
    redFlags: ['Persistent chest pain', 'Fever > 101F for 3 days', 'Wheezing'],
  },
  headache: {
    label: 'Headache / Migraine tendency',
    suggestions: [
      'Paracetamol or doctor-approved analgesic as directed.',
      'Reduce screen strain and rest in low-light environment.',
      'Keep a trigger journal for sleep, food, and stress.',
    ],
    redFlags: ['Sudden worst headache', 'Vision changes', 'Speech difficulty'],
  },
  gastric: {
    label: 'Acidity / Gastric discomfort',
    suggestions: [
      'Antacid syrup/tablet after meals as labeled.',
      'Avoid spicy, oily, and late-night meals.',
      'Small frequent meals and upright posture after food.',
    ],
    redFlags: ['Vomiting blood', 'Black stools', 'Severe persistent pain'],
  },
  sugar: {
    label: 'Diabetes follow-up symptoms',
    suggestions: [
      'Check blood glucose and maintain medicine schedule strictly.',
      'Carry quick sugar source if hypoglycemia risk exists.',
      'Consult physician before any dose changes.',
    ],
    redFlags: ['Confusion', 'Repeated low sugar episodes', 'Excessive thirst and weakness'],
  },
};

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function getDatePartsInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = {};
  parts.forEach((part) => {
    map[part.type] = part.value;
  });

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: Number(map.hour || '0'),
    minute: Number(map.minute || '0'),
  };
}

function getDateKeyInTimeZone(date, timeZone) {
  const parts = getDatePartsInTimeZone(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getMinutesNowInTimeZone(date, timeZone) {
  const parts = getDatePartsInTimeZone(date, timeZone);
  return parts.hour * 60 + parts.minute;
}

function parseTimeToMinutes(hhmm) {
  const [hour = '0', minute = '0'] = String(hhmm || '00:00').split(':');
  return Number(hour) * 60 + Number(minute);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatTime(value) {
  if (!value) return '-';
  const [hour = 0, minute = 0] = String(value).split(':').map(Number);
  const d = new Date();
  d.setHours(hour, minute, 0, 0);

  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

function getDoseLog(logs, scheduleId, dateKey) {
  return logs.find((log) => log.scheduleId === scheduleId && log.dateKey === dateKey);
}

function upsertDoseLog(logs, nextLog) {
  const index = logs.findIndex(
    (log) => log.scheduleId === nextLog.scheduleId && log.dateKey === nextLog.dateKey,
  );

  if (index === -1) {
    return [...logs, nextLog];
  }

  const updated = [...logs];
  updated[index] = { ...updated[index], ...nextLog };
  return updated;
}

function getHassanClock(now) {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: HASSAN_TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const map = {};
  parts.forEach((part) => {
    map[part.type] = part.value;
  });

  return `${map.weekday}, ${map.day} ${map.month} ${map.hour}:${map.minute}`;
}

function getScheduleState(schedule, logs, now) {
  const dateKey = getDateKeyInTimeZone(now, HASSAN_TIMEZONE);
  const diffMinutes = getMinutesNowInTimeZone(now, HASSAN_TIMEZONE) - parseTimeToMinutes(schedule.time);
  const log = getDoseLog(logs, schedule.id, dateKey);

  if (log?.status === 'taken') {
    return {
      status: 'taken',
      label: `Taken at ${new Date(log.takenAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      log,
      diffMinutes,
    };
  }

  if (log?.status === 'escalated') {
    return {
      status: 'escalated',
      label: 'Escalated to caretaker',
      log,
      diffMinutes,
    };
  }

  if (diffMinutes < 0) {
    return {
      status: 'upcoming',
      label: `Due in ${Math.abs(diffMinutes)} min`,
      log,
      diffMinutes,
    };
  }

  if (diffMinutes >= ESCALATION_MINUTES) {
    return {
      status: 'escalated',
      label: 'Escalation threshold reached',
      log,
      diffMinutes,
    };
  }

  return {
    status: 'due',
    label: diffMinutes === 0 ? 'Due now' : `Overdue by ${diffMinutes} min`,
    log,
    diffMinutes,
  };
}

function getLastNDays(days) {
  const result = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    result.push(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
  }
  return result;
}

function buildWeeklySummary(schedules, logs) {
  const days = getLastNDays(7);
  const todayKey = getDateKeyInTimeZone(new Date(), HASSAN_TIMEZONE);

  return days.map((day) => {
    const key = getDateKeyInTimeZone(day, HASSAN_TIMEZONE);

    let taken = 0;
    let missed = 0;

    schedules.forEach((schedule) => {
      const log = getDoseLog(logs, schedule.id, key);

      if (log?.status === 'taken') {
        taken += 1;
      } else if (key < todayKey) {
        missed += 1;
      }
    });

    return {
      label: new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        timeZone: HASSAN_TIMEZONE,
      }).format(day),
      total: schedules.length,
      taken,
      missed,
      date: key,
    };
  });
}

function playAlarmTone() {
  if (typeof window === 'undefined') return;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const context = new AudioCtx();
  const pattern = [0, 0.24, 0.48];

  pattern.forEach((offset) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'square';
    osc.frequency.value = 780;
    gain.gain.value = 0.0001;

    osc.connect(gain);
    gain.connect(context.destination);

    const start = context.currentTime + offset;
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    osc.start(start);
    osc.stop(start + 0.2);
  });

  window.setTimeout(() => context.close(), 900);
}

function showBrowserNotification(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    // Keep it short to avoid repetitive noisy notifications.
    new Notification(title, { body });
  } catch {
    // Ignore browser notification errors.
  }
}

function splitPhone(phone) {
  const value = String(phone || '').trim();
  if (!value) {
    return {
      countryCode: '+91',
      number: '',
    };
  }

  const compact = value.replace(/\s+/g, '');
  const ordered = [...COUNTRY_CODES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  const hit = ordered.find((item) => compact.startsWith(item.dialCode));

  if (!hit) {
    return {
      countryCode: '+91',
      number: compact.replace(/[^\d]/g, ''),
    };
  }

  return {
    countryCode: hit.dialCode,
    number: compact.slice(hit.dialCode.length).replace(/[^\d]/g, ''),
  };
}

function composePhone(countryCode, number) {
  const code = String(countryCode || '').trim();
  const digits = String(number || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (!code.startsWith('+')) return `+${digits}`;
  return `${code}${digits}`;
}

function isValidEmail(email) {
  const value = normalizeEmail(email);
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function getPasswordRuleError(password) {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter.';
  if (!/\d/.test(password)) return 'Password must include a number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include a special character.';
  return '';
}

function isValidPhone(phone) {
  return /^\+[1-9]\d{7,14}$/.test(String(phone || '').replace(/\s+/g, ''));
}

function prettifyEventType(eventType) {
  return NOTIFICATION_LABELS[eventType] || eventType.replace(/_/g, ' ');
}

function PhoneField({
  label,
  countryCode,
  number,
  onCountryCodeChange,
  onNumberChange,
  required = false,
}) {
  return (
    <label className="form-row">
      {label}
      <div className="phone-grid">
        <input
          className="text-input"
          list="country-code-options"
          value={countryCode}
          onChange={(event) => onCountryCodeChange(event.target.value)}
          placeholder="+91"
        />
        <datalist id="country-code-options">
          {COUNTRY_CODES.map((item) => (
            <option key={`${item.country}-${item.dialCode}`} value={item.dialCode}>
              {item.country}
            </option>
          ))}
        </datalist>
        <input
          className="text-input"
          type="tel"
          inputMode="tel"
          pattern="[0-9 ]{7,15}"
          value={number}
          onChange={(event) => onNumberChange(event.target.value)}
          placeholder="Mobile number"
          required={required}
        />
      </div>
    </label>
  );
}

function StatsCard({ label, value, note }) {
  return (
    <article className="metric-card">
      <p className="metric-label">{label}</p>
      <h3 className="metric-value">{value}</h3>
      {note ? <p className="metric-note">{note}</p> : null}
    </article>
  );
}

function WeeklyChart({ data }) {
  const maxTotal = Math.max(1, ...data.map((item) => item.total || item.taken + item.missed));

  return (
    <section className="panel chart-wrap">
      <div className="chart-head">
        <div>
          <h2>7-Day Medication Trend</h2>
          <p>Taken vs missed doses for the last 7 days.</p>
        </div>
      </div>

      <div className="chart-grid">
        {data.map((item) => {
          const takenHeight = Math.round((item.taken / maxTotal) * 100);
          const missedHeight = Math.round((item.missed / maxTotal) * 100);

          return (
            <div className="chart-column" key={item.date}>
              <div className="chart-stack">
                <span className="chart-bar chart-bar-missed" style={{ height: `${missedHeight}%` }} />
                <span className="chart-bar chart-bar-taken" style={{ height: `${takenHeight}%` }} />
              </div>
              <span className="chart-day">{item.label}</span>
            </div>
          );
        })}
      </div>

      <div className="chart-legend">
        <span>
          <i className="legend-dot taken" /> Taken
        </span>
        <span>
          <i className="legend-dot missed" /> Missed
        </span>
      </div>
    </section>
  );
}

function AdherenceRing({ percent }) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));

  return (
    <section className="panel ring-wrap">
      <h2>Adherence Score</h2>
      <div className="ring" style={{ '--percent': `${safePercent}%` }}>
        <div className="ring-inner">
          <strong>{safePercent}%</strong>
          <span>last 7 days</span>
        </div>
      </div>
    </section>
  );
}

function RecommendationsPanel() {
  const [symptom, setSymptom] = useState('');
  const [severity, setSeverity] = useState('mild');
  const [ageGroup, setAgeGroup] = useState('adult');

  const recommendation = useMemo(() => {
    if (!symptom) return null;
    return SYMPTOM_LIBRARY[symptom];
  }, [symptom]);

  return (
    <section className="panel">
      <h2>Medication Recommendation Assistant</h2>
      <p className="section-subtitle">
        Select symptoms for guidance. This is educational support, not a medical diagnosis.
      </p>

      <div className="input-grid">
        <label className="form-row">
          Symptom
          <select
            className="text-input"
            value={symptom}
            onChange={(event) => setSymptom(event.target.value)}
          >
            <option value="">Select symptom</option>
            {Object.entries(SYMPTOM_LIBRARY).map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
          </select>
        </label>

        <label className="form-row">
          Severity
          <select
            className="text-input"
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
          </select>
        </label>

        <label className="form-row">
          Age Group
          <select
            className="text-input"
            value={ageGroup}
            onChange={(event) => setAgeGroup(event.target.value)}
          >
            <option value="child">Child</option>
            <option value="adult">Adult</option>
            <option value="senior">Senior</option>
          </select>
        </label>
      </div>

      {!recommendation ? (
        <p className="empty-state">Choose a symptom to generate suggestions.</p>
      ) : (
        <div className="recommendation-box">
          <h3>{recommendation.label}</h3>
          <ul>
            {recommendation.suggestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <p className="recommendation-note">
            Context: {severity} severity, {ageGroup}. If symptoms worsen, consult a doctor immediately.
          </p>

          <h4>Emergency Red Flags</h4>
          <ul>
            {recommendation.redFlags.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function PharmacyPanel({ nowTs, items, loading, error, onRefresh }) {
  const hassanClock = useMemo(() => getHassanClock(new Date(nowTs)), [nowTs]);

  return (
    <section className="panel">
      <div className="med-head">
        <div>
          <h2>Open Pharmacies in Hassan, Karnataka</h2>
          <p className="section-subtitle">Hassan local time: {hassanClock} (IST)</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error ? <p className="form-message">{error}</p> : null}

      <div className="pharmacy-grid">
        {items.map((pharmacy) => (
          <article className="pharmacy-card" key={pharmacy.id}>
            <div className="med-head">
              <h3>{pharmacy.name}</h3>
              <span
                className={`status-chip ${
                  pharmacy.openStatus === 'open'
                    ? 'status-open'
                    : pharmacy.openStatus === 'closed'
                    ? 'status-closed'
                    : 'status-upcoming'
                }`}
              >
                {pharmacy.openStatus === 'open'
                  ? 'Open Now'
                  : pharmacy.openStatus === 'closed'
                  ? 'Closed'
                  : 'Status Unknown'}
              </span>
            </div>

            <p>{pharmacy.area || 'Hassan, Karnataka'}</p>
            <p>Hours: {pharmacy.hours || 'Hours unavailable'}</p>
            <p>Phone: {pharmacy.phone || '-'}</p>

            <a className="link-line" href={pharmacy.mapUrl} target="_blank" rel="noreferrer">
              Open map directions
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function NewsPanel({ items, loading, error, onRefresh }) {
  return (
    <section className="panel">
      <div className="med-head">
        <div>
          <h2>Health News and Updates</h2>
          <p className="section-subtitle">Live feed with fallback if API is unavailable.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error ? <p className="form-message">{error}</p> : null}

      <div className="news-grid">
        {items.map((item) => (
          <article className="news-card" key={item.id}>
            <h3>{item.title}</h3>
            <p>
              {item.source} | {formatDate(item.published)}
            </p>
            <a className="link-line" href={item.url} target="_blank" rel="noreferrer">
              Read update
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function NotificationPanel({ items }) {
  return (
    <section className="panel">
      <h2>SMS and Alert History</h2>
      <p className="section-subtitle">
        Caretaker reminders, missed-dose alerts, and taken confirmations are tracked here.
      </p>

      {items.length === 0 ? (
        <p className="empty-state">No notification events yet.</p>
      ) : (
        <div className="notification-list">
          {items.map((item) => (
            <article className="notification-card" key={item.id}>
              <div className="med-head">
                <h3>{prettifyEventType(item.eventType)}</h3>
                <span className="status-chip status-upcoming">{item.status || 'queued'}</span>
              </div>
              <p>
                Medicine: <strong>{item.medicineName || '-'}</strong>
              </p>
              <p>
                Patient: <strong>{item.patientEmail || '-'}</strong>
              </p>
              <p>Recipient: {item.recipientPhone || '-'}</p>
              <p>{item.message}</p>
              <p>
                Sent: <strong>{formatDate(item.createdAt)}</strong>
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DirectoryPanel({
  district,
  type,
  districts,
  items,
  loading,
  error,
  onDistrictChange,
  onTypeChange,
  onRefresh,
}) {
  return (
    <section className="panel">
      <div className="med-head">
        <div>
          <h2>Karnataka Medical and Hospital Directory</h2>
          <p className="section-subtitle">
            District-wise pharmacy and hospital availability with open-status where available.
          </p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="directory-controls">
        <label className="form-row">
          District
          <select
            className="text-input"
            value={district}
            onChange={(event) => onDistrictChange(event.target.value)}
          >
            {districts.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="form-row">
          Type
          <select className="text-input" value={type} onChange={(event) => onTypeChange(event.target.value)}>
            <option value="both">Hospitals + Medical Stores</option>
            <option value="pharmacy">Medical Stores</option>
            <option value="hospital">Hospitals</option>
          </select>
        </label>
      </div>

      {error ? <p className="form-message">{error}</p> : null}

      <div className="directory-grid">
        {items.map((item) => (
          <article className="pharmacy-card" key={item.id}>
            <div className="med-head">
              <h3>{item.name}</h3>
              <span
                className={`status-chip ${
                  item.openStatus === 'open'
                    ? 'status-open'
                    : item.openStatus === 'closed'
                    ? 'status-closed'
                    : 'status-upcoming'
                }`}
              >
                {item.openStatus === 'open'
                  ? 'Open'
                  : item.openStatus === 'closed'
                  ? 'Closed'
                  : 'Unknown'}
              </span>
            </div>
            <p>
              <span className={`category-chip ${item.category === 'hospital' ? 'hospital' : 'pharmacy'}`}>
                {item.category === 'hospital' ? 'Hospital' : 'Medical Store'}
              </span>
            </p>
            <p>{item.area || '-'}</p>
            <p>Hours: {item.hours || 'Hours unavailable'}</p>
            <p>Phone: {item.phone || '-'}</p>
            <a className="link-line" href={item.mapUrl} target="_blank" rel="noreferrer">
              Open map directions
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function PublicWebsite({ page, setPage, authView }) {
  return (
    <main className="public-shell">
      <header className="public-nav panel">
        <div className="brand">
          <h1>MedAssist Prime</h1>
          <p>Premium care workflow for medication adherence and emergency escalation.</p>
        </div>

        <nav className="tab-strip">
          <button
            type="button"
            className={page === 'home' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setPage('home')}
          >
            Home
          </button>
          <button
            type="button"
            className={page === 'about' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setPage('about')}
          >
            About
          </button>
          <button
            type="button"
            className={page === 'premium' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setPage('premium')}
          >
            Premium
          </button>
          <button
            type="button"
            className={page === 'login' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setPage('login')}
          >
            Login
          </button>
        </nav>
      </header>

      {page === 'home' ? (
        <section className="panel public-hero">
          <h2>Care that reminds, tracks, and escalates before it is too late.</h2>
          <p>
            Guardian-patient coordination, SMS reminders, caretaker escalation, and district-wide
            medical directory in one secure platform.
          </p>
          <div className="public-feature-grid">
            <article className="public-feature-card">
              <h3>Guardian + Patient Portals</h3>
              <p>Two role-based interfaces with secure login and synchronized medication tracking.</p>
            </article>
            <article className="public-feature-card">
              <h3>SMS + Call Escalation</h3>
              <p>Automatic reminders and missed-dose escalation through Twilio SMS alerts.</p>
            </article>
            <article className="public-feature-card">
              <h3>Karnataka Health Directory</h3>
              <p>District-wise hospital and pharmacy lookup with open-status where data is available.</p>
            </article>
          </div>
          <button className="btn" type="button" onClick={() => setPage('login')}>
            Enter Secure Login
          </button>
        </section>
      ) : null}

      {page === 'about' ? (
        <section className="panel public-section">
          <h2>About MedAssist Prime</h2>
          <p>
            This platform is designed for families managing daily medication routines. Guardians add medicine
            schedules, patients mark doses, and caretaker alerts are automatically sent for both taken and
            missed status.
          </p>
          <p>
            Important: recommendations inside this app are educational. For diagnosis and prescriptions, always
            consult licensed medical professionals.
          </p>
        </section>
      ) : null}

      {page === 'premium' ? (
        <section className="panel public-section">
          <h2>Premium Plan Highlights</h2>
          <div className="public-feature-grid">
            <article className="public-feature-card">
              <h3>Secure Backend</h3>
              <p>PBKDF2 password hashing, server sessions, and MongoDB persistence for reliability.</p>
            </article>
            <article className="public-feature-card">
              <h3>Global Phone Input</h3>
              <p>International country-code support for guardian, patient, and caretaker contact numbers.</p>
            </article>
            <article className="public-feature-card">
              <h3>Operational Dashboard</h3>
              <p>Charts, adherence score, notification logs, and district directory in one premium UI.</p>
            </article>
          </div>
          <button className="btn" type="button" onClick={() => setPage('login')}>
            Start with Login
          </button>
        </section>
      ) : null}

      {page === 'login' ? authView : null}
    </main>
  );
}

function AuthScreen({ onLogin, onRegister }) {
  const [mode, setMode] = useState('login');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });

  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'patient',
    city: 'Hassan, Karnataka',
    phoneCountryCode: '+91',
    phoneLocal: '',
  });

  async function submitLogin(event) {
    event.preventDefault();
    setSubmitting(true);

    const result = await onLogin(loginForm.email, loginForm.password);
    setNotice(result.message);
    setSubmitting(false);
  }

  async function submitRegister(event) {
    event.preventDefault();
    setSubmitting(true);

    const phone = composePhone(registerForm.phoneCountryCode, registerForm.phoneLocal);

    if (!isValidEmail(registerForm.email)) {
      setNotice('Enter a valid email address.');
      setSubmitting(false);
      return;
    }

    const passwordError = getPasswordRuleError(registerForm.password);
    if (passwordError) {
      setNotice(passwordError);
      setSubmitting(false);
      return;
    }

    if (phone && !isValidPhone(phone)) {
      setNotice('Enter a valid phone number with country code.');
      setSubmitting(false);
      return;
    }

    const payload = {
      name: registerForm.name,
      email: registerForm.email,
      password: registerForm.password,
      role: registerForm.role,
      city: registerForm.city,
      phone,
    };

    const result = await onRegister(payload);
    setNotice(result.message);

    if (result.ok) {
      setRegisterForm((prev) => ({
        ...prev,
        name: '',
        email: '',
        password: '',
        phoneLocal: '',
      }));
    }

    setSubmitting(false);
  }

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <div className="auth-head">
          <h1>MedAssist Secure Login</h1>
          <p>Role-based portal with SMS reminders and caretaker escalation.</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        {mode === 'login' ? (
          <form className="auth-form" onSubmit={submitLogin}>
            <label className="form-row">
              Email
              <input
                className="text-input"
                type="email"
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm((prev) => ({ ...prev, email: event.target.value }))
                }
                required
              />
            </label>

            <label className="form-row">
              Password
              <input
                className="text-input"
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                }
                required
              />
            </label>

            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Please wait...' : 'Enter Portal'}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={submitRegister}>
            <label className="form-row">
              Full Name
              <input
                className="text-input"
                type="text"
                value={registerForm.name}
                onChange={(event) =>
                  setRegisterForm((prev) => ({ ...prev, name: event.target.value }))
                }
                required
              />
            </label>

            <label className="form-row">
              Email
              <input
                className="text-input"
                type="email"
                autoComplete="email"
                value={registerForm.email}
                onChange={(event) =>
                  setRegisterForm((prev) => ({ ...prev, email: event.target.value }))
                }
                required
              />
            </label>

            <label className="form-row">
              Password
              <input
                className="text-input"
                type="password"
                autoComplete="new-password"
                minLength={8}
                title="Use at least 8 characters with uppercase, lowercase, number, and special character."
                placeholder="8+ chars, Aa, 0-9, symbol"
                value={registerForm.password}
                onChange={(event) =>
                  setRegisterForm((prev) => ({ ...prev, password: event.target.value }))
                }
                required
              />
            </label>

            <div className="input-grid">
              <label className="form-row">
                Role
                <select
                  className="text-input"
                  value={registerForm.role}
                  onChange={(event) =>
                    setRegisterForm((prev) => ({ ...prev, role: event.target.value }))
                  }
                >
                  <option value="patient">Patient</option>
                  <option value="guardian">Guardian</option>
                </select>
              </label>

              <label className="form-row">
                City
                <input
                  className="text-input"
                  type="text"
                  value={registerForm.city}
                  onChange={(event) =>
                    setRegisterForm((prev) => ({ ...prev, city: event.target.value }))
                  }
                  required
                />
              </label>
            </div>

            <PhoneField
              label="Primary Phone (Global)"
              countryCode={registerForm.phoneCountryCode}
              number={registerForm.phoneLocal}
              onCountryCodeChange={(value) =>
                setRegisterForm((prev) => ({ ...prev, phoneCountryCode: value }))
              }
              onNumberChange={(value) =>
                setRegisterForm((prev) => ({ ...prev, phoneLocal: value }))
              }
            />

            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        )}

        <p className="auth-notice">{notice}</p>
      </section>
    </main>
  );
}

function GuardianWorkspace({
  user,
  medications,
  logs,
  notifications,
  patients,
  nowTs,
  onAddMedication,
  onDeleteMedication,
  onRefreshData,
  pharmacies,
  pharmacyLoading,
  pharmacyError,
  onRefreshPharmacies,
  news,
  newsLoading,
  newsError,
  onRefreshNews,
  directoryState,
  onDirectoryDistrictChange,
  onDirectoryTypeChange,
  onRefreshDirectory,
}) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const initialPhone = useMemo(() => splitPhone(user.phone), [user.phone]);

  const [form, setForm] = useState({
    patientEmail: '',
    medicineName: '',
    dosage: '',
    time: '08:00',
    notes: '',
    caretakerCode: initialPhone.countryCode,
    caretakerNumber: initialPhone.number,
  });

  useEffect(() => {
    if (patients.length > 0) {
      const exists = patients.some((patient) => normalizeEmail(patient.email) === normalizeEmail(form.patientEmail));
      if (!exists) {
        setForm((prev) => ({
          ...prev,
          patientEmail: patients[0].email,
        }));
      }
    }
  }, [patients, form.patientEmail]);

  const mySchedules = useMemo(
    () => medications.filter((item) => item.guardianId === user.id),
    [medications, user.id],
  );

  const todayKey = getDateKeyInTimeZone(new Date(nowTs), HASSAN_TIMEZONE);

  const dashboardStats = useMemo(() => {
    const totalToday = mySchedules.length;
    let takenToday = 0;
    let escalatedToday = 0;

    mySchedules.forEach((schedule) => {
      const log = getDoseLog(logs, schedule.id, todayKey);
      if (log?.status === 'taken') takenToday += 1;
      if (log?.status === 'escalated') escalatedToday += 1;
    });

    const adherence = totalToday === 0 ? 100 : Math.round((takenToday / totalToday) * 100);

    return { totalToday, takenToday, escalatedToday, adherence };
  }, [logs, mySchedules, todayKey]);

  const weekly = useMemo(() => buildWeeklySummary(mySchedules, logs), [mySchedules, logs]);
  const weeklyTaken = weekly.reduce((sum, item) => sum + item.taken, 0);
  const weeklyExpected = Math.max(1, mySchedules.length * 7);
  const adherencePercent = Math.round((weeklyTaken / weeklyExpected) * 100);

  async function submitMedication(event) {
    event.preventDefault();

    if (patients.length === 0) {
      setMessage('No patient users found. Register a patient account first.');
      return;
    }

    const caretakerPhone = composePhone(form.caretakerCode, form.caretakerNumber);
    if (!isValidPhone(caretakerPhone)) {
      setMessage('Enter a valid caretaker phone number with country code.');
      return;
    }

    setSaving(true);

    const result = await onAddMedication({
      patientEmail: form.patientEmail,
      medicineName: form.medicineName,
      dosage: form.dosage,
      time: form.time,
      notes: form.notes,
      caretakerPhone,
    });

    setMessage(result.message);
    setSaving(false);

    if (result.ok) {
      setForm((prev) => ({
        ...prev,
        medicineName: '',
        dosage: '',
        notes: '',
      }));
      setActiveTab('dashboard');
    }
  }

  async function handleDelete(id) {
    const result = await onDeleteMedication(id);
    setMessage(result.message);
  }

  return (
    <div className="content-wrap">
      <div className="tab-strip">
        <button
          type="button"
          className={activeTab === 'dashboard' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={activeTab === 'schedule' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('schedule')}
        >
          Add Schedule
        </button>
        <button
          type="button"
          className={activeTab === 'notifications' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('notifications')}
        >
          Notifications
        </button>
        <button
          type="button"
          className={activeTab === 'directory' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('directory')}
        >
          Karnataka Directory
        </button>
        <button
          type="button"
          className={activeTab === 'pharmacy' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('pharmacy')}
        >
          Hassan Open Now
        </button>
        <button
          type="button"
          className={activeTab === 'news' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('news')}
        >
          News
        </button>
        <button
          type="button"
          className={activeTab === 'recommend' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('recommend')}
        >
          Recommendations
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <>
          <section className="metric-grid">
            <StatsCard
              label="Today Scheduled"
              value={dashboardStats.totalToday}
              note="Total patient doses today"
            />
            <StatsCard
              label="Taken"
              value={dashboardStats.takenToday}
              note="Marked by patient"
            />
            <StatsCard
              label="Escalated"
              value={dashboardStats.escalatedToday}
              note={`Over ${ESCALATION_MINUTES} min missed`}
            />
            <StatsCard
              label="Today Adherence"
              value={`${dashboardStats.adherence}%`}
              note="Completion ratio"
            />
          </section>

          <div className="split-grid">
            <WeeklyChart data={weekly} />
            <AdherenceRing percent={adherencePercent} />
          </div>

          <section className="panel">
            <div className="med-head">
              <div>
                <h2>Active Medication Plans</h2>
                <p className="section-subtitle">
                  Schedules are now linked to registered patient accounts to avoid missing on patient side.
                </p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={onRefreshData}>
                Refresh
              </button>
            </div>

            {mySchedules.length === 0 ? (
              <p className="empty-state">No medication schedules yet.</p>
            ) : (
              <div className="list-grid">
                {mySchedules.map((item) => {
                  const state = getScheduleState(item, logs, new Date(nowTs));
                  return (
                    <article className="med-card" key={item.id}>
                      <div className="med-head">
                        <h3>{item.medicineName}</h3>
                        <span className={`status-chip status-${state.status}`}>{state.label}</span>
                      </div>
                      <p>{item.dosage}</p>
                      <p>
                        Patient: <strong>{item.patientEmail}</strong>
                      </p>
                      <p>
                        Time: <strong>{formatTime(item.time)}</strong>
                      </p>
                      <p>Notes: {item.notes || '-'}</p>
                      <p>Caretaker: {item.caretakerPhone || '-'}</p>
                      <div className="med-actions">
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => handleDelete(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : null}

      {activeTab === 'schedule' ? (
        <section className="panel form-card">
          <h2>Create Medication Plan</h2>
          <p className="section-subtitle">
            Select a registered patient account and configure reminders/escalation.
          </p>

          {patients.length === 0 ? (
            <p className="empty-state">
              No patient accounts are available. Ask patient to register first in Login page.
            </p>
          ) : null}

          <form onSubmit={submitMedication}>
            <div className="input-grid">
              <label className="form-row">
                Patient Account
                <select
                  className="text-input"
                  value={form.patientEmail}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, patientEmail: event.target.value }))
                  }
                  required
                >
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.email}>
                      {patient.name} ({patient.email})
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-row">
                Medicine Name
                <input
                  className="text-input"
                  type="text"
                  value={form.medicineName}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, medicineName: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="form-row">
                Dosage
                <input
                  className="text-input"
                  type="text"
                  value={form.dosage}
                  onChange={(event) => setForm((prev) => ({ ...prev, dosage: event.target.value }))}
                  placeholder="e.g., 1 tablet / 500 mg"
                  required
                />
              </label>

              <label className="form-row">
                Time
                <input
                  className="text-input"
                  type="time"
                  value={form.time}
                  onChange={(event) => setForm((prev) => ({ ...prev, time: event.target.value }))}
                  required
                />
              </label>
            </div>

            <PhoneField
              label="Caretaker Phone"
              countryCode={form.caretakerCode}
              number={form.caretakerNumber}
              onCountryCodeChange={(value) => setForm((prev) => ({ ...prev, caretakerCode: value }))}
              onNumberChange={(value) => setForm((prev) => ({ ...prev, caretakerNumber: value }))}
              required
            />

            <label className="form-row">
              Notes
              <textarea
                className="text-input text-area"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Before food / after food / special instructions"
              />
            </label>

            <div className="form-actions">
              <button className="btn" type="submit" disabled={saving || patients.length === 0}>
                {saving ? 'Saving...' : 'Save Medication Plan'}
              </button>
            </div>
          </form>

          {message ? <p className="form-message">{message}</p> : null}
        </section>
      ) : null}

      {activeTab === 'notifications' ? <NotificationPanel items={notifications} /> : null}

      {activeTab === 'directory' ? (
        <DirectoryPanel
          district={directoryState.district}
          type={directoryState.type}
          districts={directoryState.districts}
          items={directoryState.items}
          loading={directoryState.loading}
          error={directoryState.error}
          onDistrictChange={onDirectoryDistrictChange}
          onTypeChange={onDirectoryTypeChange}
          onRefresh={onRefreshDirectory}
        />
      ) : null}

      {activeTab === 'pharmacy' ? (
        <PharmacyPanel
          nowTs={nowTs}
          items={pharmacies}
          loading={pharmacyLoading}
          error={pharmacyError}
          onRefresh={onRefreshPharmacies}
        />
      ) : null}

      {activeTab === 'news' ? (
        <NewsPanel items={news} loading={newsLoading} error={newsError} onRefresh={onRefreshNews} />
      ) : null}

      {activeTab === 'recommend' ? <RecommendationsPanel /> : null}
    </div>
  );
}

function PatientWorkspace({
  user,
  medications,
  logs,
  notifications,
  nowTs,
  onMarkTaken,
  onEscalate,
  onRefreshData,
  soundEnabled,
  browserAlerts,
  onToggleSound,
  onToggleBrowserAlerts,
  pharmacies,
  pharmacyLoading,
  pharmacyError,
  onRefreshPharmacies,
  news,
  newsLoading,
  newsError,
  onRefreshNews,
  directoryState,
  onDirectoryDistrictChange,
  onDirectoryTypeChange,
  onRefreshDirectory,
}) {
  const [activeTab, setActiveTab] = useState('dashboard');

  const mySchedules = useMemo(
    () => medications.filter((item) => normalizeEmail(item.patientEmail) === normalizeEmail(user.email)),
    [medications, user.email],
  );

  const scheduleStates = useMemo(
    () => mySchedules.map((item) => ({ item, state: getScheduleState(item, logs, new Date(nowTs)) })),
    [logs, mySchedules, nowTs],
  );

  const takenToday = scheduleStates.filter(({ state }) => state.status === 'taken').length;
  const dueNow = scheduleStates.filter(({ state }) => state.status === 'due').length;
  const escalated = scheduleStates.filter(({ state }) => state.status === 'escalated').length;
  const totalToday = scheduleStates.length;

  const weekly = useMemo(() => buildWeeklySummary(mySchedules, logs), [mySchedules, logs]);
  const weeklyTaken = weekly.reduce((sum, item) => sum + item.taken, 0);
  const weeklyExpected = Math.max(1, mySchedules.length * 7);
  const adherencePercent = Math.round((weeklyTaken / weeklyExpected) * 100);

  return (
    <div className="content-wrap">
      <div className="tab-strip">
        <button
          type="button"
          className={activeTab === 'dashboard' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={activeTab === 'medicines' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('medicines')}
        >
          Today Medicines
        </button>
        <button
          type="button"
          className={activeTab === 'notifications' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('notifications')}
        >
          Notifications
        </button>
        <button
          type="button"
          className={activeTab === 'directory' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('directory')}
        >
          Karnataka Directory
        </button>
        <button
          type="button"
          className={activeTab === 'pharmacy' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('pharmacy')}
        >
          Hassan Open Now
        </button>
        <button
          type="button"
          className={activeTab === 'news' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('news')}
        >
          News
        </button>
        <button
          type="button"
          className={activeTab === 'recommend' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('recommend')}
        >
          Recommendations
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <>
          <section className="metric-grid">
            <StatsCard label="Scheduled Today" value={totalToday} note="Total doses planned" />
            <StatsCard label="Taken" value={takenToday} note="You completed" />
            <StatsCard label="Due / Overdue" value={dueNow} note="Action needed now" />
            <StatsCard label="Escalated" value={escalated} note="Caretaker alerted" />
          </section>

          <div className="split-grid">
            <WeeklyChart data={weekly} />
            <AdherenceRing percent={adherencePercent} />
          </div>

          <section className="panel">
            <div className="med-head">
              <div>
                <h2>Reminder Settings</h2>
                <p className="section-subtitle">
                  Sound + browser alerts keep you informed, while backend SMS alerts inform caretaker.
                </p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={onRefreshData}>
                Refresh
              </button>
            </div>

            <label className="toggle-row" htmlFor="sound-toggle">
              <span>Medication Alarm Sound</span>
              <input
                id="sound-toggle"
                type="checkbox"
                checked={soundEnabled}
                onChange={(event) => onToggleSound(event.target.checked)}
              />
            </label>

            <label className="toggle-row" htmlFor="browser-alert-toggle">
              <span>Browser Notifications</span>
              <input
                id="browser-alert-toggle"
                type="checkbox"
                checked={browserAlerts}
                onChange={(event) => onToggleBrowserAlerts(event.target.checked)}
              />
            </label>
          </section>
        </>
      ) : null}

      {activeTab === 'medicines' ? (
        <section className="panel">
          <h2>My Medication List</h2>
          <p className="section-subtitle">
            If not taken within {ESCALATION_MINUTES} minutes, caretaker SMS escalation will trigger.
          </p>

          {scheduleStates.length === 0 ? (
            <p className="empty-state">No schedules linked to your account yet.</p>
          ) : (
            <div className="list-grid">
              {scheduleStates.map(({ item, state }) => (
                <article className="med-card" key={item.id}>
                  <div className="med-head">
                    <h3>{item.medicineName}</h3>
                    <span className={`status-chip status-${state.status}`}>{state.label}</span>
                  </div>

                  <p>{item.dosage}</p>
                  <p>
                    Due time: <strong>{formatTime(item.time)}</strong>
                  </p>
                  <p>Instructions: {item.notes || '-'}</p>
                  <p>Caretaker: {item.caretakerPhone || '-'}</p>

                  {state.log?.caretakerCalledAt ? (
                    <p className="escalation-note">
                      Caretaker SMS escalation triggered at{' '}
                      {new Date(state.log.caretakerCalledAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  ) : null}

                  <div className="med-actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => onMarkTaken(item)}
                      disabled={state.status === 'taken'}
                    >
                      {state.status === 'taken' ? 'Already Taken' : 'Mark as Taken'}
                    </button>

                    {(state.status === 'due' || state.status === 'escalated') && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => onEscalate(item)}
                      >
                        Escalate Now
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === 'notifications' ? <NotificationPanel items={notifications} /> : null}

      {activeTab === 'directory' ? (
        <DirectoryPanel
          district={directoryState.district}
          type={directoryState.type}
          districts={directoryState.districts}
          items={directoryState.items}
          loading={directoryState.loading}
          error={directoryState.error}
          onDistrictChange={onDirectoryDistrictChange}
          onTypeChange={onDirectoryTypeChange}
          onRefresh={onRefreshDirectory}
        />
      ) : null}

      {activeTab === 'pharmacy' ? (
        <PharmacyPanel
          nowTs={nowTs}
          items={pharmacies}
          loading={pharmacyLoading}
          error={pharmacyError}
          onRefresh={onRefreshPharmacies}
        />
      ) : null}

      {activeTab === 'news' ? (
        <NewsPanel items={news} loading={newsLoading} error={newsError} onRefresh={onRefreshNews} />
      ) : null}

      {activeTab === 'recommend' ? <RecommendationsPanel /> : null}
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(() => getAuthStorage()?.getItem(TOKEN_KEY) || '');
  const [session, setSession] = useState(null);
  const [medications, setMedications] = useState([]);
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [patients, setPatients] = useState([]);

  const [nowTs, setNowTs] = useState(Date.now());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [browserAlerts, setBrowserAlerts] = useState(false);

  const [appError, setAppError] = useState('');
  const [appNotice, setAppNotice] = useState('');
  const [booting, setBooting] = useState(false);

  const [publicPage, setPublicPage] = useState('home');

  const [news, setNews] = useState(HEALTH_NEWS_FALLBACK);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState('');

  const [pharmacies, setPharmacies] = useState(PHARMACY_FALLBACK);
  const [pharmacyLoading, setPharmacyLoading] = useState(false);
  const [pharmacyError, setPharmacyError] = useState('');

  const [districts, setDistricts] = useState(['Hassan']);
  const [directoryDistrict, setDirectoryDistrict] = useState('Hassan');
  const [directoryType, setDirectoryType] = useState('both');
  const [directoryItems, setDirectoryItems] = useState(DIRECTORY_FALLBACK);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState('');

  const lastAlarmMinuteRef = useRef(null);
  const lastBrowserNotifyMinuteRef = useRef(null);
  const escalationLockRef = useRef(new Set());

  useEffect(() => {
    const storage = getAuthStorage();
    if (!storage) return;

    if (token) {
      storage.setItem(TOKEN_KEY, token);
    } else {
      storage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const refreshSecureData = useCallback(async (authToken) => {
    const meRes = await fetchMe(authToken);
    const [medicationRes, logRes, notificationRes] = await Promise.all([
      fetchMedications(authToken),
      fetchLogs(authToken),
      fetchNotifications(authToken),
    ]);

    setSession(meRes.user);
    setMedications(medicationRes.items || []);
    setLogs(logRes.items || []);
    setNotifications(notificationRes.items || []);

    if (meRes.user.role === 'guardian') {
      const patientRes = await fetchPatients(authToken);
      setPatients(patientRes.items || []);
    } else {
      setPatients([]);
    }

    setAppError('');
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setSession(null);
      setMedications([]);
      setLogs([]);
      setNotifications([]);
      setPatients([]);
      setBooting(false);
      return undefined;
    }

    setBooting(true);

    refreshSecureData(token)
      .catch((error) => {
        if (cancelled) return;
        setToken('');
        setAppError(error.message || 'Session expired. Please login again.');
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, refreshSecureData]);

  useEffect(() => {
    if (!token || !session) return undefined;

    const poll = window.setInterval(() => {
      refreshSecureData(token).catch(() => {
        // Keep UI stable during temporary backend/network issues.
      });
    }, 10000);

    return () => window.clearInterval(poll);
  }, [token, session, refreshSecureData]);

  useEffect(() => {
    if (!token || !session) return undefined;
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const syncIfVisible = () => {
      if (document.visibilityState !== 'visible') return;
      refreshSecureData(token).catch(() => {
        // Keep UI stable during temporary backend/network issues.
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncIfVisible();
      }
    };

    window.addEventListener('focus', syncIfVisible);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', syncIfVisible);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [token, session, refreshSecureData]);

  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    setNewsError('');

    try {
      const response = await fetchHealthNews();
      setNews(response.items?.length ? response.items : HEALTH_NEWS_FALLBACK);
    } catch (error) {
      setNews(HEALTH_NEWS_FALLBACK);
      setNewsError(`Using fallback news. ${error.message || ''}`.trim());
    } finally {
      setNewsLoading(false);
    }
  }, []);

  const loadPharmacies = useCallback(async () => {
    setPharmacyLoading(true);
    setPharmacyError('');

    try {
      const response = await fetchPharmacies();
      setPharmacies(response.items?.length ? response.items : PHARMACY_FALLBACK);
    } catch (error) {
      setPharmacies(PHARMACY_FALLBACK);
      setPharmacyError(`Using fallback pharmacies. ${error.message || ''}`.trim());
    } finally {
      setPharmacyLoading(false);
    }
  }, []);

  const loadDistricts = useCallback(async () => {
    try {
      const response = await fetchDistricts();
      const items = response.items?.length ? response.items : ['Hassan'];
      setDistricts(items);
      if (!items.includes(directoryDistrict)) {
        setDirectoryDistrict(items.includes('Hassan') ? 'Hassan' : items[0]);
      }
    } catch {
      setDistricts(['Hassan']);
      setDirectoryDistrict('Hassan');
    }
  }, [directoryDistrict]);

  const loadDirectory = useCallback(async (district, type) => {
    setDirectoryLoading(true);
    setDirectoryError('');

    try {
      const response = await fetchDirectory(district, type);
      setDirectoryItems(response.items?.length ? response.items : DIRECTORY_FALLBACK);
    } catch (error) {
      setDirectoryItems(DIRECTORY_FALLBACK);
      setDirectoryError(`Using fallback directory. ${error.message || ''}`.trim());
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNews();
    loadPharmacies();
    loadDistricts();
  }, [loadNews, loadPharmacies, loadDistricts]);

  useEffect(() => {
    loadDirectory(directoryDistrict, directoryType);
  }, [directoryDistrict, directoryType, loadDirectory]);

  const patientSchedules = useMemo(() => {
    if (!session || session.role !== 'patient') return [];

    return medications.filter(
      (item) => normalizeEmail(item.patientEmail) === normalizeEmail(session.email),
    );
  }, [medications, session]);

  useEffect(() => {
    if (!session || session.role !== 'patient' || !token) return;

    const now = new Date(nowTs);
    const dateKey = getDateKeyInTimeZone(now, HASSAN_TIMEZONE);

    let shouldAlarm = false;
    let dueCount = 0;
    const needEscalation = [];

    patientSchedules.forEach((schedule) => {
      const state = getScheduleState(schedule, logs, now);

      if (state.status === 'due' && state.diffMinutes >= 0 && state.diffMinutes < ESCALATION_MINUTES) {
        shouldAlarm = true;
        dueCount += 1;
      }

      if (state.status !== 'taken' && state.diffMinutes >= ESCALATION_MINUTES) {
        const lockKey = `${schedule.id}:${dateKey}`;
        if (!escalationLockRef.current.has(lockKey)) {
          escalationLockRef.current.add(lockKey);
          needEscalation.push({ scheduleId: schedule.id, lockKey });
        }
      }
    });

    if (soundEnabled && shouldAlarm) {
      const minuteStamp = Math.floor(now.getTime() / 60000);
      if (lastAlarmMinuteRef.current !== minuteStamp) {
        playAlarmTone();
        lastAlarmMinuteRef.current = minuteStamp;
      }
    }

    if (browserAlerts && shouldAlarm) {
      const minuteStamp = Math.floor(now.getTime() / 60000);
      if (lastBrowserNotifyMinuteRef.current !== minuteStamp) {
        showBrowserNotification(
          'Medication Reminder',
          `${dueCount} medicine${dueCount > 1 ? 's are' : ' is'} due now. Please mark as taken.`,
        );
        lastBrowserNotifyMinuteRef.current = minuteStamp;
      }
    }

    if (needEscalation.length > 0) {
      (async () => {
        for (const item of needEscalation) {
          try {
            const response = await escalateMedication(token, item.scheduleId);
            if (response.log) {
              setLogs((prev) => upsertDoseLog(prev, response.log));
            }
            setAppNotice('Caretaker SMS escalation sent.');
          } catch {
            escalationLockRef.current.delete(item.lockKey);
          }
        }
      })();
    }
  }, [browserAlerts, logs, nowTs, patientSchedules, session, soundEnabled, token]);

  async function handleLogin(email, password) {
    try {
      const response = await login(email, password);
      setToken(response.token);
      setSession(response.user);
      setPublicPage('home');
      return { ok: true, message: `Welcome ${response.user.name}.` };
    } catch (error) {
      return { ok: false, message: error.message || 'Login failed.' };
    }
  }

  async function handleRegister(form) {
    try {
      const response = await registerAccount(form);
      setToken(response.token);
      setSession(response.user);
      setPublicPage('home');
      return { ok: true, message: `Account created for ${response.user.name}.` };
    } catch (error) {
      return { ok: false, message: error.message || 'Registration failed.' };
    }
  }

  async function addMedicationPlan(payload) {
    if (!token) {
      return { ok: false, message: 'Not authenticated.' };
    }

    try {
      await createMedication(token, payload);
      await refreshSecureData(token);
      return { ok: true, message: 'Medication schedule saved and linked to patient account.' };
    } catch (error) {
      return { ok: false, message: error.message || 'Unable to save medication schedule.' };
    }
  }

  async function removeMedicationPlan(id) {
    if (!token) {
      return { ok: false, message: 'Not authenticated.' };
    }

    try {
      await deleteMedication(token, id);
      await refreshSecureData(token);
      return { ok: true, message: 'Medication schedule deleted.' };
    } catch (error) {
      return { ok: false, message: error.message || 'Unable to delete medication schedule.' };
    }
  }

  async function markAsTaken(schedule) {
    if (!token) return;

    try {
      const response = await markMedicationTaken(token, schedule.id);
      if (response.log) {
        setLogs((prev) => upsertDoseLog(prev, response.log));
      }
      if (response.smsResult?.result?.message) {
        setAppNotice(response.smsResult.result.message);
      } else {
        setAppNotice('Dose marked as taken. Caretaker update triggered.');
      }
      refreshSecureData(token).catch(() => {
        // Keep interaction smooth if refresh fails.
      });
    } catch {
      setAppError('Failed to mark medication as taken.');
    }
  }

  async function escalateNow(schedule) {
    if (!token) return;

    try {
      const response = await escalateMedication(token, schedule.id);
      if (response.log) {
        setLogs((prev) => upsertDoseLog(prev, response.log));
      }

      setAppNotice('Caretaker SMS escalation sent.');

      refreshSecureData(token).catch(() => {
        // Keep interaction smooth if refresh fails.
      });
    } catch {
      setAppError('Escalation request failed.');
    }
  }

  async function logoutSession() {
    if (token) {
      try {
        await logout(token);
      } catch {
        // Ignore logout API errors and clear local session.
      }
    }

    setToken('');
    setSession(null);
    setMedications([]);
    setLogs([]);
    setNotifications([]);
    setPatients([]);
    setAppError('');
    setAppNotice('');
    setPublicPage('home');
  }

  function handleToggleBrowserAlerts(nextValue) {
    if (!nextValue) {
      setBrowserAlerts(false);
      return;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      setAppError('Browser notifications are not supported on this device.');
      setBrowserAlerts(false);
      return;
    }

    if (Notification.permission === 'granted') {
      setBrowserAlerts(true);
      return;
    }

    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        setBrowserAlerts(true);
      } else {
        setBrowserAlerts(false);
        setAppError('Notification permission denied. Enable it in browser settings.');
      }
    });
  }

  if (!session && !token) {
    return (
      <PublicWebsite
        page={publicPage}
        setPage={setPublicPage}
        authView={<AuthScreen onLogin={handleLogin} onRegister={handleRegister} />}
      />
    );
  }

  if (booting && !session) {
    return (
      <main className="auth-wrap">
        <section className="auth-card">
          <h1>Loading secure workspace...</h1>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <PublicWebsite
        page="login"
        setPage={setPublicPage}
        authView={<AuthScreen onLogin={handleLogin} onRegister={handleRegister} />}
      />
    );
  }

  const directoryState = {
    district: directoryDistrict,
    type: directoryType,
    districts,
    items: directoryItems,
    loading: directoryLoading,
    error: directoryError,
  };

  return (
    <div className="shell">
      <header className="topbar panel">
        <div className="brand">
          <h1>MedAssist Care Platform</h1>
          <p>Premium medication workflow with SMS reminders and district health directory.</p>
        </div>

        <div className="user-panel">
          <div className="user-meta">
            <span className="role-pill">{session.role === 'guardian' ? 'Guardian' : 'Patient'} Portal</span>
            <strong>{session.name}</strong>
            <small>{session.email}</small>
            <small>{session.city || 'Hassan, Karnataka'}</small>
          </div>
          <button type="button" className="btn btn-secondary" onClick={logoutSession}>
            Logout
          </button>
        </div>
      </header>

      {appError ? <p className="form-message">{appError}</p> : null}
      {appNotice ? <p className="notice-bar">{appNotice}</p> : null}

      {session.role === 'guardian' ? (
        <GuardianWorkspace
          user={session}
          medications={medications}
          logs={logs}
          notifications={notifications}
          patients={patients}
          nowTs={nowTs}
          onAddMedication={addMedicationPlan}
          onDeleteMedication={removeMedicationPlan}
          onRefreshData={() => refreshSecureData(token)}
          pharmacies={pharmacies}
          pharmacyLoading={pharmacyLoading}
          pharmacyError={pharmacyError}
          onRefreshPharmacies={loadPharmacies}
          news={news}
          newsLoading={newsLoading}
          newsError={newsError}
          onRefreshNews={loadNews}
          directoryState={directoryState}
          onDirectoryDistrictChange={setDirectoryDistrict}
          onDirectoryTypeChange={setDirectoryType}
          onRefreshDirectory={() => loadDirectory(directoryDistrict, directoryType)}
        />
      ) : (
        <PatientWorkspace
          user={session}
          medications={medications}
          logs={logs}
          notifications={notifications}
          nowTs={nowTs}
          onMarkTaken={markAsTaken}
          onEscalate={escalateNow}
          onRefreshData={() => refreshSecureData(token)}
          soundEnabled={soundEnabled}
          browserAlerts={browserAlerts}
          onToggleSound={setSoundEnabled}
          onToggleBrowserAlerts={handleToggleBrowserAlerts}
          pharmacies={pharmacies}
          pharmacyLoading={pharmacyLoading}
          pharmacyError={pharmacyError}
          onRefreshPharmacies={loadPharmacies}
          news={news}
          newsLoading={newsLoading}
          newsError={newsError}
          onRefreshNews={loadNews}
          directoryState={directoryState}
          onDirectoryDistrictChange={setDirectoryDistrict}
          onDirectoryTypeChange={setDirectoryType}
          onRefreshDirectory={() => loadDirectory(directoryDistrict, directoryType)}
        />
      )}
    </div>
  );
}
