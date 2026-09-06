import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  Clipboard,
  Download,
  Gift,
  LayoutDashboard,
  Lock,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Sparkles,
  Ticket,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";
import "./styles.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const demoKey = "altius-referidos-demo-v2";
const sessionKey = "altius-current-token";
const eventPath = "/?registro=1";

const initialParticipant = {
  full_name: "",
  phone: "",
  email: "",
};

const initialReferral = {
  full_name: "",
  phone: "",
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
  return value.replace(/[^\d+]/g, "").trim();
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
  };

  if (supabase) {
    const { error } = await supabase.from("participants").insert(participant);
    if (error) throw error;
    return { ...participant, created_at: new Date().toISOString() };
  }

  const data = readDemoData();
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
  };

  if (supabase) {
    const { error } = await supabase.from("referrals").insert(referral);
    if (error) throw error;
    return { ...referral, created_at: new Date().toISOString() };
  }

  const data = readDemoData();
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
  if (supabase && password) {
    const response = await fetch("/api/admin-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) throw new Error("Admin data unavailable");
    return response.json();
  }

  return readDemoData();
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

function pickWinner(rows) {
  const tickets = rows.flatMap((row) => Array.from({ length: row.possibilities }, () => row));
  if (!tickets.length) return null;
  return tickets[Math.floor(Math.random() * tickets.length)];
}

function exportCsv(rows) {
  const headers = [
    "Nombre",
    "Telefono",
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
  const [view, setView] = useState("front");
  const [participant, setParticipant] = useState(initialParticipant);
  const [referral, setReferral] = useState(initialReferral);
  const [currentParticipant, setCurrentParticipant] = useState(null);
  const [currentReferrals, setCurrentReferrals] = useState([]);
  const [entries, setEntries] = useState({ participants: [], referrals: [] });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(!supabase);
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [winner, setWinner] = useState(null);
  const [eventQr, setEventQr] = useState("");
  const [personalQr, setPersonalQr] = useState("");
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
    const registrationMode = params.get("registro") === "1" || params.get("ingreso") === "qr";
    QRCode.toDataURL(getEventUrl(), { margin: 1, width: 220 }).then(setEventQr);

    if (adminMode) {
      setView("admin");
    } else if (token) {
      refreshParticipant(token)
        .then(() => setView("mi-tablero"))
        .catch(() => setView("inscripcion"));
    } else if (registrationMode) {
      setView("inscripcion");
    }

    if (!supabase) {
      refreshAdminEntries().catch(() => null);
    }
  }, []);

  useEffect(() => {
    if (!currentParticipant?.public_token) return;
    QRCode.toDataURL(getPersonalUrl(currentParticipant.public_token), {
      margin: 1,
      width: 220,
    }).then(setPersonalQr);
  }, [currentParticipant?.public_token]);

  async function handleParticipantSubmit(event) {
    event.preventDefault();
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
        message: "Inscripcion registrada. Ya participas con 1 posibilidad.",
      });
    } catch {
      setStatus({
        type: "error",
        message: "No se pudo registrar la inscripcion. Probemos de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleReferralSubmit(event) {
    event.preventDefault();
    if (!currentParticipant) return;
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
    } catch {
      setStatus({
        type: "error",
        message: "No se pudo guardar el referido. Revisemos los datos.",
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
      .catch(() => {
        setStatus({ type: "error", message: "Clave incorrecta o panel no configurado." });
      });
  }

  function copyPersonalLink() {
    if (!currentParticipant?.public_token) return;
    navigator.clipboard.writeText(getPersonalUrl(currentParticipant.public_token));
    setStatus({ type: "success", message: "Link personal copiado." });
  }

  function openRegistration() {
    window.history.pushState({}, "", eventPath);
    setView("inscripcion");
  }

  function openAdmin() {
    window.history.pushState({}, "", "/?admin=1");
    setView("admin");
  }

  if (view === "front") {
    return <Landing eventQr={eventQr} onStart={openRegistration} onAdmin={openAdmin} />;
  }

  return (
    <main className="app-shell">
      <section className="brand-panel">
        <div className="brand-mark">
          <Sparkles size={20} />
          Altius de Chamisero
        </div>
        <div className="event-card">
          <span>Sorteo evento · martes 8 de septiembre</span>
          <h1>Sorteo Altius</h1>
          <div className="prize-list">
            <span>Premio principal: parrilla</span>
            <span>Premio de consuelo: set parrillero</span>
          </div>
          <p>
            Inscribite escaneando el QR del evento y suma mas posibilidades cargando
            referidos interesados en el proyecto.
          </p>
          <div className="event-stats">
            <strong>1</strong>
            <span>posibilidad por inscripcion</span>
            <strong>+1</strong>
            <span>por cada referido</span>
          </div>
        </div>
        <button className="admin-link" onClick={openAdmin}>
          <Lock size={16} />
          Panel cliente
        </button>
      </section>

      <section className="workspace">
        {currentParticipant || view === "admin" ? (
          <nav className="tabs" aria-label="Secciones">
            <button
              className={view === "inscripcion" ? "active" : ""}
              onClick={() => setView("inscripcion")}
            >
              <Ticket size={18} />
              Inscripcion
            </button>
            <button
              className={view === "mi-tablero" ? "active" : ""}
              onClick={() => setView("mi-tablero")}
            >
              <LayoutDashboard size={18} />
              Mi tablero
            </button>
            <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>
              <Lock size={18} />
              Admin
            </button>
          </nav>
        ) : null}

        {status.message ? <p className={`notice ${status.type}`}>{status.message}</p> : null}
        {!supabase ? (
          <p className="notice subtle">
            Modo demo local activo. Cuando conectemos Supabase, los datos quedan centralizados.
          </p>
        ) : null}

        {view === "inscripcion" ? (
          <RegistrationForm
            participant={participant}
            setParticipant={setParticipant}
            loading={loading}
            onSubmit={handleParticipantSubmit}
          />
        ) : null}

        {view === "mi-tablero" ? (
          <ParticipantDashboard
            participant={currentParticipant}
            referrals={currentReferrals}
            referral={referral}
            setReferral={setReferral}
            loading={loading}
            personalQr={personalQr}
            onSubmit={handleReferralSubmit}
            onCopy={copyPersonalLink}
            onRegister={() => setView("inscripcion")}
          />
        ) : null}

        {view === "admin" ? (
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
            exportCsv={exportCsv}
            winner={winner}
            setWinner={setWinner}
          />
        ) : null}
      </section>
    </main>
  );
}

function Landing({ eventQr, onStart, onAdmin }) {
  return (
    <main className="landing-screen">
      <section className="landing-hero">
        <div className="brand-mark">
          <Sparkles size={20} />
          Altius de Chamisero
        </div>
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
          <span>posibilidad por inscripcion</span>
          <strong>+1</strong>
          <span>por cada referido</span>
        </div>
      </section>

      <section className="scan-panel">
        <div className="scan-card">
          <QrCode size={34} />
          <span>Escanea para participar</span>
          {eventQr ? <img src={eventQr} alt="QR para abrir el registro del sorteo" /> : null}
          <p>El registro se abre en el celular y toma menos de un minuto.</p>
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

function RegistrationForm({ participant, setParticipant, loading, onSubmit }) {
  return (
    <form className="form-panel" onSubmit={onSubmit}>
      <div className="section-heading">
        <Gift size={22} />
        <div>
          <h2>Datos del titular</h2>
          <p>Completa tus datos para participar y desbloquear tu tablero de referidos.</p>
        </div>
      </div>

      <Field
        label="Nombre"
        value={participant.full_name}
        onChange={(full_name) => setParticipant({ ...participant, full_name })}
        required
      />
      <Field
        label="Telefono"
        value={participant.phone}
        onChange={(phone) => setParticipant({ ...participant, phone })}
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
        {loading ? "Guardando..." : "Inscribirme y ver mi tablero"}
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
  personalQr,
  onSubmit,
  onCopy,
  onRegister,
}) {
  if (!participant) {
    return (
      <div className="form-panel">
        <div className="empty-state">
          Todavia no hay un titular asociado a este dispositivo.
          <button type="button" onClick={onRegister}>
            Crear inscripcion
          </button>
        </div>
      </div>
    );
  }

  const possibilities = 1 + referrals.length;

  return (
    <div className="participant-grid">
      <section className="dashboard-card primary">
        <span>Tu participacion</span>
        <h2>{participant.full_name}</h2>
        <div className="possibility-counter">
          <strong>{possibilities}</strong>
          <p>{possibilities === 1 ? "posibilidad acumulada" : "posibilidades acumuladas"}</p>
        </div>
        <div className="mini-metrics">
          <span>1 inscripcion</span>
          <span>{referrals.length} referidos</span>
        </div>
      </section>

      <section className="dashboard-card qr-card">
        <div>
          <span>Link personal</span>
          <h3>Volver a tu tablero</h3>
          <p>Este QR permite recuperar tus posibilidades y seguir sumando referidos.</p>
        </div>
        {personalQr ? <img src={personalQr} alt="QR personal del participante" /> : null}
        <button type="button" onClick={onCopy}>
          <Clipboard size={18} />
          Copiar link
        </button>
      </section>

      <form className="form-panel referral-form" onSubmit={onSubmit}>
        <div className="section-heading">
          <UserPlus size={22} />
          <div>
            <h2>Sumar referido</h2>
            <p>Cada contacto cargado suma una posibilidad extra para el sorteo.</p>
          </div>
        </div>
        <Field
          label="Nombre referido"
          value={referral.full_name}
          onChange={(full_name) => setReferral({ ...referral, full_name })}
          required
        />
        <Field
          label="Telefono referido"
          value={referral.phone}
          onChange={(phone) => setReferral({ ...referral, phone })}
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
          {loading ? "Guardando..." : "Agregar referido"}
          <Plus size={18} />
        </button>
      </form>

      <section className="dashboard-card referral-list">
        <span>Referidos cargados</span>
        {referrals.length ? (
          referrals.map((item) => (
            <div className="referral-item" key={item.id}>
              <strong>{item.full_name}</strong>
              <small>{item.phone}</small>
            </div>
          ))
        ) : (
          <p className="muted">Cuando cargues referidos, van a aparecer aca.</p>
        )}
      </section>
    </div>
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
  exportCsv,
  winner,
  setWinner,
}) {
  if (!adminUnlocked) {
    return (
      <form className="form-panel compact" onSubmit={unlockAdmin}>
        <div className="section-heading">
          <Lock size={22} />
          <div>
            <h2>Panel cliente</h2>
            <p>Ingresa la clave definida para ver toda la informacion.</p>
          </div>
        </div>
        <Field label="Usuario" value={username} onChange={setUsername} required />
        <Field label="Clave" type="password" value={password} onChange={setPassword} required />
        <button className="primary-action">Entrar</button>
      </form>
    );
  }

  return (
    <div className="admin-panel">
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
        <button onClick={() => setWinner(pickWinner(rows))} disabled={!rows.length}>
          <Trophy size={18} />
          Sortear
        </button>
      </div>
      {winner ? (
        <div className="winner-card">
          <span>Ganador seleccionado</span>
          <h3>{winner.full_name}</h3>
          <p>
            {winner.phone} · {winner.email} · {winner.possibilities} posibilidades
          </p>
        </div>
      ) : null}
      <div className="admin-layout">
        <section className="table-card">
          <label className="search-box">
            <Search size={18} />
            <input
              value={searchTerm}
              placeholder="Buscar por nombre, telefono o email"
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
                      Todavia no hay inscripciones.
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
          <dt>Telefono</dt>
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
          <p className="muted">Sin referidos cargados.</p>
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
