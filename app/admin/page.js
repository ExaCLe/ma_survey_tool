"use client";

import Papa from "papaparse";
import {
  BarChart3,
  CheckCircle2,
  Clipboard,
  Download,
  FileText,
  Gauge,
  Home,
  Image as ImageIcon,
  KeyRound,
  Link2,
  ListChecks,
  Loader2,
  Lock,
  LogOut,
  MessageSquareText,
  RefreshCcw,
  Rows3,
  Settings,
  ShieldCheck,
  X,
  Upload,
  Users
} from "lucide-react";
import { useConvex, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback, useEffect, useMemo, useState } from "react";

const defaultQuestions = [
  {
    key: "spezifitaet",
    text: "Das Feedback ist spezifisch und bezieht sich konkret auf den Text.",
    labels: ["gar nicht spezifisch", "kaum spezifisch", "eher unspezifisch", "teils/teils", "eher spezifisch", "sehr spezifisch", "außerordentlich spezifisch"]
  },
  {
    key: "nuetzlichkeit",
    text: "Das Feedback ist für die Überarbeitung des Essays nützlich.",
    labels: ["gar nicht nützlich", "kaum nützlich", "eher nicht nützlich", "teils/teils", "eher nützlich", "sehr nützlich", "außerordentlich nützlich"]
  },
  {
    key: "verstaendlichkeit",
    text: "Das Feedback ist klar und verständlich formuliert.",
    labels: ["gar nicht klar", "kaum klar", "eher unklar", "teils/teils", "eher klar", "sehr klar", "außerordentlich klar"]
  },
  {
    key: "qualitaet",
    text: "Die Gesamtqualität des Feedbacks ist hoch.",
    labels: ["sehr niedrig", "niedrig", "eher niedrig", "mittel", "eher hoch", "hoch", "sehr hoch"]
  }
];

const nav = [
  ["overview", "Überblick", Home],
  ["import", "Import", Upload],
  ["questions", "Fragen", ListChecks],
  ["materials", "Material", FileText],
  ["links", "Links", Link2],
  ["results", "Ergebnisse", BarChart3],
  ["settings", "Einstellungen", Settings]
];

function statusLabel(status) {
  return { draft: "Entwurf", active: "Aktiv", closed: "Geschlossen" }[status] || status;
}

function alphaLabel(value) {
  if (value == null) return "noch keine Daten";
  if (value >= 0.8) return "sehr hohe Übereinstimmung";
  if (value >= 0.67) return "substantielle Übereinstimmung";
  if (value >= 0.4) return "moderate Übereinstimmung";
  return "geringe Übereinstimmung";
}

function formatAlpha(value) {
  return value == null ? "–" : value.toFixed(2);
}

function parseCsv(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (header) => header.trim() }).data;
}

function downloadFile(name, content, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function readCsvFile(event, setter) {
  const file = event.target.files?.[0];
  if (!file) return;
  setter(await file.text());
  event.target.value = "";
}

async function readDroppedCsv(event, setter) {
  event.preventDefault();
  const file = event.dataTransfer.files?.[0];
  if (!file) return;
  setter(await file.text());
}

function CsvDropZone({ label, description, onLoad }) {
  return (
    <label
      className="drop-zone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => readDroppedCsv(event, onLoad)}
    >
      <Upload size={20} />
      <span>
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <input type="file" accept=".csv,text/csv" onChange={(event) => readCsvFile(event, onLoad)} />
    </label>
  );
}

function useAdminPassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    setPassword(window.localStorage.getItem("survey-admin-password") || "");
    setReady(true);
  }, []);

  const save = useCallback((value) => {
    window.localStorage.setItem("survey-admin-password", value);
    setPassword(value);
  }, []);
  const clear = useCallback(() => {
    window.localStorage.removeItem("survey-admin-password");
    setPassword("");
  }, []);
  return { ready, password, save, clear };
}

