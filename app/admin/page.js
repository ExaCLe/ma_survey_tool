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
  PencilLine,
  RefreshCcw,
  Rows3,
  Search,
  Settings,
  ShieldCheck,
  X,
  Upload,
  Users
} from "lucide-react";
import { useConvex, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback, useEffect, useMemo, useState } from "react";

const nav = [
  ["overview", "Überblick", Home],
  ["import", "Import", Upload],
  ["materials", "Material", FileText],
  ["links", "Links", Link2],
  ["results", "Ergebnisse", BarChart3],
  ["corrections", "Korrektur", PencilLine],
  ["settings", "Einstellungen", Settings]
];

function statusLabel(status) {
  return { draft: "Entwurf", active: "Aktiv", closed: "Geschlossen" }[status] || status;
}

function alphaLabel(value) {
  if (value == null) return "mindestens zwei Annotator:innen nötig";
  if (value >= 0.8) return "sehr hohe Übereinstimmung";
  if (value >= 0.67) return "substantielle Übereinstimmung";
  if (value >= 0.4) return "moderate Übereinstimmung";
  return "geringe Übereinstimmung";
}

function formatAlpha(value) {
  return value == null ? "–" : value.toFixed(2);
}

function formatSignedDelta(value) {
  if (!Number.isFinite(value)) return "–";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatSignedInteger(value) {
  if (!Number.isFinite(value)) return "–";
  return `${value > 0 ? "+" : ""}${value}`;
}

function formatStat(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "–";
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : "–";
}

function formatDateTime(value) {
  if (!Number.isFinite(value)) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function scorePercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, (value / 7) * 100));
}

function heatLevel(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, (value - 1) / 6));
}

function parseCsv(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (header) => header.trim() }).data;
}

function optionalNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`"${raw}" ist keine gültige Zahl.`);
  }
  return parsed;
}

function requiredNumber(row, key) {
  const value = optionalNumber(row[key]);
  if (!Number.isFinite(value)) {
    throw new Error(`Spalte ${key} benötigt eine Zahl.`);
  }
  return value;
}

function optionalString(value) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function isTruthyCsvFlag(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "ja";
}

const automaticMetricFields = [
  ["combined_rank", "combinedRank", true],
  ["combined_ability", "combinedAbility", true],
  ["combined_score", "combinedScore", true],
  ["combined_wins", "combinedWins", true],
  ["combined_losses", "combinedLosses", true],
  ["combined_ties", "combinedTies", true],
  ["combined_comparisons", "combinedComparisons", true],
  ["gemma_rank", "gemmaRank"],
  ["gemma_ability", "gemmaAbility"],
  ["gemma_score", "gemmaScore"],
  ["gemma_wins", "gemmaWins"],
  ["gemma_losses", "gemmaLosses"],
  ["gemma_ties", "gemmaTies"],
  ["gemma_comparisons", "gemmaComparisons"],
  ["llama_rank", "llamaRank"],
  ["llama_ability", "llamaAbility"],
  ["llama_score", "llamaScore"],
  ["llama_wins", "llamaWins"],
  ["llama_losses", "llamaLosses"],
  ["llama_ties", "llamaTies"],
  ["llama_comparisons", "llamaComparisons"],
  ["openai_rank", "openaiRank"],
  ["openai_ability", "openaiAbility"],
  ["openai_score", "openaiScore"],
  ["openai_wins", "openaiWins"],
  ["openai_losses", "openaiLosses"],
  ["openai_ties", "openaiTies"],
  ["openai_comparisons", "openaiComparisons"]
];

function parseAutomaticRankingRows(csv) {
  return parseCsv(csv)
    .map((row) => {
      const autoApproachKey = String(row.autoApproachKey || "").trim();
      if (!autoApproachKey) return null;
      const parsed = {
        surveyMethodKey: optionalString(row.surveyMethodKey),
        autoApproachKey,
        displayName: String(row.displayName || row.autoApproachKey || "").trim(),
        isCurrentManualAnnotationMethod: isTruthyCsvFlag(row.isCurrentManualAnnotationMethod),
        materialFeedbackRows: optionalNumber(row.materialFeedbackRows),
        rankingGeneratedAt: optionalString(row.rankingGeneratedAt),
        rankingDescription: optionalString(row.rankingDescription),
        rankingSourceModels: optionalString(row.rankingSourceModels)
      };
      for (const [csvKey, fieldKey, required] of automaticMetricFields) {
        const value = required ? requiredNumber(row, csvKey) : optionalNumber(row[csvKey]);
        if (Number.isFinite(value)) parsed[fieldKey] = value;
      }
      return Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== undefined));
    })
    .filter(Boolean);
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

function csvLine(values) {
  return values.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",");
}

