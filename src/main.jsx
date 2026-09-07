import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  Download,
  Lock,
  LogOut,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Ticket,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";
import "./styles.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
const demoAdminUsername = import.meta.env.VITE_ADMIN_USERNAME || "admin";
const demoAdminPassword = import.meta.env.VITE_ADMIN_PASSWORD || "admin";

const demoKey = "altius-referidos-demo-v2";
const sessionKey = "altius-current-token";
const eventPath = "/";
const duplicateContactMessage = "Esta persona ya fue registrada con ese teléfono o email.";

const initialParticipant = {
  full_name: "",
  phone: "+56 ",
  email: "",
};

const initialReferral = {
  full_name: "",
  phone: "+56 ",
  email: "",
};

function getOrigin() {
  return window.location.origin;
}

function getEventUrl() {
  return `${getOrigin()}${eventPath}`;
}

function getPersonalUrl(token) {
  return `${getOrigin()}/?participante=${token}`;
}

function createToken() {
  return crypto.randomUUID().replaceAll("-", "");
}

function readDemoData() {
  try {
    const saved = localStorage.getItem(demoKey);
    return saved ? JSON.parse(saved) : { participants: [], referrals: [] };
  } catch {
    return { participants: [], referrals: [] };
  }
}

function writeDemoData(data) {
  localStorage.setItem(demoKey, JSON.stringify(data));
}

function normalizePhone(value) {
  const clean = String(value || "").replace(/[^\d+]/g, "").trim();
  const digits = clean.replace(/\D/g, "");

  if (!digits) return "+56";
  if (digits.startsWith("56")) return `+${digits}`;
  if (digits.startsWith("0")) return `+56${digits.slice(1)}`;
  return `+56${digits}`;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function formatPhoneInput(value) {
  if (!value || !value.trim()) return "+56 ";
  if (value.trim() === "+") return "+56 ";
  return value.startsWith("+56") ? value : normalizePhone(value);
}

function isValidChilePhone(value) {
  return normalizePhone(value).replace(/\D/g, "").length >= 10;
}

function shouldUseServerApi() {
  return !["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function findDuplicateContact(data, payload) {
  const targetPhone = normalizePhone(payload.phone);
  const targetEmail = normalizeEmail(payload.email);
  const contacts = [...(data.participants || []), ...(data.referrals || [])];

  return contacts.find((contact) => {
    return (
      normalizePhone(contact.phone) === targetPhone ||
      normalizeEmail(contact.email) === targetEmail
    );
  });
}

function getDuplicateMessage() {
  return duplicateContactMessage;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

async function createParticipant(payload) {
  const id = crypto.randomUUID();
  const participant = {
    id,
    ...payload,
    public_token: createToken(),
    phone: normalizePhone(payload.phone),
    full_name: String(payload.full_name || "").trim(),
    email: normalizeEmail(payload.email),
  };

  if (supabase && shouldUseServerApi()) {
    const response = await fetch("/api/register-participant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(participant),
    });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(data?.message || "No se pudo registrar la inscripción.");
        error.code = data?.code;
      throw error;
    }
    return data.participant;
  }

  const data = readDemoData();
  if (findDuplicateContact(data, participant)) {
    const error = new Error(getDuplicateMessage());
    error.code = "duplicate_contact";
    throw error;
  }
  const record = {
    id,
    ...participant,
    created_at: new Date().toISOString(),
  };
  data.participants.unshift(record);
  writeDemoData(data);
  return record;
}

async function createReferral(participantId, payload) {
  const id = crypto.randomUUID();
  const referral = {
    id,
    ...payload,
    participant_id: participantId,
    phone: normalizePhone(payload.phone),
    full_name: String(payload.full_name || "").trim(),
    email: normalizeEmail(payload.email),
  };

  if (supabase && shouldUseServerApi()) {
    const response = await fetch("/api/register-referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(referral),
    });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(data?.message || "No se pudo guardar el referido.");
        error.code = data?.code;
      throw error;
    }
    return data.referral;
  }

  const data = readDemoData();
  if (findDuplicateContact(data, referral)) {
    const error = new Error(getDuplicateMessage());
    error.code = "duplicate_contact";
    throw error;
  }
  const record = {
    id,
    ...referral,
    created_at: new Date().toISOString(),
  };
  data.referrals.unshift(record);
  writeDemoData(data);
  return record;
}