function Login({ onLogin, error }) {
  const [value, setValue] = useState("");
  return (
    <main className="auth-wrap">
      <form
        className="auth-card"
        onSubmit={(event) => {
          event.preventDefault();
          onLogin(value);
        }}
      >
        <div className="brand" style={{ marginBottom: 22 }}>
          <div className="brand-mark">
            <MessageSquareText size={17} />
          </div>
          <span>
            Survey<span>Annotate</span>
          </span>
        </div>
        <p className="eyebrow">Adminbereich</p>
        <h1 className="page-title" style={{ marginTop: 6 }}>Passwort eingeben</h1>
        <p className="page-subtitle">Das Passwort wird nur lokal im Browser gespeichert und für Admin-Aktionen an Convex gesendet.</p>
        <label className="field-label" style={{ marginTop: 22 }}>
          Admin-Passwort
          <input className="field" type="password" value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
        </label>
        {error && <div className="notice error" style={{ marginTop: 12 }}>{error}</div>}
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} type="submit">
          <Lock size={16} /> Öffnen
        </button>
      </form>
    </main>
  );
}

function Shell({ section, setSection, children, onLogout, status }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <MessageSquareText size={17} />
          </div>
          <span>
            Survey<span>Annotate</span>
          </span>
        </div>
        <nav className="nav-list" aria-label="Hauptnavigation">
          {nav.map(([key, label, Icon]) => (
            <button key={key} className={`nav-item ${section === key ? "active" : ""}`} type="button" onClick={() => setSection(key)}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">A</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 760 }}>Admin</div>
            <div className="muted small">{statusLabel(status)}</div>
          </div>
          <button className="btn btn-ghost" type="button" onClick={onLogout} aria-label="Abmelden">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

function Metric({ icon: Icon, label, value, note }) {
  return (
    <div className="metric-card">
      <div className="icon-tile">
        <Icon size={25} />
      </div>
      <div>
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        <div className="metric-note">{note}</div>
      </div>
    </div>
  );
}

function StudyStatusControl({ password, data, actions }) {
  const statuses = [
    ["draft", "Entwurf"],
    ["active", "Aktiv"],
    ["closed", "Geschlossen"]
  ];
  return (
    <div className="status-control" role="group" aria-label="Studienstatus ändern">
      {statuses.map(([status, label]) => (
        <button
          className={data.settings.status === status ? "selected" : ""}
          type="button"
          key={status}
          disabled={status === "active" && data.validationErrors.length > 0}
          onClick={() => actions.setStudyStatus({ adminPassword: password, status })}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Overview({ password, data, actions, setSection }) {
  const alpha = data.agreement.overallAlpha;
  return (
    <div className="content-grid">
      <div className="metric-grid">
        <Metric icon={FileText} label="Essays" value={data.essays.length} note="importierte Essays" />
        <Metric icon={Users} label="Annotator:innen" value={data.participants.length} note={`${data.groups.length} Gruppen`} />
        <Metric icon={Rows3} label="Antworten" value={`${data.completion.answered} / ${data.completion.required}`} note={`${data.completion.percent}% vollständig`} />
        <Metric icon={CheckCircle2} label="Abgeschlossen" value={data.completion.completedParticipants} note="Teilnehmende fertig" />
      </div>

      {data.validationErrors.length > 0 && (
        <div className="notice error">
          <strong>Aktivierung blockiert.</strong>
          <ul>
            {data.validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="two-col">
        <section className="panel">
          <div className="panel-title-row">
            <h2 className="panel-title">
              <Gauge size={19} /> Übereinstimmung
            </h2>
            <span className="status-pill">{alphaLabel(alpha)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
            <div className="alpha-ring" style={{ "--value": Math.max(0, (alpha || 0) * 100) }}>
              <div style={{ textAlign: "center" }}>
                <div className="alpha-value">{formatAlpha(alpha)}</div>
                <div className="small muted">ordinales Alpha</div>
              </div>
            </div>
            <div style={{ flex: "1 1 260px" }}>
              <p className="muted">
                Krippendorffs Alpha wird über alle Bewertungen berechnet. Die Distanz zwischen Likert-Werten wird ordinal über quadrierte Abstände modelliert.
              </p>
              <button className="btn btn-secondary" type="button" onClick={() => setSection("results")}>
                Ergebnisse öffnen
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-title-row">
            <h2 className="panel-title">
              <ListChecks size={19} /> Alpha pro Frage
            </h2>
          </div>
          <div style={{ display: "grid", gap: 18 }}>
            {data.agreement.byQuestion.length === 0 ? (
              <div className="empty-state">Noch keine Fragen oder Antworten vorhanden.</div>
            ) : (
              data.agreement.byQuestion.map((question) => (
                <div className="question-bar" key={question.questionId}>
                  <strong>{question.key}</strong>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${Math.max(0, question.alpha || 0) * 100}%` }} />
                  </div>
                  <strong>{formatAlpha(question.alpha)}</strong>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="two-col">
        <section className="panel">
          <div className="panel-title-row">
            <h2 className="panel-title">
              <Users size={19} /> Gruppen
            </h2>
          </div>
          <table className="table">
            <tbody>
              {data.groups.map((group) => {
                const topic = data.topics.find((item) => item._id === group.topicId);
                const count = data.participants.filter((participant) => participant.groupId === group._id).length;
                return (
                  <tr key={group._id}>
                    <td>
                      <span className="mini-avatar" style={{ width: 38, height: 38, borderRadius: 12, fontWeight: 800 }}>{group.initial}</span>
                    </td>
                    <td>
                      <strong>{group.name}</strong>
                      <div className="muted small">{count} Teilnehmende</div>
                    </td>
                    <td>{topic?.title || "kein Thema"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <div className="panel-title-row">
            <h2 className="panel-title">
              <ShieldCheck size={19} /> Studienstatus
            </h2>
            <span className={`status-pill ${data.settings.status === "active" ? "good" : data.settings.status === "closed" ? "bad" : "warn"}`}>
              {statusLabel(data.settings.status)}
            </span>
          </div>
          <p className="muted">
            Im Entwurf sind Teilnehmerlinks gesperrt. Aktiv erlaubt die Bearbeitung. Geschlossen zeigt für Links eine geschlossene Studie.
          </p>
          <StudyStatusControl password={password} data={data} actions={actions} />
          {data.validationErrors.length > 0 && (
            <p className="small muted" style={{ marginBottom: 0 }}>Aktivieren ist gesperrt, solange Validierungsfehler bestehen.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function ImportSection({ password, actions }) {
  const [participantCsv, setParticipantCsv] = useState("groupKey,firstName\nA,Anna\nA,Ben\nA,Cem\nB,Dana\nB,Emil\nB,Finn");
  const [materialCsv, setMaterialCsv] = useState("topicKey,topicTitle,prompt,promptImageUrl,essayKey,essayTitle,essayText,methodKey,feedbackText\nargumentation,Argumentation,\"Schreibe einen argumentativen Essay.\",,essay-01,Essay 1,\"Essaytext...\",method-a,\"Feedbacktext...\"");
  const [message, setMessage] = useState("");

  async function importParticipants() {
    const rows = parseCsv(participantCsv);
    const byGroup = new Map();
    for (const row of rows) {
      const groupKey = String(row.groupKey || row.group || "").trim().toUpperCase();
      const firstName = String(row.firstName || row.name || "").trim();
      if (!groupKey || !firstName) continue;
      if (!byGroup.has(groupKey)) byGroup.set(groupKey, []);
      byGroup.get(groupKey).push(firstName);
    }
    await actions.importParticipantGroups({
      adminPassword: password,
      groups: [...byGroup.entries()].map(([groupKey, names]) => ({ groupKey, names }))
    });
    setMessage("Teilnehmende wurden importiert.");
  }

  async function importMaterials() {
    const rows = parseCsv(materialCsv).map((row) => ({
      topicKey: String(row.topicKey || "").trim(),
      topicTitle: String(row.topicTitle || "").trim(),
      prompt: String(row.prompt || "").trim(),
      promptImageUrl: String(row.promptImageUrl || row.promptImage || "").trim(),
      essayKey: String(row.essayKey || "").trim(),
      essayTitle: String(row.essayTitle || "").trim(),
      essayText: String(row.essayText || "").trim(),
      methodKey: String(row.methodKey || "").trim(),
      feedbackText: String(row.feedbackText || "").trim()
    }));
    await actions.importMaterials({ adminPassword: password, rows });
    setMessage("Materialien wurden importiert.");
  }

  return (
    <div className="content-grid">
      {message && <div className="notice success">{message}</div>}
      <div className="two-col">
        <section className="panel">
          <div className="panel-title-row">
            <h2 className="panel-title">
              <Users size={19} /> Teilnehmende importieren
            </h2>
          </div>
          <p className="muted">Eine Zeile pro Person. Du schreibst die Namen bereits in Gruppen.</p>
          <div className="notice">
            Pflichtspalten: <strong>groupKey</strong>, <strong>firstName</strong>
          </div>
          <CsvDropZone
            label="Teilnehmenden-CSV hier ablegen oder auswählen"
            description="Die Datei wird in das Feld unten geladen und kann vor dem Import noch bearbeitet werden."
            onLoad={setParticipantCsv}
          />
          <textarea className="textarea" style={{ marginTop: 14, minHeight: 260 }} value={participantCsv} onChange={(event) => setParticipantCsv(event.target.value)} />
          <button className="btn btn-primary" type="button" style={{ marginTop: 12 }} onClick={importParticipants}>
            <Upload size={16} /> Teilnehmende importieren
          </button>
        </section>

        <section className="panel">
          <div className="panel-title-row">
            <h2 className="panel-title">
              <FileText size={19} /> Materialien importieren
            </h2>
          </div>
          <p className="muted">Long-CSV: eine Zeile pro Feedbacktext eines Essays.</p>
          <div className="notice">
            Pflichtspalten: <strong>topicKey</strong>, <strong>topicTitle</strong>, <strong>prompt</strong>, <strong>essayKey</strong>, <strong>essayTitle</strong>, <strong>essayText</strong>, <strong>methodKey</strong>, <strong>feedbackText</strong>. Optional: <strong>promptImageUrl</strong>
          </div>
          <CsvDropZone
            label="Material-CSV hier ablegen oder auswählen"
            description="Der Schreibauftrag kommt aus der Spalte prompt und wird mit dem Thema gespeichert."
            onLoad={setMaterialCsv}
          />
          <textarea className="textarea" style={{ marginTop: 14, minHeight: 260 }} value={materialCsv} onChange={(event) => setMaterialCsv(event.target.value)} />
          <button className="btn btn-primary" type="button" style={{ marginTop: 12 }} onClick={importMaterials}>
            <Upload size={16} /> Materialien importieren
          </button>
        </section>
      </div>
    </div>
  );
}

function QuestionsSection({ password, data, saveQuestions }) {
  const [questions, setQuestions] = useState(() => (data.questions.length ? data.questions : defaultQuestions));
  const [message, setMessage] = useState("");
  const update = (index, patch) => setQuestions((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  return (
    <div className="content-grid">
      {message && <div className="notice success">{message}</div>}
      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">
            <ListChecks size={19} /> Likert-Fragen
          </h2>
          <button
            className="btn btn-primary"
            type="button"
            onClick={async () => {
              await saveQuestions({
                adminPassword: password,
                questions: questions.map(({ key, text, labels }) => ({ key, text, labels }))
              });
              setMessage("Fragen gespeichert.");
            }}
          >
            <CheckCircle2 size={16} /> Fragen speichern
          </button>
        </div>
        <div style={{ display: "grid", gap: 18 }}>
          {questions.map((question, index) => (
            <div className="panel" style={{ boxShadow: "none" }} key={index}>
              <div className="form-grid">
                <label className="field-label">
                  Key
                  <input className="field" value={question.key} onChange={(event) => update(index, { key: event.target.value })} />
                </label>
                <label className="field-label">
                  Fragetext
                  <input className="field" value={question.text} onChange={(event) => update(index, { text: event.target.value })} />
                </label>
                {Array.from({ length: 7 }, (_, labelIndex) => (
                  <label className="field-label" key={labelIndex}>
                    Label {labelIndex + 1}
                    <input
                      className="field"
                      value={question.labels[labelIndex] || ""}
                      onChange={(event) => {
                        const labels = [...question.labels];
                        labels[labelIndex] = event.target.value;
                        update(index, { labels });
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MaterialsSection({ password, data, actions }) {
  const [uploadingTopic, setUploadingTopic] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const feedbacksByEssay = useMemo(() => {
    const map = new Map();
    for (const essay of data.essays) {
      map.set(
        essay._id,
        data.feedbacks.filter((feedback) => feedback.essayId === essay._id).sort((a, b) => a.setupOrder - b.setupOrder)
      );
    }
    return map;
  }, [data]);
  const essayCountsByTopic = data.topics.map((topic) => ({
    topic,
    essayCount: data.essays.filter((essay) => essay.topicId === topic._id).length
  }));
  const incompleteEssayCount = data.essays.filter((essay) => (feedbacksByEssay.get(essay._id) || []).length !== 3).length;
  const canGenerateAssignments =
    data.topics.length === 3 &&
    data.groups.length === 6 &&
    data.essays.length > 0 &&
    incompleteEssayCount === 0 &&
    essayCountsByTopic.every((item) => item.essayCount > 0 && item.essayCount % 2 === 0) &&
    new Set(essayCountsByTopic.map((item) => item.essayCount)).size === 1;

  async function move(essayId, feedbackId, direction) {
    const list = [...(feedbacksByEssay.get(essayId) || [])];
    const index = list.findIndex((item) => item._id === feedbackId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]];
    await actions.updateFeedbackOrder({ adminPassword: password, essayId, feedbackIds: list.map((item) => item._id) });
  }

  async function uploadPromptImage(topicId, file) {
    if (!file) return;
    setUploadMessage("");
    setUploadingTopic(topicId);
    try {
      const uploadUrl = await actions.generatePromptImageUploadUrl({ adminPassword: password });
      const response = await window.fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file
      });
      if (!response.ok) {
        throw new Error("Promptbild konnte nicht hochgeladen werden.");
      }
      const { storageId } = await response.json();
      await actions.saveTopicPromptImage({ adminPassword: password, topicId, storageId });
      setUploadMessage("Promptbild wurde gespeichert.");
    } finally {
      setUploadingTopic("");
    }
  }

  return (
    <div className="content-grid">
      {uploadMessage && <div className="notice success">{uploadMessage}</div>}
      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">
            <RefreshCcw size={19} /> Randomisierung
          </h2>
          <button className="btn btn-primary" type="button" disabled={!canGenerateAssignments} onClick={() => actions.generateAssignments({ adminPassword: password })}>
            Gruppen, Essays und Feedbackreihenfolge generieren
          </button>
        </div>
        <p className="muted">
          Die App weist sechs Gruppen zufällig drei Themen zu, teilt Essays pro Thema in zwei nicht überlappende Hälften und randomisiert die Feedbackreihenfolge.
        </p>
        <div className={`notice ${canGenerateAssignments ? "success" : "error"}`} style={{ marginTop: 16 }}>
          <strong>{canGenerateAssignments ? "Bereit für Randomisierung." : "Noch nicht bereit für Randomisierung."}</strong>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            <span>{data.topics.length} / 3 Themen importiert</span>
            <span>{data.groups.length} / 6 Gruppen importiert</span>
            <span>{data.essays.length} Essays importiert</span>
            <span>{incompleteEssayCount === 0 ? "Alle Essays haben 3 Feedbacktexte" : `${incompleteEssayCount} Essays haben nicht genau 3 Feedbacktexte`}</span>
            {essayCountsByTopic.length > 0 && (
              <span>
                Essays pro Thema:{" "}
                {essayCountsByTopic.map(({ topic, essayCount }) => `${topic.title}: ${essayCount}`).join(", ")}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">
            <ImageIcon size={19} /> Promptbilder
          </h2>
          <span className="tag">{data.topics.filter((topic) => topic.promptImageUrl).length} / {data.topics.length} gesetzt</span>
        </div>
        <p className="muted">
          Lade pro Thema das Bild zum Schreibauftrag hoch. Die Datei wird in Convex gespeichert und in den Teilnehmendenlinks direkt ausgeliefert.
        </p>
        {data.topics.length === 0 ? (
          <div className="empty-state">Importiere zuerst Materialien, dann erscheinen hier die Themen.</div>
        ) : (
          <div className="prompt-upload-list">
            {data.topics.map((topic) => (
              <div className="prompt-upload-row" key={topic._id}>
                <div className="prompt-upload-preview">
                  {topic.promptImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={topic.promptImageUrl} alt={`Promptbild ${topic.title}`} />
                  ) : (
                    <ImageIcon size={22} aria-hidden="true" />
                  )}
                </div>
                <div className="prompt-upload-copy">
                  <strong>{topic.title}</strong>
                  <span className="muted small">{topic.promptImageUrl ? "Bild gespeichert" : "Noch kein Bild gespeichert"}</span>
                </div>
                <div className="prompt-upload-actions">
                  <label className={`btn btn-secondary ${uploadingTopic === topic._id ? "disabled" : ""}`}>
                    {uploadingTopic === topic._id ? <Loader2 size={16} /> : <Upload size={16} />}
                    Bild wählen
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      disabled={uploadingTopic === topic._id}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        uploadPromptImage(topic._id, file);
                      }}
                    />
                  </label>
                  {topic.promptImageUrl && (
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => actions.clearTopicPromptImage({ adminPassword: password, topicId: topic._id })}
                      aria-label={`Promptbild für ${topic.title} entfernen`}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {data.topics.map((topic) => (
        <section className="panel" key={topic._id}>
          <div className="panel-title-row">
            <h2 className="panel-title">{topic.title}</h2>
            <span className="tag">{data.essays.filter((essay) => essay.topicId === topic._id).length} Essays</span>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {data.essays
              .filter((essay) => essay.topicId === topic._id)
              .map((essay) => (
                <div className="notice" key={essay._id}>
                  <strong>{essay.title}</strong>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {(feedbacksByEssay.get(essay._id) || []).map((feedback, index) => (
                      <div className="question-bar" key={feedback._id}>
                        <span>
                          {index + 1}. Feedback {String.fromCharCode(65 + index)}
                          <span className="muted small"> ({feedback.methodKey})</span>
                        </span>
                        <div className="muted small">{feedback.text.slice(0, 120)}{feedback.text.length > 120 ? "…" : ""}</div>
                        <div className="button-row">
                          <button className="btn btn-secondary" type="button" onClick={() => move(essay._id, feedback._id, -1)}>↑</button>
                          <button className="btn btn-secondary" type="button" onClick={() => move(essay._id, feedback._id, 1)}>↓</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LinksSection({ data }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const csv = [
    ["inviteName", "pseudonym", "code", "groupKey", "link"].join(","),
    ...data.participants.map((participant) => {
      const group = data.groups.find((item) => item._id === participant.groupId);
      return [participant.inviteName, participant.pseudonym, participant.code, group?.key || "", `${origin}/s/${participant.token}`]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",");
    })
  ].join("\n");
  return (
    <div className="content-grid">
      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">
            <KeyRound size={19} /> Persönliche Links
          </h2>
          <button className="btn btn-secondary" type="button" onClick={() => downloadFile("survey-links.csv", csv)}>
            <Download size={16} /> Linkliste exportieren
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Pseudonym</th>
              <th>Gruppe</th>
              <th>Status</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {data.participants.map((participant) => {
              const group = data.groups.find((item) => item._id === participant.groupId);
              const link = `${origin}/s/${participant.token}`;
              return (
                <tr key={participant._id}>
                  <td>{participant.inviteName}</td>
                  <td>{participant.pseudonym}</td>
                  <td>{group?.key}</td>
                  <td><span className="status-pill">{participant.status}</span></td>
                  <td>
                    <button className="btn btn-secondary" type="button" onClick={() => navigator.clipboard.writeText(link)}>
                      <Clipboard size={16} /> Kopieren
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ResultsSection({ password, data, exportCsv, reopenParticipant }) {
  return (
    <div className="content-grid">
      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">
            <Download size={19} /> Export
          </h2>
          <button className="btn btn-primary" type="button" onClick={() => downloadFile("survey-responses.csv", exportCsv || "")} disabled={!exportCsv}>
            CSV herunterladen
          </button>
        </div>
        <p className="muted">Der Antwortexport enthält keine echten Vornamen. Likert-Antworten werden numerisch als 1 bis 7 ausgegeben.</p>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">Mittelwerte</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Frage</th>
              <th>Methode</th>
              <th>Essay</th>
              <th>N</th>
              <th>Mittelwert</th>
            </tr>
          </thead>
          <tbody>
            {data.averages.map((row, index) => (
              <tr key={index}>
                <td>{row.questionKey}</td>
                <td>{row.methodKey}</td>
                <td>{row.essayKey}</td>
                <td>{row.count}</td>
                <td>{row.mean.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">Teilnehmende</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Pseudonym</th>
              <th>Code</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {data.participants.map((participant) => (
              <tr key={participant._id}>
                <td>{participant.pseudonym}</td>
                <td>{participant.code}</td>
                <td>{participant.status}</td>
                <td>
                  <button className="btn btn-secondary" type="button" onClick={() => reopenParticipant({ adminPassword: password, participantId: participant._id })}>
                    Wieder öffnen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function SettingsSection({ password, data, actions }) {
  return (
    <div className="content-grid">
      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">
            <ShieldCheck size={19} /> Studienstatus
          </h2>
          <span className={`status-pill ${data.settings.status === "active" ? "good" : data.settings.status === "closed" ? "bad" : "warn"}`}>
            {statusLabel(data.settings.status)}
          </span>
        </div>
        <StudyStatusControl password={password} data={data} actions={actions} />
        {data.validationErrors.length > 0 && (
          <div className="notice error" style={{ marginTop: 16 }}>
            <strong>Vor Aktivierung beheben:</strong>
            <ul>
              {data.validationErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">Gefahrenbereich</h2>
        </div>
        <p className="muted">Setzt alle Studieninhalte zurück. Nutze das nur vor dem echten Start.</p>
        <button className="btn btn-danger" type="button" onClick={() => window.confirm("Wirklich alles zurücksetzen?") && actions.resetStudy({ adminPassword: password })}>
          Alles zurücksetzen
        </button>
      </section>
    </div>
  );
}

export default function AdminPage() {
  const convex = useConvex();
  const { ready, password, save, clear } = useAdminPassword();
  const [section, setSection] = useState("overview");
  const [dashboard, setDashboard] = useState();
  const [exportCsv, setExportCsv] = useState("");
  const [authError, setAuthError] = useState("");
  const [actionError, setActionError] = useState("");
  const rawActions = {
    importParticipantGroups: useMutation(api.study.importParticipantGroups),
    importMaterials: useMutation(api.study.importMaterials),
    saveQuestions: useMutation(api.study.saveQuestions),
    generateAssignments: useMutation(api.study.generateAssignments),
    setStudyStatus: useMutation(api.study.setStudyStatus),
    updateFeedbackOrder: useMutation(api.study.updateFeedbackOrder),
    generatePromptImageUploadUrl: useMutation(api.study.generatePromptImageUploadUrl),
    saveTopicPromptImage: useMutation(api.study.saveTopicPromptImage),
    clearTopicPromptImage: useMutation(api.study.clearTopicPromptImage),
    reopenParticipant: useMutation(api.study.reopenParticipant),
    resetStudy: useMutation(api.study.resetStudy)
  };

  const refresh = useCallback(
    async (adminPassword = password) => {
      if (!adminPassword) return;
      setActionError("");
      try {
        const [nextDashboard, nextExportCsv] = await Promise.all([
          convex.query(api.study.dashboard, { adminPassword }),
          convex.query(api.study.exportResponsesCsv, { adminPassword })
        ]);
        setDashboard(nextDashboard);
        setExportCsv(nextExportCsv);
        setAuthError("");
      } catch (error) {
        const message = error?.message || "Adminbereich konnte nicht geladen werden.";
        if (message.includes("Admin-Passwort")) {
          clear();
          setDashboard(undefined);
          setExportCsv("");
          setAuthError("Das Admin-Passwort ist nicht korrekt.");
          return;
        }
        setActionError(message);
      }
    },
    [clear, convex, password]
  );

  useEffect(() => {
    if (ready && password) {
      refresh(password);
    }
  }, [password, ready, refresh]);

  const actions = useMemo(() => {
    const wrap = (mutation) => async (args) => {
      setActionError("");
      try {
        const result = await mutation(args);
        await refresh(args.adminPassword);
        return result;
      } catch (error) {
        const message = error?.message || "Aktion fehlgeschlagen.";
        setActionError(message);
        throw error;
      }
    };
    return {
      importParticipantGroups: wrap(rawActions.importParticipantGroups),
      importMaterials: wrap(rawActions.importMaterials),
      saveQuestions: wrap(rawActions.saveQuestions),
      generateAssignments: wrap(rawActions.generateAssignments),
      setStudyStatus: wrap(rawActions.setStudyStatus),
      updateFeedbackOrder: wrap(rawActions.updateFeedbackOrder),
      generatePromptImageUploadUrl: wrap(rawActions.generatePromptImageUploadUrl),
      saveTopicPromptImage: wrap(rawActions.saveTopicPromptImage),
      clearTopicPromptImage: wrap(rawActions.clearTopicPromptImage),
      reopenParticipant: wrap(rawActions.reopenParticipant),
      resetStudy: wrap(rawActions.resetStudy)
    };
  }, [
    rawActions.clearTopicPromptImage,
    rawActions.generateAssignments,
    rawActions.generatePromptImageUploadUrl,
    rawActions.importMaterials,
    rawActions.importParticipantGroups,
    rawActions.reopenParticipant,
    rawActions.resetStudy,
    rawActions.saveQuestions,
    rawActions.saveTopicPromptImage,
    rawActions.setStudyStatus,
    rawActions.updateFeedbackOrder,
    refresh
  ]);

  if (!ready) {
    return (
      <main className="auth-wrap">
        <div className="auth-card">
          <Loader2 size={18} /> Lädt Adminbereich…
        </div>
      </main>
    );
  }

  if (!password) return <Login onLogin={(value) => { save(value); setAuthError(""); }} error={authError} />;

  if (dashboard === undefined) {
    return (
      <Shell section={section} setSection={setSection} onLogout={clear} status="draft">
        <div className="content-grid">
          <div className="panel">
            <Loader2 size={18} /> Lädt Studie…
            {actionError && <div className="notice error" style={{ marginTop: 12 }}>{actionError}</div>}
          </div>
        </div>
      </Shell>
    );
  }

  const activeNav = nav.find(([key]) => key === section);
  const subtitle = dashboard.settings.status === "active" ? "Studie läuft, Antworten werden automatisch gespeichert" : "Konfiguration, Links und Ergebnisse der Studie";

  return (
    <Shell section={section} setSection={setSection} onLogout={clear} status={dashboard.settings.status}>
      <div className="page-head">
        <div>
          <h1 className="page-title">{activeNav?.[1] || "Überblick"}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <span className={`status-pill ${dashboard.settings.status === "active" ? "good" : dashboard.settings.status === "closed" ? "bad" : "warn"}`}>
          {statusLabel(dashboard.settings.status)}
        </span>
      </div>

      {actionError && (
        <div className="content-grid" style={{ marginBottom: 20 }}>
          <div className="notice error">{actionError}</div>
        </div>
      )}

      {section === "overview" && <Overview password={password} data={dashboard} actions={actions} setSection={setSection} />}
      {section === "import" && <ImportSection password={password} actions={actions} />}
      {section === "questions" && <QuestionsSection password={password} data={dashboard} saveQuestions={actions.saveQuestions} />}
      {section === "materials" && <MaterialsSection password={password} data={dashboard} actions={actions} />}
      {section === "links" && <LinksSection data={dashboard} />}
      {section === "results" && <ResultsSection password={password} data={dashboard} exportCsv={exportCsv} reopenParticipant={actions.reopenParticipant} />}
      {section === "settings" && <SettingsSection password={password} data={dashboard} actions={actions} />}
    </Shell>
  );
}