function promptImageSrc(value) {
  return String(value || "").trim();
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

function PromptImagePreview({ src, title }) {
  const [failed, setFailed] = useState(false);
  const imageSrc = promptImageSrc(src);

  useEffect(() => {
    setFailed(false);
  }, [imageSrc]);

  if (!imageSrc || failed) {
    return <ImageIcon size={22} aria-hidden="true" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageSrc} alt={`Promptbild ${title}`} onError={() => setFailed(true)} />
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
                Krippendorffs Alpha vergleicht nur Antworten verschiedener Annotator:innen auf dasselbe Essay, denselben Feedbacktext und dasselbe Kriterium.
                Mit nur einer Bewertung pro Item bleibt Alpha leer.
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
                      <div className="muted small">
                        {count} Teilnehmende{group.gradeLevel ? ` · Klasse ${group.gradeLevel}` : ""}
                      </div>
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

function ImportSection({ password, data, actions }) {
  const [participantCsv, setParticipantCsv] = useState("groupKey,firstName\nA,Anna\nA,Ben\nA,Cem\nB,Dana\nB,Emil\nB,Finn");
  const [materialCsv, setMaterialCsv] = useState("topicKey,topicTitle,prompt,promptImageUrl,essayKey,essayTitle,gradeLevel,essayText,methodKey,feedbackText\nargumentation,Argumentation,\"Schreibe einen argumentativen Essay.\",,essay-01,Essay 1,9,\"Essaytext...\",method-a,\"Feedbacktext...\"");
  const [automaticCsv, setAutomaticCsv] = useState("surveyMethodKey,autoApproachKey,displayName,isCurrentManualAnnotationMethod,materialFeedbackRows,combined_rank,combined_ability,combined_score,combined_wins,combined_losses,combined_ties,combined_comparisons,gemma_rank,gemma_ability,gemma_score,gemma_wins,gemma_losses,gemma_ties,gemma_comparisons,llama_rank,llama_ability,llama_score,llama_wins,llama_losses,llama_ties,llama_comparisons,openai_rank,openai_ability,openai_score,openai_wins,openai_losses,openai_ties,openai_comparisons,rankingGeneratedAt,rankingDescription,rankingSourceModels\nllama_single_issue_v1,single_issue_v1_v3,Llama Single Issue v1,1,36,5,0.0916,-2.3905,4464,2134,96,6598,5,0.0913,-2.3932,1562,644,28,2206,1,0.1583,-1.8435,1757,451,8,2208,6,0.0551,-2.8986,1145,1039,60,2184,2026-06-05T08:25:54,\"Final helpfulness ranking\",\"gemma,llama,openai\"");
  const [message, setMessage] = useState("");
  const automaticPreview = useMemo(() => {
    try {
      const rows = parseAutomaticRankingRows(automaticCsv);
      const mappedRows = rows.filter((row) => row.surveyMethodKey);
      const currentMethodKeys = [...new Set((data?.feedbacks || []).map((feedback) => feedback.methodKey))].sort((a, b) => a.localeCompare(b));
      const mappedKeys = new Set(mappedRows.map((row) => row.surveyMethodKey));
      return {
        rows,
        mappedRows,
        unmappedRows: rows.filter((row) => !row.surveyMethodKey),
        missingMethodKeys: currentMethodKeys.filter((methodKey) => !mappedKeys.has(methodKey)),
        error: ""
      };
    } catch (error) {
      return { rows: [], mappedRows: [], unmappedRows: [], missingMethodKeys: [], error: error?.message || "CSV konnte nicht gelesen werden." };
    }
  }, [automaticCsv, data?.feedbacks]);

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
      gradeLevel: String(row.gradeLevel || row.grade || row.klasse || "").trim(),
      essayText: String(row.essayText || "").trim(),
      methodKey: String(row.methodKey || "").trim(),
      feedbackText: String(row.feedbackText || "").trim()
    }));
    await actions.importMaterials({ adminPassword: password, rows });
    setMessage("Materialien wurden importiert.");
  }

  async function importAutomaticRankings() {
    if (automaticPreview.error) {
      throw new Error(automaticPreview.error);
    }
    const result = await actions.importAutomaticRankings({
      adminPassword: password,
      rows: automaticPreview.rows
    });
    const missing = result.missingSurveyMethodKeys?.length ? ` Fehlende Material-Methoden: ${result.missingSurveyMethodKeys.join(", ")}.` : "";
    setMessage(
      `Automatische Rankings wurden importiert: ${result.importedRows} Zeilen, ${result.mappedSurveyMethods} gemappte Survey-Methoden.${missing}`
    );
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
            Pflichtspalten: <strong>topicKey</strong>, <strong>topicTitle</strong>, <strong>prompt</strong>, <strong>essayKey</strong>, <strong>essayTitle</strong>, <strong>gradeLevel</strong>, <strong>essayText</strong>, <strong>methodKey</strong>, <strong>feedbackText</strong>. Optional: <strong>promptImageUrl</strong>
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

      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">
            <BarChart3 size={19} /> Automatische Rankings importieren
          </h2>
          <span className="tag">{data?.automaticRankings?.length || 0} gespeichert</span>
        </div>
        <p className="muted">Importiert die Helpfulness-Rankings aus der erzeugten Automatic-Ranking-CSV. Materialien und Antworten bleiben unverändert.</p>
        <div className="notice">
          Pflichtspalten: <strong>autoApproachKey</strong>, <strong>combined_rank</strong>, <strong>combined_ability</strong>, <strong>combined_score</strong>, <strong>combined_wins</strong>, <strong>combined_losses</strong>, <strong>combined_ties</strong>, <strong>combined_comparisons</strong>. Optional zur Zuordnung: <strong>surveyMethodKey</strong>.
        </div>
        <CsvDropZone
          label="Automatic-Ranking-CSV hier ablegen oder auswählen"
          description="Zeilen mit surveyMethodKey werden in Ergebnisse gegen die Human-Ratings gematcht."
          onLoad={setAutomaticCsv}
        />
        <textarea className="textarea" style={{ marginTop: 14, minHeight: 220 }} value={automaticCsv} onChange={(event) => setAutomaticCsv(event.target.value)} />
        {automaticPreview.error ? (
          <div className="notice error" style={{ marginTop: 12 }}>{automaticPreview.error}</div>
        ) : (
          <div className="automatic-preview-grid" style={{ marginTop: 12 }}>
            <div className="notice">
              <strong>{automaticPreview.rows.length}</strong>
              <span> Ranking-Zeilen</span>
            </div>
            <div className="notice success">
              <strong>{automaticPreview.mappedRows.length}</strong>
              <span> gemappte Survey-Methoden</span>
            </div>
            <div className="notice">
              <strong>{automaticPreview.unmappedRows.length}</strong>
              <span> weitere automatische Ansätze</span>
            </div>
            <div className={`notice ${automaticPreview.missingMethodKeys.length ? "error" : "success"}`}>
              <strong>{automaticPreview.missingMethodKeys.length}</strong>
              <span> Material-Methoden ohne Mapping</span>
            </div>
          </div>
        )}
        {automaticPreview.missingMethodKeys.length > 0 && (
          <p className="small muted" style={{ marginTop: 10 }}>
            Ohne Mapping: {automaticPreview.missingMethodKeys.join(", ")}
          </p>
        )}
        <button className="btn btn-primary" type="button" style={{ marginTop: 12 }} disabled={Boolean(automaticPreview.error) || automaticPreview.rows.length === 0} onClick={importAutomaticRankings}>
          <Upload size={16} /> Automatische Rankings importieren
        </button>
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
  const essayCountsByTopicGrade = data.topics.flatMap((topic) =>
    ["5", "9"].map((gradeLevel) => ({
      topic,
      gradeLevel,
      essayCount: data.essays.filter((essay) => essay.topicId === topic._id && essay.gradeLevel === gradeLevel).length
    }))
  );
  const incompleteEssayCount = data.essays.filter((essay) => (feedbacksByEssay.get(essay._id) || []).length !== 3).length;
  const canGenerateAssignments =
    data.topics.length === 3 &&
    data.groups.length === 6 &&
    data.essays.length > 0 &&
    incompleteEssayCount === 0 &&
    essayCountsByTopicGrade.every((item) => item.essayCount > 0) &&
    new Set(essayCountsByTopicGrade.map((item) => item.essayCount)).size === 1;

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
          Die App weist jeder Gruppe zufällig genau ein Thema und genau eine Klassenstufe zu. Gruppen erhalten nur Essays aus dieser Thema-Klassenstufe-Kombination.
        </p>
        <div className={`notice ${canGenerateAssignments ? "success" : "error"}`} style={{ marginTop: 16 }}>
          <strong>{canGenerateAssignments ? "Bereit für Randomisierung." : "Noch nicht bereit für Randomisierung."}</strong>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            <span>{data.topics.length} / 3 Themen importiert</span>
            <span>{data.groups.length} / 6 Gruppen importiert</span>
            <span>{data.essays.length} Essays importiert</span>
            <span>{incompleteEssayCount === 0 ? "Alle Essays haben 3 Feedbacktexte" : `${incompleteEssayCount} Essays haben nicht genau 3 Feedbacktexte`}</span>
            {essayCountsByTopicGrade.length > 0 && (
              <span>
                Essays pro Thema und Klasse:{" "}
                {essayCountsByTopicGrade.map(({ topic, gradeLevel, essayCount }) => `${topic.title} ${gradeLevel}: ${essayCount}`).join(", ")}
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
          <span className="tag">{data.topics.filter((topic) => promptImageSrc(topic.promptImageUrl)).length} / {data.topics.length} gesetzt</span>
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
                  <PromptImagePreview src={topic.promptImageUrl} title={topic.title} />
                </div>
                <div className="prompt-upload-copy">
                  <strong>{topic.title}</strong>
                  <span className="muted small">{promptImageSrc(topic.promptImageUrl) ? "Bild gespeichert" : "Noch kein Bild gespeichert"}</span>
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
                  {promptImageSrc(topic.promptImageUrl) && (
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
  const analytics = data.resultsAnalytics || {};
  const methodStats = analytics.methodStats || [];
  const questionStats = analytics.questionStats || [];
  const methodQuestionStats = analytics.methodQuestionStats || [];
  const essayMethodStats = analytics.essayMethodStats || [];
  const ratingDistributions = analytics.ratingDistributions || [];
  const methodComparisons = analytics.methodComparisons || data.methodComparisons || [];
  const automaticComparison = analytics.automaticRankingComparison || {};
  const automaticRows = automaticComparison.rows || [];
  const humanRankingComparison = analytics.humanRankingComparison || {};
  const humanOverallRows = humanRankingComparison.overallRows || [];
  const humanEssayRows = humanRankingComparison.essayRows || [];
  const methodKeys = methodStats.map((row) => row.methodKey);
  const methodQuestionByKey = new Map(methodQuestionStats.map((row) => [`${row.questionKey}:${row.methodKey}`, row]));
  const essayKeys = [...new Set(essayMethodStats.map((row) => row.essayKey))];
  const essayMethodByKey = new Map(essayMethodStats.map((row) => [`${row.essayKey}:${row.methodKey}`, row]));
  const maxDistributionCount = Math.max(1, ...ratingDistributions.flatMap((row) => row.counts.map((item) => item.count)));
  const automaticComparisonCsv = [
    csvLine([
      "methodKey",
      "displayName",
      "humanOverallHelpfulness",
      "humanRank",
      "humanCount",
      "autoApproachKey",
      "automaticCombinedRank",
      "automaticCombinedAbility",
      "automaticCombinedScore",
      "rankDelta",
      "gemmaRank",
      "llamaRank",
      "openaiRank"
    ]),
    ...automaticRows.map((row) =>
      csvLine([
        row.methodKey,
        row.displayName,
        row.humanMean,
        row.humanRank,
        row.humanCount,
        row.autoApproachKey,
        row.automaticCombinedRank,
        row.automaticCombinedAbility,
        row.automaticCombinedScore,
        row.rankDelta,
        row.gemmaRank,
        row.llamaRank,
        row.openaiRank
      ])
    )
  ].join("\n");
  const humanOverallRankingCsv = [
    csvLine([
      "methodKey",
      "humanBtRank",
      "humanBtAbility",
      "humanBtScore",
      "humanOverallHelpfulness",
      "humanComparisons",
      "humanWins",
      "humanLosses",
      "humanTies",
      "automaticSurveyRank",
      "automaticCombinedRank",
      "automaticCombinedAbility",
      "automaticCombinedScore",
      "rankDelta"
    ]),
    ...humanOverallRows.map((row) =>
      csvLine([
        row.methodKey,
        row.btRank,
        row.btAbility,
        row.btScore,
        row.mean,
        row.comparisons,
        row.wins,
        row.losses,
        row.ties,
        row.automaticSurveyRank,
        row.automaticCombinedRank,
        row.automaticCombinedAbility,
        row.automaticCombinedScore,
        row.rankDelta
      ])
    )
  ].join("\n");
  const humanEssayRankingCsv = [
    csvLine([
      "essayKey",
      "essayTitle",
      "topicKey",
      "scope",
      "participantCode",
      "participantPseudonym",
      "methodKey",
      "humanRank",
      "humanOverallHelpfulness",
      "humanBtAbility",
      "humanComparisons",
      "automaticSurveyRank",
      "automaticCombinedRank",
      "automaticCombinedAbility",
      "rankDelta"
    ]),
    ...humanEssayRows.flatMap((essay) => [
      ...essay.methodRows.map((row) =>
        csvLine([
          essay.essayKey,
          essay.essayTitle,
          essay.topicKey,
          "essay_aggregate",
          "",
          "",
          row.methodKey,
          row.btRank,
          row.mean,
          row.btAbility,
          row.comparisons,
          row.automaticSurveyRank,
          row.automaticCombinedRank,
          row.automaticCombinedAbility,
          row.rankDelta
        ])
      ),
      ...essay.annotatorRows.map((row) =>
        csvLine([
          essay.essayKey,
          essay.essayTitle,
          essay.topicKey,
          "annotator",
          row.participantCode,
          row.participantPseudonym,
          row.methodKey,
          row.humanRank,
          row.mean,
          "",
          "",
          row.automaticSurveyRank,
          row.automaticCombinedRank,
          row.automaticCombinedAbility,
          ""
        ])
      )
    ])
  ].join("\n");

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
          <h2 className="panel-title">Methodenprofil</h2>
          <span className="tag">{data.responseCount} Ratings</span>
        </div>
        {methodStats.length ? (
          <div className="table-wrap">
            <table className="table analysis-table">
              <thead>
                <tr>
                  <th>Methode</th>
                  <th className="numeric">Ø Score</th>
                  <th className="numeric">Median</th>
                  <th className="numeric">SD</th>
                  <th className="numeric">Bereich</th>
                  <th className="numeric">≥ 5</th>
                  <th className="numeric">≥ 6</th>
                  <th className="numeric">N</th>
                </tr>
              </thead>
              <tbody>
                {methodStats.map((row) => (
                  <tr key={row.methodKey}>
                    <td>
                      <strong>{row.methodKey}</strong>
                    </td>
                    <td>
                      <div className="score-cell">
                        <span className="numeric">{formatStat(row.mean)}</span>
                        <span className="score-track" aria-hidden="true">
                          <span className="score-fill" style={{ width: `${scorePercent(row.mean)}%` }} />
                        </span>
                      </div>
                    </td>
                    <td className="numeric">{formatStat(row.median)}</td>
                    <td className="numeric">{formatStat(row.standardDeviation)}</td>
                    <td className="numeric">
                      {formatStat(row.min, 0)}–{formatStat(row.max, 0)}
                    </td>
                    <td className="numeric">{formatPercent(row.favorablePercent)}</td>
                    <td className="numeric">{formatPercent(row.topBoxPercent)}</td>
                    <td className="numeric">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">Noch keine gespeicherten Ratings vorhanden.</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">Bradley-Terry Rankingvergleich</h2>
          <div className="button-row">
            <span className="tag">ρ {formatStat(humanRankingComparison.spearman)}</span>
            <button className="btn btn-secondary" type="button" onClick={() => downloadFile("human-automatic-bt-overall.csv", humanOverallRankingCsv)} disabled={!humanOverallRows.length}>
              <Download size={16} /> Overall exportieren
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => downloadFile("human-automatic-bt-by-essay.csv", humanEssayRankingCsv)} disabled={!humanEssayRows.length}>
              <Download size={16} /> Essays exportieren
            </button>
          </div>
        </div>
        <p className="muted">
          Human-Ranking: pro Annotator:in und Essay wird ausschließlich die letzte Frage zur Gesamt-Hilfreichkeit verwendet; daraus entstehen paarweise Siege/Ties und Bradley-Terry-Ability-Werte. Automatik: importierte Overall-Ränge aus der Automatic-Ranking-CSV.
        </p>
        {humanRankingComparison.note && <div className="notice" style={{ marginBottom: 14 }}>{humanRankingComparison.note}</div>}
        {humanOverallRows.length ? (
          <div className="table-wrap">
            <table className="table ranking-comparison-table">
              <thead>
                <tr>
                  <th>Methode</th>
                  <th className="numeric">Human BT Rang</th>
                  <th className="numeric">Human Ability</th>
                  <th className="numeric">Gesamt hilfreich</th>
                  <th className="numeric">Bilanz</th>
                  <th className="numeric">Auto Survey Rang</th>
                  <th className="numeric">Auto Global Rang</th>
                  <th className="numeric">Auto Ability</th>
                  <th className="numeric">Δ Rang</th>
                </tr>
              </thead>
              <tbody>
                {humanOverallRows.map((row) => (
                  <tr key={row.methodKey}>
                    <td>
                      <strong>{row.methodKey}</strong>
                      <div className="muted small">{row.autoApproachKey || "kein Auto-Mapping"}</div>
                    </td>
                    <td className="numeric">{row.btRank || "–"}</td>
                    <td className="numeric">{formatStat(row.btAbility, 3)}</td>
                    <td className="numeric">{formatStat(row.mean)}</td>
                    <td className="numeric">{row.wins} / {row.ties} / {row.losses}</td>
                    <td className="numeric">{row.automaticSurveyRank || "–"}</td>
                    <td className="numeric">{row.automaticCombinedRank || "–"}</td>
                    <td className="numeric">{formatStat(row.automaticCombinedAbility, 3)}</td>
                    <td className="numeric">{formatSignedInteger(row.rankDelta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">Noch keine vollständigen Human-Rankings vorhanden.</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">Ranking je Essay</h2>
          <span className="tag">{humanEssayRows.length} Essays</span>
        </div>
        {humanEssayRows.length ? (
          <div className="essay-ranking-list">
            {humanEssayRows.map((essay) => (
              <details className="essay-ranking-item" key={essay.essayKey}>
                <summary>
                  <span>
                    <strong>{essay.essayKey}</strong>
                    <span className="muted small"> {essay.topicKey || essay.essayTitle}</span>
                  </span>
                  <span className="tag">{essay.annotatorRows.length ? `${new Set(essay.annotatorRows.map((row) => row.participantCode)).size} Annotator:innen` : "keine Ratings"}</span>
                </summary>
                <div className="essay-ranking-content">
                  <div className="table-wrap">
                    <table className="table ranking-comparison-table">
                      <thead>
                        <tr>
                          <th>Methode</th>
                          <th className="numeric">Essay BT Rang</th>
                          <th className="numeric">Essay Ability</th>
                          <th className="numeric">Gesamt hilfreich</th>
                          <th className="numeric">Bilanz</th>
                          <th className="numeric">Auto Survey Rang</th>
                          <th className="numeric">Auto Ability</th>
                          <th className="numeric">Δ Rang</th>
                        </tr>
                      </thead>
                      <tbody>
                        {essay.methodRows.map((row) => (
                          <tr key={`${essay.essayKey}-${row.methodKey}`}>
                            <td><strong>{row.methodKey}</strong></td>
                            <td className="numeric">{row.btRank || "–"}</td>
                            <td className="numeric">{formatStat(row.btAbility, 3)}</td>
                            <td className="numeric">{formatStat(row.mean)}</td>
                            <td className="numeric">{row.wins} / {row.ties} / {row.losses}</td>
                            <td className="numeric">{row.automaticSurveyRank || "–"}</td>
                            <td className="numeric">{formatStat(row.automaticCombinedAbility, 3)}</td>
                            <td className="numeric">{formatSignedInteger(row.rankDelta)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="table-wrap" style={{ marginTop: 14 }}>
                    <table className="table annotator-ranking-table">
                      <thead>
                        <tr>
                          <th>Annotator:in</th>
                          <th>Methode</th>
                          <th className="numeric">Indiv. Rang</th>
                          <th className="numeric">Gesamt hilfreich</th>
                          <th className="numeric">Auto Survey Rang</th>
                        </tr>
                      </thead>
                      <tbody>
                        {essay.annotatorRows.map((row) => (
                          <tr key={`${essay.essayKey}-${row.participantCode}-${row.methodKey}`}>
                            <td>
                              <strong>{row.participantPseudonym}</strong>
                              <div className="muted small">{row.participantCode}</div>
                            </td>
                            <td>{row.methodKey}</td>
                            <td className="numeric">{row.humanRank}</td>
                            <td className="numeric">{formatStat(row.mean)}</td>
                            <td className="numeric">{row.automaticSurveyRank || "–"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="empty-state">Noch keine Essay-Rankings vorhanden.</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">Automatik vs. Human</h2>
          <div className="button-row">
            <span className="tag">ρ {formatStat(automaticComparison.spearman)}</span>
            <button className="btn btn-secondary" type="button" onClick={() => downloadFile("automatic-human-comparison.csv", automaticComparisonCsv)} disabled={!automaticRows.length}>
              <Download size={16} /> Vergleich exportieren
            </button>
          </div>
        </div>
        {automaticRows.length ? (
          <>
            <div className="automatic-summary">
              <span>{automaticComparison.mappedCount || 0} gemappte Survey-Methoden</span>
              <span>{automaticComparison.totalAutomaticRows || 0} automatische Ranking-Zeilen</span>
              <span>{automaticComparison.unmappedAutomaticApproaches?.length || 0} nicht gemappte Ansätze</span>
            </div>
            {automaticComparison.missingSurveyMethodKeys?.length > 0 && (
              <div className="notice error" style={{ marginBottom: 14 }}>
                Ohne automatisches Ranking: {automaticComparison.missingSurveyMethodKeys.join(", ")}
              </div>
            )}
            <div className="table-wrap">
              <table className="table automatic-comparison-table">
                <thead>
                  <tr>
                    <th>Methode</th>
                    <th className="numeric">Gesamt hilfreich</th>
                    <th className="numeric">Human Rang</th>
                    <th className="numeric">Auto Rang</th>
                    <th className="numeric">Δ Rang</th>
                    <th className="numeric">Auto Ability</th>
                    <th className="numeric">Gemma</th>
                    <th className="numeric">Llama</th>
                    <th className="numeric">OpenAI</th>
                  </tr>
                </thead>
                <tbody>
                  {automaticRows.map((row) => (
                    <tr key={row.methodKey}>
                      <td>
                        <strong>{row.methodKey}</strong>
                        <div className="muted small">{row.autoApproachKey || "kein Mapping"}</div>
                      </td>
                      <td className="numeric">{formatStat(row.humanMean)}</td>
                      <td className="numeric">{row.humanRank || "–"}</td>
                      <td className="numeric">{row.automaticCombinedRank || "–"}</td>
                      <td className="numeric">{formatSignedInteger(row.rankDelta)}</td>
                      <td className="numeric">{formatStat(row.automaticCombinedAbility, 3)}</td>
                      <td className="numeric">{row.gemmaRank || "–"}</td>
                      <td className="numeric">{row.llamaRank || "–"}</td>
                      <td className="numeric">{row.openaiRank || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="empty-state">Noch keine automatischen Rankings importiert oder noch keine Human-Ratings vorhanden.</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">Likert-Verteilung</h2>
        </div>
        {ratingDistributions.length ? (
          <div className="distribution-list">
            {ratingDistributions.map((row) => (
              <div className="distribution-row" key={row.methodKey}>
                <div>
                  <strong>{row.methodKey}</strong>
                  <span className="muted small"> Ø {formatStat(row.mean)} · N {row.count}</span>
                </div>
                <div className="distribution-bars" aria-label={`Likert-Verteilung ${row.methodKey}`}>
                  {row.counts.map((item) => (
                    <div className="distribution-bar" key={item.value}>
                      <span className="distribution-label">{item.value}</span>
                      <span className="distribution-track">
                        <span
                          className="distribution-fill"
                          style={{ width: `${Math.max(4, (item.count / maxDistributionCount) * 100)}%` }}
                        />
                      </span>
                      <span className="distribution-count">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">Noch keine Verteilungsdaten vorhanden.</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">Kriterien × Methoden</h2>
        </div>
        {questionStats.length && methodKeys.length ? (
          <div className="table-wrap">
            <table className="table heat-table">
              <thead>
                <tr>
                  <th>Kriterium</th>
                  {methodKeys.map((methodKey) => (
                    <th className="numeric" key={methodKey}>{methodKey}</th>
                  ))}
                  <th className="numeric">Gesamt Ø</th>
                </tr>
              </thead>
              <tbody>
                {questionStats.map((question) => (
                  <tr key={question.questionKey}>
                    <td>
                      <strong>{question.questionKey}</strong>
                    </td>
                    {methodKeys.map((methodKey) => {
                      const row = methodQuestionByKey.get(`${question.questionKey}:${methodKey}`);
                      return (
                        <td className="numeric" key={methodKey}>
                          <span className="heat-cell" style={{ "--level": heatLevel(row?.mean || null) }}>
                            {formatStat(row?.mean)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="numeric">{formatStat(question.mean)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">Noch keine Kriterienauswertung vorhanden.</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">Methodenvergleich</h2>
        </div>
        <p className="muted">
          Gepaart nach Teilnehmer:in, Essay und Kriterium. Positive Differenzen sprechen für die linke Methode.
        </p>
        {methodComparisons.length ? (
          <div className="table-wrap">
            <table className="table comparison-table">
              <thead>
                <tr>
                  <th>Kriterium</th>
                  <th>Vergleich</th>
                  <th>Besser</th>
                  <th className="numeric">Ø Δ links</th>
                  <th className="numeric">Bilanz links</th>
                  <th className="numeric">N</th>
                </tr>
              </thead>
              <tbody>
                {methodComparisons.map((row, index) => {
                  const isTie = row.winner === "Gleichstand";
                  return (
                    <tr key={`${row.scopeKey}-${row.methodA}-${row.methodB}-${index}`}>
                      <td>
                        <span className={row.scopeKey === "all" ? "tag" : ""}>{row.scopeLabel}</span>
                      </td>
                      <td>
                        <strong>{row.methodA}</strong>
                        <span className="muted"> vs. </span>
                        <strong>{row.methodB}</strong>
                      </td>
                      <td>
                        <span className={`status-pill ${isTie ? "warn" : "good"}`}>{row.winner}</span>
                      </td>
                      <td className="numeric">{formatSignedDelta(row.meanDelta)}</td>
                      <td className="numeric">
                        {row.winsA} / {row.ties} / {row.winsB}
                      </td>
                      <td className="numeric">{row.pairedCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">Noch keine gepaarten Methodenbewertungen vorhanden.</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">Essays × Methoden</h2>
        </div>
        {essayKeys.length && methodKeys.length ? (
          <div className="table-wrap">
            <table className="table heat-table">
              <thead>
                <tr>
                  <th>Essay</th>
                  {methodKeys.map((methodKey) => (
                    <th className="numeric" key={methodKey}>{methodKey}</th>
                  ))}
                  <th>Beste Methode</th>
                </tr>
              </thead>
              <tbody>
                {essayKeys.map((essayKey) => {
                  const rows = methodKeys.map((methodKey) => essayMethodByKey.get(`${essayKey}:${methodKey}`)).filter(Boolean);
                  const best = [...rows].sort((a, b) => (b.mean || 0) - (a.mean || 0))[0];
                  return (
                    <tr key={essayKey}>
                      <td>
                        <strong>{essayKey}</strong>
                        <span className="muted small"> {rows[0]?.topicKey || ""}</span>
                      </td>
                      {methodKeys.map((methodKey) => {
                        const row = essayMethodByKey.get(`${essayKey}:${methodKey}`);
                        return (
                          <td className="numeric" key={methodKey}>
                            <span className="heat-cell" style={{ "--level": heatLevel(row?.mean || null) }}>
                              {formatStat(row?.mean)}
                            </span>
                          </td>
                        );
                      })}
                      <td>
                        {best ? <span className="status-pill good">{best.methodKey}</span> : <span className="muted">–</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">Noch keine Essayauswertung vorhanden.</div>
        )}
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

function CorrectionSection({ password, data, updateResponse }) {
  const [participantFilter, setParticipantFilter] = useState("all");
  const [questionFilter, setQuestionFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [pendingResponse, setPendingResponse] = useState("");
  const [pendingValue, setPendingValue] = useState(null);
  const [message, setMessage] = useState("");
  const rows = data.editableResponses || [];
  const participantOptions = data.participants
    .filter((participant) => rows.some((row) => row.participantId === participant._id))
    .sort((a, b) => a.code.localeCompare(b.code));
  const questionOptions = [...new Map(rows.map((row) => [row.questionId, row])).values()].sort((a, b) => a.questionOrder - b.questionOrder);
  const methodOptions = [...new Set(rows.map((row) => row.methodKey))].sort((a, b) => a.localeCompare(b));
  const normalizedSearch = search.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (participantFilter !== "all" && row.participantId !== participantFilter) return false;
    if (questionFilter !== "all" && row.questionId !== questionFilter) return false;
    if (methodFilter !== "all" && row.methodKey !== methodFilter) return false;
    if (!normalizedSearch) return true;
    return [row.participantPseudonym, row.participantCode, row.groupKey, row.topicTitle, row.essayKey, row.essayTitle, row.methodKey, row.questionKey]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });

  async function setValue(row, value) {
    if (row.value === value || pendingResponse) return;
    setMessage("");
    setPendingResponse(row.responseId);
    setPendingValue(value);
    try {
      await updateResponse({ adminPassword: password, responseId: row.responseId, value });
      setMessage(`Bewertung für ${row.participantCode} wurde auf ${value} gesetzt.`);
    } finally {
      setPendingResponse("");
      setPendingValue(null);
    }
  }

  return (
    <div className="content-grid">
      {message && <div className="notice success">{message}</div>}
      <section className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">
            <PencilLine size={19} /> Bewertungen korrigieren
          </h2>
          <span className="tag">{filteredRows.length} / {rows.length} Ratings</span>
        </div>
        <p className="muted">
          Änderungen werden direkt in den gespeicherten Antworten übernommen und danach in Export und Auswertung neu berechnet.
        </p>
        <div className="result-filter-grid">
          <label className="field-label">
            Teilnehmer:in
            <select className="select" value={participantFilter} onChange={(event) => setParticipantFilter(event.target.value)}>
              <option value="all">Alle</option>
              {participantOptions.map((participant) => (
                <option key={participant._id} value={participant._id}>
                  {participant.code} · {participant.pseudonym}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Kriterium
            <select className="select" value={questionFilter} onChange={(event) => setQuestionFilter(event.target.value)}>
              <option value="all">Alle</option>
              {questionOptions.map((question) => (
                <option key={question.questionId} value={question.questionId}>{question.questionKey}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Methode
            <select className="select" value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}>
              <option value="all">Alle</option>
              {methodOptions.map((methodKey) => (
                <option key={methodKey} value={methodKey}>{methodKey}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Suche
            <span className="search-field">
              <Search size={16} />
              <input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Code, Essay, Thema…" />
            </span>
          </label>
        </div>
      </section>

      <section className="panel">
        {filteredRows.length ? (
          <div className="table-wrap">
            <table className="table editable-results-table">
              <thead>
                <tr>
                  <th>Teilnehmer:in</th>
                  <th>Essay</th>
                  <th>Methode</th>
                  <th>Kriterium</th>
                  <th>Wert</th>
                  <th>Aktualisiert</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.responseId}>
                    <td>
                      <strong>{row.participantPseudonym}</strong>
                      <div className="muted small">
                        {row.participantCode}{row.groupKey ? ` · Gruppe ${row.groupKey}` : ""} · {row.participantStatus}
                      </div>
                    </td>
                    <td>
                      <strong>{row.essayKey}</strong>
                      <div className="muted small">{row.topicTitle || row.essayTitle}</div>
                    </td>
                    <td>
                      <span className="tag">{row.methodKey}</span>
                    </td>
                    <td>
                      <strong>{row.questionKey}</strong>
                      <div className="muted small">{row.questionText}</div>
                    </td>
                    <td>
                      <div className="rating-edit-control" role="group" aria-label={`Bewertung ${row.questionKey} ändern`}>
                        {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                          <button
                            className={row.value === value ? "selected" : ""}
                            type="button"
                            key={value}
                            disabled={Boolean(pendingResponse)}
                            onClick={() => setValue(row, value)}
                            title={row.questionLabels?.[value - 1] || `Wert ${value}`}
                          >
                            {pendingResponse === row.responseId && pendingValue === value ? <Loader2 size={13} /> : value}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="numeric">{formatDateTime(row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">Keine Bewertungen für diese Filter vorhanden.</div>
        )}
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
    importAutomaticRankings: useMutation(api.study.importAutomaticRankings),
    syncFixedQuestions: useMutation(api.study.syncFixedQuestions),
    generateAssignments: useMutation(api.study.generateAssignments),
    setStudyStatus: useMutation(api.study.setStudyStatus),
    updateFeedbackOrder: useMutation(api.study.updateFeedbackOrder),
    generatePromptImageUploadUrl: useMutation(api.study.generatePromptImageUploadUrl),
    saveTopicPromptImage: useMutation(api.study.saveTopicPromptImage),
    clearTopicPromptImage: useMutation(api.study.clearTopicPromptImage),
    reopenParticipant: useMutation(api.study.reopenParticipant),
    updateResponse: useMutation(api.study.updateResponse),
    resetStudy: useMutation(api.study.resetStudy)
  };

  const refresh = useCallback(
    async (adminPassword = password) => {
      if (!adminPassword) return;
      setActionError("");
      try {
        let [nextDashboard, nextExportCsv] = await Promise.all([
          convex.query(api.study.dashboard, { adminPassword }),
          convex.query(api.study.exportResponsesCsv, { adminPassword })
        ]);
        if (nextDashboard.responseCount === 0) {
          await convex.mutation(api.study.syncFixedQuestions, { adminPassword });
          [nextDashboard, nextExportCsv] = await Promise.all([
            convex.query(api.study.dashboard, { adminPassword }),
            convex.query(api.study.exportResponsesCsv, { adminPassword })
          ]);
        }
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
      importAutomaticRankings: wrap(rawActions.importAutomaticRankings),
      syncFixedQuestions: wrap(rawActions.syncFixedQuestions),
      generateAssignments: wrap(rawActions.generateAssignments),
      setStudyStatus: wrap(rawActions.setStudyStatus),
      updateFeedbackOrder: wrap(rawActions.updateFeedbackOrder),
      generatePromptImageUploadUrl: wrap(rawActions.generatePromptImageUploadUrl),
      saveTopicPromptImage: wrap(rawActions.saveTopicPromptImage),
      clearTopicPromptImage: wrap(rawActions.clearTopicPromptImage),
      reopenParticipant: wrap(rawActions.reopenParticipant),
      updateResponse: wrap(rawActions.updateResponse),
      resetStudy: wrap(rawActions.resetStudy)
    };
  }, [
    rawActions.clearTopicPromptImage,
    rawActions.generateAssignments,
    rawActions.generatePromptImageUploadUrl,
    rawActions.importAutomaticRankings,
    rawActions.importMaterials,
    rawActions.importParticipantGroups,
    rawActions.reopenParticipant,
    rawActions.resetStudy,
    rawActions.saveTopicPromptImage,
    rawActions.setStudyStatus,
    rawActions.syncFixedQuestions,
    rawActions.updateResponse,
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
      {section === "import" && <ImportSection password={password} data={dashboard} actions={actions} />}
      {section === "materials" && <MaterialsSection password={password} data={dashboard} actions={actions} />}
      {section === "links" && <LinksSection data={dashboard} />}
      {section === "results" && <ResultsSection password={password} data={dashboard} exportCsv={exportCsv} reopenParticipant={actions.reopenParticipant} />}
      {section === "corrections" && <CorrectionSection password={password} data={dashboard} updateResponse={actions.updateResponse} />}
      {section === "settings" && <SettingsSection password={password} data={dashboard} actions={actions} />}
    </Shell>
  );
}