async function fetchParticipantDashboard(token) {
  if (!token) return null;

  if (supabase) {
    const { data, error } = await supabase.rpc("get_participant_dashboard", {
      token_input: token,
    });
    if (error || !data?.participant) throw new Error("Participant data unavailable");
    return data;
  }

  const data = readDemoData();
  const participant = data.participants.find((item) => item.public_token === token);
  if (!participant) return null;
  return {
    participant,
    referrals: data.referrals.filter((referral) => referral.participant_id === participant.id),
  };
}

async function fetchAdminEntries(username, password) {
  if (supabase && password && shouldUseServerApi()) {
    const response = await fetch("/api/admin-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error("Admin data unavailable");
      error.code = data?.code;
      throw error;
    }
    return data;
  }

  if (username !== demoAdminUsername || password !== demoAdminPassword) {
    throw new Error("Invalid admin credentials");
  }

  return readDemoData();
}

async function clearTestEntries(username, password) {
  if (supabase && password && shouldUseServerApi()) {
    const response = await fetch("/api/clear-test-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, confirmation: "ELIMINAR PRUEBAS" }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error("Could not clear test entries");
      error.code = data?.code;
      throw error;
    }
    return data;
  }

  if (username !== demoAdminUsername || password !== demoAdminPassword) {
    throw new Error("Invalid admin credentials");
  }

  const emptyData = { participants: [], referrals: [] };
  writeDemoData(emptyData);
  return emptyData;
}

function buildRows(participants, referrals) {
  return participants.map((participant) => {
    const personReferrals = referrals.filter(
      (referral) => referral.participant_id === participant.id,
    );
    return {
      ...participant,
      referrals: personReferrals,
      possibilities: 1 + personReferrals.length,
    };
  });
}

function pickWinner(rows, excludedIds = []) {
  const excluded = new Set(excludedIds);
  const tickets = rows
    .filter((row) => !excluded.has(row.id))
    .flatMap((row) => Array.from({ length: row.possibilities }, () => row));
  if (!tickets.length) return null;
  return tickets[Math.floor(Math.random() * tickets.length)];
}

