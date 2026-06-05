"use client";

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { BookOpen, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardCheck, ListChecks, Loader2, Menu, MessageSquareText, UserRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

function responseKey(essayId, feedbackId, questionId) {
  return `${essayId}:${feedbackId}:${questionId}`;
}

const criteria = [
  {
    key: "verstaendlichkeit",
    title: "Verständlichkeit",
    text: "Ist das Feedback sprachlich klar und leicht nachzuvollziehen?",
    strongLabel: "Sehr verständlich",
    strongExample: "Die Sätze sind klar formuliert, nutzen passende Wörter und erklären genau, was gemeint ist.",
    weakLabel: "Unverständlich",
    weakExample: "Das Feedback nutzt unklare Begriffe oder verschachtelte Sätze, sodass nicht klar wird, was gemeint ist."
  },
  {
    key: "spezifitaet",
    title: "Spezifität",
    text: "Bezieht sich das Feedback konkret auf genau diesen Essay?",
    strongLabel: "Sehr spezifisch",
    strongExample: "In deiner Einleitung nennst du den zweiten Vorschlag, erklärst aber noch nicht, warum er besser ist.",
    weakLabel: "Zu allgemein",
    weakExample: "Schreibe eine bessere Einleitung."
  },
  {
    key: "handlungsorientierung",
    title: "Handlungsorientierung",
    text: "Wird klar, was als Nächstes geändert oder ergänzt werden kann?",
    strongLabel: "Gut umsetzbar",
    strongExample: "Ergänze nach deinem ersten Argument ein Beispiel, wie die Sitzgelegenheiten in der Pause genutzt werden könnten.",
    weakLabel: "Zu vage",
    weakExample: "Mache deine Argumente stärker."
  },
  {
    key: "priorisierung",
    title: "Priorisierung",
    text: "Macht das Feedback deutlich, was zuerst und gegebenenfalls danach gemacht werden soll?",
    strongLabel: "Gut priorisiert",
    strongExample: "Beginne damit, deine Position klarer zu machen. Danach kannst du einzelne Formulierungen verbessern.",
    weakLabel: "Nicht priorisiert",
    weakExample: "Hier sind zehn Dinge, die du alle verbessern solltest."
  },
  {
    key: "bewaeltigbarkeit",
    title: "Bewältigbarkeit",
    text: "Ist das Feedback für die angegebene Klassenstufe gut zu bewältigen?",
    strongLabel: "Gut bewältigbar",
    strongExample: "Wenige klare Hinweise in einfacher Sprache, die zur Klassenstufe passen.",
    weakLabel: "Überfordernd",
    weakExample: "Viele lange Hinweise mit schwierigen Fachwörtern und zu vielen Aufgaben auf einmal."
  },
  {
    key: "gesamt_hilfreich",
    title: "Gesamt",
    text: "Wie sehr hilft das Feedback insgesamt bei der Überarbeitung?",
    strongLabel: "Sehr hilfreich",
    strongExample: "Nach dem Lesen weißt du, was du ändern solltest, warum es wichtig ist und wie du anfangen kannst.",
    weakLabel: "Wenig hilfreich",
    weakExample: "Das Feedback klingt nett, hilft dir aber kaum dabei, den Essay konkret zu verbessern."
  }
];

const introSteps = [
  "Willkommen",
  "Deine Rolle",
  "Ablauf",
  "Kriterien",
  "Angaben"
];

function gradeLabelFromEssay(essay) {
  const grade = String(essay?.gradeLevel || "").trim().toLowerCase();
  if (grade === "5") return "5. Klasse";
  if (grade === "9") return "9. Klasse";
  return "Klassenstufe nicht importiert";
}

function formatQuestionText(text, gradeLabel) {
  return String(text || "").replaceAll("{grade}", gradeLabel);
}

function criterionTitleForQuestion(question) {
  const keyAliases = {
    nicht_ueberfordernd: "bewaeltigbarkeit",
    ueberforderung: "bewaeltigbarkeit"
  };
  const key = keyAliases[question.key] || question.key;
  return criteria.find((item) => item.key === key)?.title || "Kriterium";
}

function CriteriaList({ compact = false, detailed = false }) {
  return (
    <div className={`criteria-panel ${compact ? "compact" : ""} ${detailed ? "detailed" : ""}`}>
      {!detailed && (
        <div className="criteria-panel-head">
          <ListChecks size={18} aria-hidden="true" />
          <strong>Bewertungskriterien</strong>
        </div>
      )}
      <div className={detailed ? "criteria-guide-list" : "criteria-list"}>
        {criteria.map((item) => (
          <div className={detailed ? "criteria-guide-item" : "criteria-item"} key={item.key}>
            <strong>{item.title}</strong>
            <span>{item.text}</span>
            {detailed && (
              <div className="criteria-examples">
                <p className="example-positive">
                  <span>{item.strongLabel}:</span> {item.strongExample}
                </p>
                <p className="example-negative">
                  <span>{item.weakLabel}:</span> {item.weakExample}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function IntroProgress({ current, onStepClick }) {
  return (
    <div className="intro-progress" aria-label="Einführungsschritte">
      {introSteps.map((step, index) => {
        const isDone = index < current;
        const isActive = index === current;
        const content = (
          <>
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </>
        );
        const className = `intro-progress-step ${isActive ? "active" : ""} ${isDone ? "done" : ""}`;
        if (isDone) {
          return (
            <button className={className} type="button" key={step} onClick={() => onStepClick(index)}>
              {content}
            </button>
          );
        }
        return (
          <div className={className} key={step} aria-current={isActive ? "step" : undefined}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function PromptContext({ topic }) {
  return (
    <div className="prompt-context">
      {topic?.promptImageUrl && (
        <div className="prompt-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={topic.promptImageUrl} alt={`Bild zum Schreibauftrag ${topic.title}`} />
        </div>
      )}
      <div className="context-text">{topic?.prompt || "Kein Schreibauftrag vorhanden."}</div>
    </div>
  );
}

function ContextDisclosure({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = open ? ChevronDown : ChevronLeft;
  return (
    <div className="context-accordion">
      <button className="context-summary" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>{title}</span>
        <Icon size={18} aria-hidden="true" />
      </button>
      {open && <div className="context-accordion-content">{children}</div>}
    </div>
  );
}

function CompletionScreen({ title = "Vielen Dank.", text = "Deine Antworten wurden vollständig gespeichert." }) {
  return (
    <main className="auth-wrap">
      <section className="auth-card" style={{ textAlign: "center" }}>
        <div className="icon-tile" style={{ margin: "0 auto 18px" }}>
          <CheckCircle2 size={28} />
        </div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{text}</p>
      </section>
    </main>
  );
}

function BlockedScreen({ kind }) {
  const copy = {
    missing: ["Link nicht gefunden", "Dieser persönliche Link ist unbekannt."],
    draft: ["Noch nicht verfügbar", "Die Studie ist noch im Entwurf. Bitte versuche es später erneut."],
    closed: ["Studie geschlossen", "Diese Studie nimmt keine weiteren Antworten mehr an."]
  }[kind] || ["Nicht verfügbar", "Diese Umfrage kann gerade nicht geöffnet werden."];
  return <CompletionScreen title={copy[0]} text={copy[1]} />;
}

export default function ParticipantSurvey({ token }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const survey = useQuery(api.study.participantSurvey, { token });
  const startParticipant = useMutation(api.study.startParticipant);
  const saveDemographics = useMutation(api.study.saveDemographics);
  const saveResponse = useMutation(api.study.saveResponse);
  const completeParticipant = useMutation(api.study.completeParticipant);
  const [activeEssay, setActiveEssay] = useState(0);
  const [activeFeedback, setActiveFeedback] = useState(0);
  const [activeMode, setActiveMode] = useState("essay");
  const [introVisible, setIntroVisible] = useState(true);
  const [introStep, setIntroStep] = useState(0);
  const [promptRead, setPromptRead] = useState(false);
  const [essayReadIds, setEssayReadIds] = useState(() => new Set());
  const [criteriaHelpOpen, setCriteriaHelpOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [age, setAge] = useState("");
  const [germanProficiency, setGermanProficiency] = useState("");
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const initialVisibilityResolved = useRef(false);

  useEffect(() => {
    if (survey?.kind === "survey") {
      setAge(survey.participant.age || "");
      setGermanProficiency(survey.participant.germanProficiency || "");
    }
  }, [survey?.kind, survey?.participant?._id, survey?.participant?.age, survey?.participant?.germanProficiency]);

  useEffect(() => {
    if (survey?.kind === "survey") {
      const step = searchParams.get("step");
      const introParam = Number.parseInt(searchParams.get("intro") || "", 10);
      const essayParam = Number.parseInt(searchParams.get("essay") || "", 10);
      const feedbackParam = Number.parseInt(searchParams.get("feedback") || "", 10);
      const introIndex = introParam - 1;
      const essayIndex = essayParam - 1;
      const feedbackIndex = feedbackParam - 1;

      if (step === "intro") {
        setIntroVisible(true);
        setIntroStep(Number.isInteger(introIndex) && introIndex >= 0 && introIndex < introSteps.length ? introIndex : 0);
        initialVisibilityResolved.current = true;
        return;
      }

      if (step === "prompt") {
        setActiveEssay(0);
        setActiveFeedback(0);
        setActiveMode("prompt");
        setIntroVisible(false);
        initialVisibilityResolved.current = true;
        return;
      }

      if (
        step === "essay" &&
        Number.isInteger(essayIndex) &&
        essayIndex >= 0 &&
        essayIndex < survey.essays.length
      ) {
        setActiveEssay(essayIndex);
        setActiveFeedback(0);
        setActiveMode("essay");
        setPromptRead(true);
        setIntroVisible(false);
        initialVisibilityResolved.current = true;
        return;
      }

      if (
        Number.isInteger(essayIndex) &&
        Number.isInteger(feedbackIndex) &&
        essayIndex >= 0 &&
        essayIndex < survey.essays.length &&
        feedbackIndex >= 0 &&
        feedbackIndex < (survey.essays[essayIndex]?.feedbacks.length || 0)
      ) {
        setActiveEssay(essayIndex);
        setActiveFeedback(feedbackIndex);
        setActiveMode("feedback");
        setPromptRead(true);
        const essayId = survey.essays[essayIndex]?._id;
        if (essayId) {
          setEssayReadIds((previous) => {
            if (previous.has(essayId)) return previous;
            const next = new Set(previous);
            next.add(essayId);
            return next;
          });
        }
        setIntroVisible(false);
        initialVisibilityResolved.current = true;
        return;
      }

      if (!initialVisibilityResolved.current) {
        initialVisibilityResolved.current = true;
        const showIntro = !(survey.participant.startedAt && survey.participant.age && survey.participant.germanProficiency);
        setIntroVisible(showIntro);
        if (!showIntro) {
          setActiveMode("prompt");
        }
      }
    }
  }, [searchParams, survey]);

  const responseMap = useMemo(() => {
    const map = new Map();
    if (survey?.kind !== "survey") return map;
    for (const response of survey.responses) {
      map.set(responseKey(response.essayId, response.feedbackId, response.questionId), response.value);
    }
    return map;
  }, [survey]);

  if (survey === undefined) {
    return (
      <main className="auth-wrap">
        <div className="auth-card">
          <Loader2 size={18} /> Lädt Umfrage…
        </div>
      </main>
    );
  }

  if (survey.kind === "completed") {
    return <CompletionScreen title="Bereits abgeschlossen" text="Deine Bewertungen sind vollständig gespeichert. Vielen Dank für deine Teilnahme." />;
  }
  if (survey.kind !== "survey") return <BlockedScreen kind={survey.kind} />;

  const essays = survey.essays;
  const essay = essays[activeEssay];
  const feedback = essay?.feedbacks[activeFeedback];
  const gradeLabel = gradeLabelFromEssay(essay);
  const totalTasks = essays.reduce((sum, item) => sum + item.feedbacks.length, 0);
  const currentTaskNumber = essays.slice(0, activeEssay).reduce((sum, item) => sum + item.feedbacks.length, 0) + activeFeedback + 1;
  const required = survey.completion.required;
  const answered = survey.responses.length;
  const demographicsComplete = Boolean(age && germanProficiency);
  const canComplete = demographicsComplete && required > 0 && answered >= required;
  const alreadyStarted = Boolean(survey.participant.startedAt);
  const isLastTask = activeEssay === essays.length - 1 && activeFeedback === essay.feedbacks.length - 1;
  const promptDone = promptRead || activeMode === "essay" || activeMode === "feedback";

  function scrollToSurveyTop() {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function markEssayRead(essayIndex) {
    const essayId = essays[essayIndex]?._id;
    if (!essayId) return;
    setEssayReadIds((previous) => {
      if (previous.has(essayId)) return previous;
      const next = new Set(previous);
      next.add(essayId);
      return next;
    });
  }

  function navigateToIntro(stepIndex = 0) {
    setIntroVisible(true);
    setIntroStep(stepIndex);
    setNavOpen(false);
    router.push(`/s/${token}?step=intro&intro=${stepIndex + 1}`, { scroll: false });
    scrollToSurveyTop();
  }

  function navigateToPrompt() {
    setActiveEssay(0);
    setActiveFeedback(0);
    setActiveMode("prompt");
    setIntroVisible(false);
    setNavOpen(false);
    router.push(`/s/${token}?step=prompt`, { scroll: false });
    scrollToSurveyTop();
  }

  function navigateToEssayIntro(essayIndex) {
    setActiveEssay(essayIndex);
    setActiveFeedback(0);
    setActiveMode("essay");
    setPromptRead(true);
    setIntroVisible(false);
    setNavOpen(false);
    router.push(`/s/${token}?step=essay&essay=${essayIndex + 1}`, { scroll: false });
    scrollToSurveyTop();
  }

  function navigateToTask(essayIndex, feedbackIndex) {
    setActiveEssay(essayIndex);
    setActiveFeedback(feedbackIndex);
    setActiveMode("feedback");
    setPromptRead(true);
    markEssayRead(essayIndex);
    setIntroVisible(false);
    setNavOpen(false);
    router.push(`/s/${token}?essay=${essayIndex + 1}&feedback=${feedbackIndex + 1}`, { scroll: false });
    scrollToSurveyTop();
  }

  async function persistDemographics(nextAge = age, nextGerman = germanProficiency) {
    setSaving("Demografie gespeichert");
    await saveDemographics({ token, age: nextAge, germanProficiency: nextGerman });
    window.setTimeout(() => setSaving(""), 1100);
  }

  async function beginSurvey() {
    setError("");
    if (!demographicsComplete) {
      setError("Bitte Alter und Deutschkenntnisse ausfüllen.");
      return;
    }
    await persistDemographics(age, germanProficiency);
    await startParticipant({ token });
    navigateToPrompt();
  }

  function nextIntroStep() {
    setError("");
    setIntroStep((step) => Math.min(step + 1, introSteps.length - 1));
    scrollToSurveyTop();
  }

  function previousIntroStep() {
    setError("");
    setIntroStep((step) => Math.max(step - 1, 0));
    scrollToSurveyTop();
  }

  async function choose(questionId, value) {
    setSaving("Antwort gespeichert");
    await saveResponse({ token, essayId: essay._id, feedbackId: feedback._id, questionId, value });
    window.setTimeout(() => setSaving(""), 900);
  }

  function nextTask() {
    if (activeFeedback + 1 < essay.feedbacks.length) {
      navigateToTask(activeEssay, activeFeedback + 1);
      return;
    }
    if (activeEssay + 1 < essays.length) {
      navigateToEssayIntro(activeEssay + 1);
    }
  }

  function previousTask() {
    if (activeFeedback > 0) {
      navigateToTask(activeEssay, activeFeedback - 1);
      return;
    }
    navigateToEssayIntro(activeEssay);
  }

  function previousFromEssayIntro() {
    if (activeEssay === 0) {
      navigateToPrompt();
      return;
    }
    const previousEssay = essays[activeEssay - 1];
    navigateToTask(activeEssay - 1, previousEssay.feedbacks.length - 1);
  }

  async function finish() {
    setError("");
    try {
      await completeParticipant({ token });
    } catch (err) {
      setError(err.message || "Abschluss nicht möglich.");
    }
  }

  if (introVisible) {
    return (
      <main className="participant-shell">
        <section className="participant-intro">
          <div className="brand" style={{ marginBottom: 22 }}>
            <div className="brand-mark">
              <MessageSquareText size={17} />
            </div>
            <span>
              Survey<span>Annotate</span>
            </span>
          </div>
          <IntroProgress current={introStep} onStepClick={navigateToIntro} />

          <div className="intro-step-content">
            {introStep === 0 && (
              <>
                <p className="eyebrow">Essay-Feedback-Studie</p>
                <h1 className="page-title">Willkommen</h1>
                <p className="page-subtitle">
                  In dieser Studie bewertest du Feedbacktexte zu Schüleressays. Du beurteilst, wie hilfreich ein Feedback für die Überarbeitung wäre.
                </p>
              </>
            )}

            {introStep === 1 && (
              <>
                <p className="eyebrow">Deine Rolle</p>
                <h1 className="page-title">Stell dir die Perspektive der Schüler:innen vor</h1>
                <p className="page-subtitle">
                  Bei jedem Essay steht, ob der Text von einer Person aus der 5. oder 9. Klasse stammt. Bewerte das Feedback so, als wärst du selbst Schüler:in dieser Klassenstufe.
                </p>
              </>
            )}

            {introStep === 2 && (
              <>
                <p className="eyebrow">Ablauf</p>
                <h1 className="page-title">Ein Schreibauftrag, mehrere Essays, mehrere Feedbacktexte</h1>
                <p className="page-subtitle">
                  Alle Essays gehören zu einem Schreibauftrag. Du liest mehrere Schüleressays zu dieser Aufgabe. Zu jedem Essay bekommst du mehrere Feedbacktexte, die du einzeln bewertest.
                </p>
                <div className="intro-flow-list">
                  <div>
                    <strong>1. Schreibauftrag einmal lesen</strong>
                    <span>Du liest, welche Aufgabe die Schüler:innen bekommen haben. Dieser Auftrag bleibt der Kontext für alle Essays.</span>
                  </div>
                  <div>
                    <strong>2. Essay lesen</strong>
                    <span>Du liest nacheinander mehrere Essays, die zu diesem Schreibauftrag geschrieben wurden.</span>
                  </div>
                  <div>
                    <strong>3. Feedbacktexte zu diesem Essay bewerten</strong>
                    <span>Zu jedem Essay liest du mehrere Feedbackversionen. Jede Version wird separat bewertet.</span>
                  </div>
                  <div>
                    <strong>4. Sechs Kriterien</strong>
                    <span>Für jeden Feedbacktext beantwortest du dieselben sechs Fragen auf einer Skala von 1 bis 7.</span>
                  </div>
                </div>
              </>
            )}

            {introStep === 3 && (
              <>
                <p className="eyebrow">Kriterien</p>
                <h1 className="page-title">Woran du jedes Feedback bewertest</h1>
                <p className="page-subtitle">
                  Nutze diese sechs Kriterien für jedes Feedback. Die Beispiele zeigen jeweils zwei mögliche Ausprägungen.
                </p>
                <CriteriaList detailed />
              </>
            )}

            {introStep === 4 && (
              <>
                <p className="eyebrow">Angaben</p>
                <h1 className="page-title">Kurze Angaben</h1>
                <p className="page-subtitle">
                  Bitte fülle diese Angaben aus. Danach siehst du den Schreibauftrag, bevor der erste Essay beginnt.
                </p>
                <div className="intro-form">
                  <h2 className="panel-title">
                    <UserRound size={18} /> Angaben
                  </h2>
                  <div className="form-grid" style={{ marginTop: 18 }}>
                    <label className="field-label">
                      Alter
                      <input
                        className="field"
                        value={age}
                        inputMode="numeric"
                        onChange={(event) => setAge(event.target.value)}
                        onBlur={() => persistDemographics()}
                        placeholder="z. B. 24"
                      />
                    </label>
                    <label className="field-label">
                      Deutschkenntnisse
                      <select
                        className="select"
                        value={germanProficiency}
                        onChange={(event) => {
                          setGermanProficiency(event.target.value);
                          persistDemographics(age, event.target.value);
                        }}
                      >
                        <option value="">Bitte auswählen</option>
                        <option value="Muttersprache">Muttersprache</option>
                        <option value="C2">C2</option>
                        <option value="C1">C1</option>
                        <option value="B2 oder niedriger">B2 oder niedriger</option>
                      </select>
                    </label>
                  </div>
                  {error && <div className="notice error" style={{ marginTop: 12 }}>{error}</div>}
                </div>
              </>
            )}
          </div>

          <div className="intro-actions">
            <button className="btn btn-secondary" type="button" onClick={previousIntroStep} disabled={introStep === 0}>
              <ChevronLeft size={16} /> Zurück
            </button>
            {introStep < introSteps.length - 1 ? (
              <button className="btn btn-primary" type="button" onClick={nextIntroStep}>
                Weiter <ChevronRight size={16} />
              </button>
            ) : (
              <button className="btn btn-primary" type="button" disabled={!demographicsComplete} onClick={beginSurvey}>
                {alreadyStarted ? "Zurück zur Bewertung" : "Weiter zum Schreibauftrag"} <ChevronRight size={16} />
              </button>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="participant-shell">
      <button className="participant-nav-toggle" type="button" onClick={() => setNavOpen((open) => !open)}>
        <Menu size={18} /> Aufgabenübersicht {navOpen ? "ausblenden" : "anzeigen"}
      </button>
      <div className="participant-layout">
        <aside className={`participant-card participant-sidebar sticky-panel ${navOpen ? "open" : ""}`}>
          <div className="brand" style={{ marginBottom: 22 }}>
            <div className="brand-mark">
              <MessageSquareText size={17} />
            </div>
            <span>
              Survey<span>Annotate</span>
            </span>
          </div>
          <p className="eyebrow">Deine Umfrage</p>
          <h1 className="page-title" style={{ fontSize: 25, marginTop: 4 }}>{survey.participant.pseudonym}</h1>
          <p className="muted">{survey.topic?.title}</p>
          <div style={{ margin: "18px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <strong>Fortschritt</strong>
              <span className="muted">{survey.completion.percent}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${survey.completion.percent}%` }} />
            </div>
            <p className="small muted">{answered} von {required} Bewertungen beantwortet</p>
          </div>

          <div className="task-list" aria-label="Aufgabenübersicht">
            <button className={`task-button overview-task ${demographicsComplete ? "done" : ""}`} type="button" onClick={() => navigateToIntro(4)}>
              <strong>
                <UserRound size={16} /> Angaben
              </strong>
              <span className="small">{demographicsComplete ? "vollständig" : "offen"}</span>
            </button>
            <button className={`task-button prompt-task ${activeMode === "prompt" ? "active" : ""} ${promptDone ? "done" : ""}`} type="button" onClick={navigateToPrompt}>
              <strong>
                <BookOpen size={16} /> Schreibauftrag
              </strong>
              <span className="small">{promptDone ? "gelesen" : "vor den Essays lesen"}</span>
            </button>
            {essays.map((item, essayIndex) => (
              <div className="essay-task-group" key={item._id}>
                <div className="essay-task-heading">{item.title}</div>
                <button
                  className={`task-button essay-read-task ${activeMode === "essay" && essayIndex === activeEssay ? "active" : ""} ${essayReadIds.has(item._id) ? "done" : ""}`}
                  type="button"
                  onClick={() => navigateToEssayIntro(essayIndex)}
                >
                  <strong>
                    <BookOpen size={16} /> Essay lesen
                  </strong>
                  <span className="small">{essayReadIds.has(item._id) ? "gelesen" : gradeLabelFromEssay(item)}</span>
                </button>
                {item.feedbacks.map((itemFeedback, feedbackIndex) => {
                  const done = survey.questions.every((question) => responseMap.has(responseKey(item._id, itemFeedback._id, question._id)));
                  const active = activeMode === "feedback" && essayIndex === activeEssay && feedbackIndex === activeFeedback;
                  return (
                    <button
                      className={`task-button ${active ? "active" : ""} ${done ? "done" : ""}`}
                      type="button"
                      key={`${item._id}-${itemFeedback._id}`}
                      onClick={() => {
                        navigateToTask(essayIndex, feedbackIndex);
                      }}
                    >
                      <strong>Feedback {String.fromCharCode(65 + feedbackIndex)}</strong>
                      <span className="small">{done ? "vollständig" : "offen"}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <button className="btn btn-primary" type="button" style={{ width: "100%", marginTop: 16 }} disabled={!canComplete} onClick={finish}>
            <ClipboardCheck size={16} /> Umfrage abschließen
          </button>
          {error && <div className="notice error" style={{ marginTop: 12 }}>{error}</div>}
        </aside>

        {activeMode === "prompt" ? (
        <section className="participant-card">
          <div className="page-head" style={{ marginBottom: 18 }}>
            <div>
              <p className="eyebrow">Vor den Essays</p>
              <h2 className="page-title" style={{ fontSize: 28 }}>Schreibauftrag</h2>
              <p className="page-subtitle">Dieser Auftrag ist die Grundlage für alle Essays, die du danach liest.</p>
            </div>
            {saving && <span className="status-pill" aria-live="polite">{saving}</span>}
          </div>

          <div className="essay-reading-panel">
            <PromptContext topic={survey.topic} />
          </div>

          <div className="button-row" style={{ justifyContent: "space-between", marginTop: 18 }}>
            <button className="btn btn-secondary" type="button" onClick={() => navigateToIntro(4)}>
              <ChevronLeft size={16} /> Angaben
            </button>
            <button className="btn btn-primary" type="button" onClick={() => navigateToEssayIntro(0)}>
              Ersten Essay lesen <ChevronRight size={16} />
            </button>
          </div>
        </section>
        ) : activeMode === "essay" ? (
        <section className="participant-card">
          <div className="page-head" style={{ marginBottom: 18 }}>
            <div>
              <p className="eyebrow">Essay {activeEssay + 1} von {essays.length}</p>
              <h2 className="page-title" style={{ fontSize: 28 }}>{essay?.title}</h2>
              <p className="page-subtitle">Stell dir vor: Schüler:in der {gradeLabel}</p>
            </div>
            {saving && <span className="status-pill" aria-live="polite">{saving}</span>}
          </div>

          <div className="context-panel">
            <ContextDisclosure title="Schreibauftrag">
              <PromptContext topic={survey.topic} />
            </ContextDisclosure>
          </div>

          <div className="essay-reading-panel">
            <div className="essay-reading-head">
              <BookOpen size={18} aria-hidden="true" />
              <strong>Essay lesen</strong>
            </div>
            <div className="context-text essay-read-text">{essay?.text}</div>
          </div>

          <div className="button-row" style={{ justifyContent: "space-between", marginTop: 18 }}>
            <button className="btn btn-secondary" type="button" onClick={previousFromEssayIntro}>
              <ChevronLeft size={16} /> Zurück
            </button>
            <button className="btn btn-primary" type="button" onClick={() => navigateToTask(activeEssay, 0)}>
              Feedbacks bewerten <ChevronRight size={16} />
            </button>
          </div>
        </section>
        ) : (
        <section className="participant-card">
          <div className="page-head" style={{ marginBottom: 18 }}>
            <div>
              <p className="eyebrow">Aufgabe {currentTaskNumber} von {totalTasks}</p>
              <h2 className="page-title" style={{ fontSize: 28 }}>{essay?.title}</h2>
              <p className="page-subtitle">Feedback {String.fromCharCode(65 + activeFeedback)} bewerten, Perspektive: {gradeLabel}</p>
            </div>
            {saving && <span className="status-pill" aria-live="polite">{saving}</span>}
          </div>

          <div className="context-panel">
            <ContextDisclosure title="Schreibauftrag">
              <PromptContext topic={survey.topic} />
            </ContextDisclosure>
            <ContextDisclosure title="Essay">
              <div className="context-text">{essay?.text}</div>
            </ContextDisclosure>
          </div>

          <div className="rating-workspace">
            <section className="feedback-read-pane" aria-labelledby="feedback-heading">
              <p className="eyebrow">Feedback {String.fromCharCode(65 + activeFeedback)}</p>
              <h3 id="feedback-heading" className="rating-section-title">Feedbacktext</h3>
              <div className="feedback-text">{feedback?.text}</div>
            </section>

            <section className="question-rating-pane" aria-labelledby="rating-heading">
              <p className="eyebrow">Sechs Fragen</p>
              <div className="rating-heading-row">
                <h3 id="rating-heading" className="rating-section-title">Bewertung</h3>
                <button
                  className={`criteria-help-button ${criteriaHelpOpen ? "active" : ""}`}
                  type="button"
                  aria-label={criteriaHelpOpen ? "Bewertungskriterien ausblenden" : "Bewertungskriterien anzeigen"}
                  aria-expanded={criteriaHelpOpen}
                  title={criteriaHelpOpen ? "Bewertungskriterien ausblenden" : "Bewertungskriterien anzeigen"}
                  onClick={() => setCriteriaHelpOpen((open) => !open)}
                >
                  <CircleHelp size={18} aria-hidden="true" />
                </button>
              </div>
              {criteriaHelpOpen && (
                <div className="rating-criteria-help">
                  <CriteriaList detailed />
                </div>
              )}
              <div className="question-list">
                {survey.questions.map((question) => {
                  const selected = responseMap.get(responseKey(essay._id, feedback._id, question._id));
                  return (
                    <div className="question-block" key={question._id}>
                      <div>
                        <p className="question-criterion">{criterionTitleForQuestion(question)}</p>
                        <h4 className="question-title">{formatQuestionText(question.text, gradeLabel)}</h4>
                      </div>
                      <div className="likert-grid" role="radiogroup" aria-label={formatQuestionText(question.text, gradeLabel)}>
                        {question.labels.map((label, index) => {
                          const value = index + 1;
                          return (
                            <button
                              className={`likert-option ${selected === value ? "selected" : ""}`}
                              type="button"
                              role="radio"
                              aria-checked={selected === value}
                              key={value}
                              onClick={() => choose(question._id, value)}
                            >
                              <span>
                                <strong>{value}</strong>
                                <span>{label}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="button-row" style={{ justifyContent: "space-between", marginTop: 20 }}>
            <button className="btn btn-secondary" type="button" onClick={previousTask} disabled={activeEssay === 0 && activeFeedback === 0}>
              <ChevronLeft size={16} /> Zurück
            </button>
            {isLastTask ? (
              <button className="btn btn-primary" type="button" onClick={finish} disabled={!canComplete}>
                Abschließen <ClipboardCheck size={16} />
              </button>
            ) : (
              <button className="btn btn-primary" type="button" onClick={nextTask}>
                Weiter <ChevronRight size={16} />
              </button>
            )}
          </div>
        </section>
        )}
      </div>
    </main>
  );
}