function runPrizeDraw(rows) {
  const grillWinner = pickWinner(rows);
  const setWinner = grillWinner ? pickWinner(rows, [grillWinner.id]) : null;

  return {
    grill: grillWinner,
    set: setWinner,
    createdAt: new Date().toISOString(),
  };
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function exportCsv(rows) {
  const headers = [
    "Nombre",
    "Teléfono",
    "Email",
    "Referidos",
    "Posibilidades",
    "Fecha",
    "Link personal",
  ];
  const csvRows = rows.map((row) => [
    row.full_name,
    row.phone,
    row.email,
    row.referrals.length,
    row.possibilities,
    formatDate(row.created_at),
    row.public_token ? getPersonalUrl(row.public_token) : "",
  ]);

  const csv = [headers, ...csvRows]
    .map((cells) =>
      cells.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "altius-referidos.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [view, setView] = useState("inscripcion");
  const [participant, setParticipant] = useState(initialParticipant);
  const [referral, setReferral] = useState(initialReferral);
  const [currentParticipant, setCurrentParticipant] = useState(null);
  const [currentReferrals, setCurrentReferrals] = useState([]);
  const [entries, setEntries] = useState({ participants: [], referrals: [] });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [drawResult, setDrawResult] = useState(null);
  const [eventQr, setEventQr] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const rows = useMemo(
    () => buildRows(entries.participants, entries.referrals),
    [entries.participants, entries.referrals],
  );

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [row.full_name, row.phone, row.email].some((value) =>
        String(value ?? "").toLowerCase().includes(term),
      ),
    );
  }, [rows, searchTerm]);

  const selectedRow = rows.find((row) => row.id === selectedId) || filteredRows[0] || null;

  const totals = useMemo(
    () => ({
      participants: rows.length,
      referrals: entries.referrals.length,
      possibilities: rows.reduce((sum, row) => sum + row.possibilities, 0),
    }),
    [entries.referrals.length, rows],
  );

  async function refreshAdminEntries() {
    const data = await fetchAdminEntries(username, password);
    setEntries(data);
  }

  async function clearAdminTestEntries() {
    const confirmed = window.confirm(
      "Esto eliminará todos los participantes y referidos de prueba. ¿Quieres continuar?",
    );

    if (!confirmed) return;

    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const data = await clearTestEntries(username, password);
      setEntries(data);
      setSelectedId("");
      setDrawResult(null);
      setStatus({ type: "success", message: "Registros de prueba eliminados." });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error.code === "reset_disabled"
            ? "La limpieza de pruebas no está habilitada en Vercel."
            : "No se pudieron eliminar los registros de prueba.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function refreshParticipant(token = currentParticipant?.public_token) {
    if (!token) return;
    const data = await fetchParticipantDashboard(token);
    if (!data) return;
    setCurrentParticipant(data.participant);
    setCurrentReferrals(data.referrals);
    localStorage.setItem(sessionKey, token);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("participante");
    const adminMode = params.get("admin") === "1";
    const qrMode = params.get("qr") === "1";
    QRCode.toDataURL(getEventUrl(), { margin: 1, width: 220 }).then(setEventQr);

    if (adminMode) {
      setView("admin");
    } else if (token) {
      refreshParticipant(token)
        .then(() => setView("mi-tablero"))
        .catch(() => setView("inscripcion"));
    } else if (qrMode) {
      setView("front");
    } else {
      setView("inscripcion");
    }

    if (!supabase) setEntries(readDemoData());
  }, []);

  async function handleParticipantSubmit(event) {
    event.preventDefault();
    if (!isValidChilePhone(participant.phone)) {
      setStatus({
        type: "error",
        message: "Ingresa un teléfono válido con prefijo +56.",
      });
      return;
    }
    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      const created = await createParticipant(participant);
      setCurrentParticipant(created);
      setCurrentReferrals([]);
      setParticipant(initialParticipant);
      localStorage.setItem(sessionKey, created.public_token);
      window.history.replaceState({}, "", `/?participante=${created.public_token}`);
      setView("mi-tablero");
      setStatus({
        type: "success",
        message: "Inscripción registrada. Ya participas con 1 posibilidad.",
      });
    } catch (error) {
      const duplicated = error.code === "duplicate_contact" || error.code === "23505";
      setStatus({
        type: "error",
        message: duplicated
          ? getDuplicateMessage()
          : "No se pudo registrar la inscripción. Inténtalo nuevamente.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleReferralSubmit(event) {
    event.preventDefault();
    if (!currentParticipant) return;
    if (!isValidChilePhone(referral.phone)) {
      setStatus({
        type: "error",
        message: "Ingresa un teléfono válido con prefijo +56.",
      });
      return;
    }
    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      await createReferral(currentParticipant.id, referral);
      setReferral(initialReferral);
      await refreshParticipant(currentParticipant.public_token);
      setStatus({
        type: "success",
        message: "Referido agregado. Sumaste 1 posibilidad extra.",
      });
    } catch (error) {
      const duplicated = error.code === "duplicate_contact" || error.code === "23505";
      setStatus({
        type: "error",
        message: duplicated
          ? getDuplicateMessage()
          : "No se pudo guardar el referido. Revisa los datos e inténtalo nuevamente.",
      });
    } finally {
      setLoading(false);
    }
  }

  function unlockAdmin(event) {
    event.preventDefault();
    refreshAdminEntries()
      .then(() => {
        setAdminUnlocked(true);
        setStatus({ type: "", message: "" });
      })
      .catch((error) => {
        const messageByCode = {
          admin_not_configured:
            "Faltan variables del panel admin en Vercel: ADMIN_PASSWORD, SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.",
          invalid_credentials: "Usuario o clave incorrectos.",
          admin_data_error: "No se pudieron cargar los registros desde Supabase.",
        };
        setStatus({
          type: "error",
          message: messageByCode[error.code] || "No se pudo ingresar al panel.",
        });
      });
  }

  function openRegistration() {
    window.history.pushState({}, "", eventPath);
    setView("inscripcion");
  }

  function openAdmin() {
    window.history.pushState({}, "", "/?admin=1");
    setView("admin");
  }

  function openFront() {
    window.history.pushState({}, "", "/");
    setStatus({ type: "", message: "" });
    setView("inscripcion");
  }

  function logoutAdmin() {
    setAdminUnlocked(false);
    setPassword("");
    setUsername("");
    setDrawResult(null);
    setStatus({ type: "", message: "" });
  }

  if (view === "front") {
    return <Landing eventQr={eventQr} onStart={openRegistration} onAdmin={openAdmin} />;
  }

  if (view === "admin") {
    return (
      <main className="admin-screen">
        <header className="admin-header">
          <div className="admin-header-brand">
            <LogoMark />
            <div>
              <span>Gestión del sorteo</span>
              <h1>Panel de referidos</h1>
            </div>
          </div>
          <button className="admin-home-link" onClick={openFront}>
            Inicio
          </button>
        </header>
        <section className="admin-container">
          {status.message ? <p className={`notice ${status.type}`}>{status.message}</p> : null}
          <AdminPanel
            adminUnlocked={adminUnlocked}
            password={password}
            setPassword={setPassword}
            username={username}
            setUsername={setUsername}
            unlockAdmin={unlockAdmin}
            totals={totals}
            rows={rows}
            filteredRows={filteredRows}
            selectedRow={selectedRow}
            setSelectedId={setSelectedId}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            refreshAdminEntries={refreshAdminEntries}
            clearAdminTestEntries={clearAdminTestEntries}
            exportCsv={exportCsv}
            drawResult={drawResult}
            setDrawResult={setDrawResult}
            onLogout={logoutAdmin}
            loading={loading}
          />
        </section>
      </main>
    );
  }

  if (view === "mi-tablero") {
    return (
      <ParticipantDashboard
        participant={currentParticipant}
        referrals={currentReferrals}
        referral={referral}
        setReferral={setReferral}
        loading={loading}
        status={status}
        onSubmit={handleReferralSubmit}
        onRegister={() => setView("inscripcion")}
      />
    );
  }

  if (view === "inscripcion") {
    return (
      <RegistrationPage>
        {status.message ? <p className={`notice ${status.type}`}>{status.message}</p> : null}
        {!supabase ? (
          <p className="notice subtle">
            Modo demo local activo. Al conectar Supabase, los datos quedan centralizados.
          </p>
        ) : null}
        <RegistrationForm
          participant={participant}
          setParticipant={setParticipant}
          loading={loading}
          onSubmit={handleParticipantSubmit}
        />
      </RegistrationPage>
    );
  }

  return null;
}

function RegistrationPage({ children }) {
  return (
    <main className="registration-screen">
      <header className="registration-hero">
        <LogoMark />
        <div className="registration-title-block">
          <span>Regístrate y participa</span>
          <h1 className="registration-title">Sorteo</h1>
        </div>
      </header>

      <section className="registration-content">
        <p className="registration-intro">
          Invita a tus contactos: cada referido suma una posibilidad.
        </p>

        <div className="registration-prizes" aria-label="Premios del sorteo">
          <article className="registration-prize primary">
            <span>Primer premio</span>
            <strong>Una parrilla</strong>
          </article>
          <article className="registration-prize">
            <span>Premio adicional</span>
            <strong>Set parrillero</strong>
          </article>
        </div>

        <div className="registration-possibilities" aria-label="Posibilidades del sorteo">
          <div>
            <strong>1</strong>
            <span>Posibilidad al registrarte</span>
          </div>
          <b>+</b>
          <div>
            <strong>1</strong>
            <span>Por cada referido registrado</span>
          </div>
        </div>

        {children}

        <p className="registration-legal">
          Se realizará el martes 8 de septiembre a las 20:30 hrs. durante el evento de
          Olivos de Chamisero.
        </p>
      </section>
    </main>
  );
}

function Landing({ eventQr, onStart, onAdmin }) {
  return (
    <main className="landing-screen">
      <section className="landing-hero">
        <LogoMark />
        <div className="landing-copy">
          <span>Sorteo evento · martes 8 de septiembre</span>
          <h1>Sorteo Altius</h1>
          <div className="prize-list">
            <span>Premio principal: parrilla</span>
            <span>Premio de consuelo: set parrillero</span>
          </div>
          <p>Escanea el QR para participar y sumar posibilidades con tus referidos.</p>
        </div>
        <div className="event-stats">
          <strong>1</strong>
          <span>posibilidad por inscripción</span>
          <strong>+1</strong>
          <span>por cada referido</span>
        </div>
      </section>

      <section className="scan-panel">
        <div className="scan-card">
          <QrCode size={34} />
          <span>Escanea para participar</span>
          {eventQr ? <img src={eventQr} alt="QR para abrir el registro del sorteo" /> : null}
          <p>El registro se abre en el teléfono y toma menos de un minuto.</p>
          <button type="button" onClick={onStart}>
            Abrir registro
            <ArrowRight size={18} />
          </button>
        </div>
        <button className="admin-link dark" onClick={onAdmin}>
          <Lock size={16} />
          Panel cliente
        </button>
      </section>
    </main>
  );
}

function LogoMark() {
  return (
    <div className="brand-mark" aria-label="Altius de Chamisero">
      <img src="/logo-chamisero.svg" alt="Altius de Chamisero" />
    </div>
  );
}

function RegistrationForm({ participant, setParticipant, loading, onSubmit }) {
  return (
    <form className="form-panel" onSubmit={onSubmit}>
      <div className="section-heading">
        <div>
          <h2>Tus datos</h2>
          <p>Completa el registro y luego podrás sumar referidos.</p>
        </div>
      </div>

      <Field
        label="Nombre"
        value={participant.full_name}
        onChange={(full_name) => setParticipant({ ...participant, full_name })}
        required
      />
      <Field
        label="Teléfono"
        value={participant.phone}
        onChange={(phone) => setParticipant({ ...participant, phone: formatPhoneInput(phone) })}
        required
        inputMode="tel"
      />
      <Field
        label="Email"
        value={participant.email}
        onChange={(email) => setParticipant({ ...participant, email })}
        required
        type="email"
      />
      <label className="check-row">
        <input type="checkbox" required />
        Acepto participar del sorteo y ser contactado por Altius de Chamisero.
      </label>

      <button className="primary-action" disabled={loading}>
        {loading ? "Guardando..." : "Quiero participar"}
        <ArrowRight size={18} />
      </button>
    </form>
  );
}

function ParticipantDashboard({
  participant,
  referrals,
  referral,
  setReferral,
  loading,
  status,
  onSubmit,
  onRegister,
}) {
  if (!participant) {
    return (
      <div className="form-panel">
        <div className="empty-state">
          Todavía no hay un titular asociado a este dispositivo.
          <button type="button" onClick={onRegister}>
            Crear inscripción
          </button>
        </div>
      </div>
    );
  }

  const possibilities = 1 + referrals.length;
  const possibilityLabel = possibilities === 1 ? "posibilidad" : "posibilidades";

  return (
    <main className="participant-screen">
      <header className="participant-hero">
        <LogoMark />
        <div className="participant-summary">
          <span>{participant.full_name}</span>
          <h1>
            Ya participas con:
            <strong>
              {possibilities} {possibilityLabel}
            </strong>
          </h1>
        </div>
      </header>

      <section className="participant-content">
        {status.message ? <p className={`notice ${status.type}`}>{status.message}</p> : null}

        <form className="participant-card referral-form" onSubmit={onSubmit}>
          <div className="section-heading">
            <div>
              <h2>Sumar referido</h2>
              <p>Cada contacto agregado suma una posibilidad extra para el sorteo.</p>
            </div>
          </div>
          <Field
            label="Nombre referido"
            value={referral.full_name}
            onChange={(full_name) => setReferral({ ...referral, full_name })}
            required
          />
          <Field
            label="Teléfono referido"
            value={referral.phone}
            onChange={(phone) => setReferral({ ...referral, phone: formatPhoneInput(phone) })}
            required
            inputMode="tel"
          />
          <Field
            label="Email referido"
            value={referral.email}
            onChange={(email) => setReferral({ ...referral, email })}
            required
            type="email"
          />
          <button className="primary-action" disabled={loading}>
            {loading ? "Guardando..." : "Agregar referido +"}
          </button>
        </form>

        <section className="participant-card referral-list">
          <h2>Tus referidos</h2>
          {referrals.length ? (
            referrals.map((item) => (
              <div className="referral-item" key={item.id}>
                <strong>{item.full_name}</strong>
                <small>{item.phone}</small>
              </div>
            ))
          ) : (
            <p className="muted">Cuando agregues referidos, aparecerán acá.</p>
          )}
        </section>
      </section>
    </main>
  );
}

function AdminPanel({
  adminUnlocked,
  password,
  setPassword,
  username,
  setUsername,
  unlockAdmin,
  totals,
  rows,
  filteredRows,
  selectedRow,
  setSelectedId,
  searchTerm,
  setSearchTerm,
  refreshAdminEntries,
  clearAdminTestEntries,
  exportCsv,
  drawResult,
  setDrawResult,
  onLogout,
  loading,
}) {
  const [drawRunning, setDrawRunning] = useState(false);
  const [drawModal, setDrawModal] = useState({
    open: false,
    phase: "idle",
    name: "",
    duration: 0,
    result: null,
  });

  const animatePrizeDraw = (phase, candidates, finalWinner, duration) =>
    new Promise((resolve) => {
      const names = candidates.length
        ? candidates.map((candidate) => candidate.full_name)
        : ["Sin participantes"];
      let index = 0;

      setDrawModal({
        open: true,
        phase,
        name: names[0],
        duration,
        result: null,
      });

      const intervalId = window.setInterval(() => {
        index += 1;
        setDrawModal((current) => ({
          ...current,
          name: names[index % names.length],
        }));
      }, 86);

      window.setTimeout(() => {
        window.clearInterval(intervalId);
        setDrawModal((current) => ({
          ...current,
          phase: `${phase}-reveal`,
          name: finalWinner?.full_name || "Sin ganador",
        }));
        window.setTimeout(resolve, 1150);
      }, duration);
    });

  const startAnimatedDraw = async () => {
    if (!rows.length || drawRunning) return;

    const result = runPrizeDraw(rows);
    const setCandidates = result.grill
      ? rows.filter((row) => row.id !== result.grill.id)
      : rows;

    setDrawRunning(true);
    setDrawResult(null);
    await animatePrizeDraw("grill", rows, result.grill, 3000);
    await wait(240);
    await animatePrizeDraw("set", setCandidates, result.set, 2600);
    setDrawResult(result);
    setDrawModal({
      open: true,
      phase: "done",
      name: "",
      duration: 0,
      result,
    });
    setDrawRunning(false);
  };

  if (!adminUnlocked) {
    return (
      <form className="admin-login-card" onSubmit={unlockAdmin}>
        <LogoMark />
        <div className="admin-login-copy">
          <span>Acceso privado</span>
          <h2>Ingresar al panel</h2>
          <p>Ingresa las credenciales para revisar participantes, referidos y posibilidades.</p>
        </div>
        <div className="admin-login-fields">
          <Field label="Usuario" value={username} onChange={setUsername} required />
          <Field label="Clave" type="password" value={password} onChange={setPassword} required />
        </div>
        <button className="primary-action">Entrar al panel</button>
      </form>
    );
  }

  return (
    <>
      <div className="admin-panel">
        <div className="admin-panel-title">
          <div>
            <span>Modo prueba</span>
            <h2>Registro de participantes</h2>
          </div>
          <p>Simulación interna hasta el día del evento.</p>
        </div>
        <div className="test-mode-banner">
          <strong>Sorteo en modo prueba</strong>
          <span>Los resultados simulados no quedan guardados como definitivos.</span>
        </div>
        <div className="metric-grid">
          <Metric icon={<Users size={20} />} label="Participantes" value={totals.participants} />
          <Metric icon={<Plus size={20} />} label="Referidos" value={totals.referrals} />
          <Metric icon={<Ticket size={20} />} label="Posibilidades" value={totals.possibilities} />
        </div>
        <div className="admin-actions">
          <button onClick={() => refreshAdminEntries()}>
            <RefreshCw size={18} />
            Actualizar
          </button>
          <button onClick={() => exportCsv(rows)} disabled={!rows.length}>
            <Download size={18} />
            Exportar CSV
          </button>
          <button onClick={startAnimatedDraw} disabled={!rows.length || drawRunning}>
            <Trophy size={18} />
            {drawRunning ? "Sorteando..." : "Simular sorteo"}
          </button>
          <button
            className="danger-action"
            onClick={clearAdminTestEntries}
            disabled={loading || !rows.length || drawRunning}
          >
            <Trash2 size={18} />
            Eliminar pruebas
          </button>
          <button className="ghost-action" onClick={onLogout}>
            <LogOut size={18} />
            Salir
          </button>
        </div>
        {drawResult ? (
          <div className="winner-card">
            <span>Resultado de prueba</span>
            <div className="winner-grid">
              <PrizeWinner title="Primer premio · Parrilla" winner={drawResult.grill} />
              <PrizeWinner title="Premio adicional · Set parrillero" winner={drawResult.set} />
            </div>
          </div>
        ) : null}
        <div className="admin-layout">
          <section className="table-card">
            <label className="search-box">
              <Search size={18} />
              <input
                value={searchTerm}
                placeholder="Buscar por nombre, teléfono o email"
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Titular</th>
                    <th>Referidos</th>
                    <th>Posibilidades</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className={selectedRow?.id === row.id ? "selected" : ""}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <td>
                        <strong>{row.full_name}</strong>
                        <span>{row.phone}</span>
                      </td>
                      <td>{row.referrals.length}</td>
                      <td>{row.possibilities}</td>
                    </tr>
                  ))}
                  {!filteredRows.length ? (
                    <tr>
                      <td colSpan="3" className="empty-cell">
                        Todavía no hay inscripciones.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <ParticipantDetail row={selectedRow} />
        </div>
      </div>
      {drawModal.open ? (
        <DrawModal
          state={drawModal}
          onClose={() => setDrawModal((current) => ({ ...current, open: false }))}
        />
      ) : null}
    </>
  );
}

function DrawModal({ state, onClose }) {
  const isDone = state.phase === "done";
  const isReveal = state.phase.endsWith("-reveal");
  const isSetPrize = state.phase.startsWith("set");
  const prizeLabel = isSetPrize ? "Premio adicional · Set parrillero" : "Primer premio · Parrilla";
  const title = isDone ? "Resultado del sorteo" : isReveal ? "Felicitaciones" : "Sorteando...";

  return (
    <div
      className="draw-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draw-modal-title"
    >
      <section className={`draw-modal phase-${state.phase}`}>
        <LogoMark />
        <span className="draw-modal-kicker">Modo prueba</span>
        <h2 id="draw-modal-title">{title}</h2>
        {isDone ? (
          <>
            <div className="draw-modal-results">
              <PrizeWinner title="Primer premio · Parrilla" winner={state.result?.grill} />
              <PrizeWinner title="Premio adicional · Set parrillero" winner={state.result?.set} />
            </div>
            <button className="draw-close" onClick={onClose}>
              Cerrar
            </button>
          </>
        ) : (
          <>
            <p>{isReveal ? `Ganador ${prizeLabel.toLowerCase()}` : prizeLabel}</p>
            <div className={`draw-name-window ${isReveal ? "is-reveal" : ""}`}>
              <strong key={state.name}>{state.name || "Sin ganador"}</strong>
            </div>
            <div className={`draw-progress ${isReveal ? "is-complete" : ""}`} key={state.phase}>
              <span style={{ animationDuration: `${state.duration}ms` }} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function PrizeWinner({ title, winner }) {
  return (
    <article className="prize-winner">
      <span>{title}</span>
      {winner ? (
        <>
          <h3>{winner.full_name}</h3>
          <p>{winner.phone}</p>
        </>
      ) : (
        <p>No hay suficientes participantes para asignar este premio.</p>
      )}
    </article>
  );
}

function ParticipantDetail({ row }) {
  if (!row) {
    return (
      <aside className="detail-card">
        <span>Detalle</span>
        <p className="muted">Selecciona un participante para ver sus datos y referidos.</p>
      </aside>
    );
  }

  return (
    <aside className="detail-card">
      <span>Detalle participante</span>
      <h3>{row.full_name}</h3>
      <dl>
        <div>
          <dt>Teléfono</dt>
          <dd>{row.phone}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{row.email}</dd>
        </div>
        <div>
          <dt>Posibilidades</dt>
          <dd>{row.possibilities}</dd>
        </div>
      </dl>
      <div className="detail-referrals">
        <strong>Referidos</strong>
        {row.referrals.length ? (
          row.referrals.map((item) => (
            <div className="referral-item" key={item.id}>
              <strong>{item.full_name}</strong>
              <small>{[item.phone, item.email].filter(Boolean).join(" · ")}</small>
            </div>
          ))
        ) : (
          <p className="muted">Sin referidos agregados.</p>
        )}
      </div>
    </aside>
  );
}

function Field({ label, value, onChange, type = "text", required = false, inputMode }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
