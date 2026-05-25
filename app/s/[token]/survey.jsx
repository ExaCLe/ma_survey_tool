"use client";

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Loader2, Menu, MessageSquareText, UserRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

function responseKey(essayId, feedbackId, questionId) {
  return `${essayId}:${feedbackId}:${questionId}`;
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
  const [introVisible, setIntroVisible] = useState(true);
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
      const essayParam = Number.parseInt(searchParams.get("essay") || "", 10);
      const feedbackParam = Number.parseInt(searchParams.get("feedback") || "", 10);
      const essayIndex = essayParam - 1;
      const feedbackIndex = feedbackParam - 1;

      if (step === "intro") {
        setIntroVisible(true);
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
        setIntroVisible(false);
        initialVisibilityResolved.current = true;
        return;
      }

      if (!initialVisibilityResolved.current) {
        initialVisibilityResolved.current = true;
        setIntroVisible(!(survey.participant.startedAt && survey.participant.age && survey.participant.germanProficiency));
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
  const totalTasks = essays.reduce((sum, item) => sum + item.feedbacks.length, 0);
  const currentTaskNumber = essays.slice(0, activeEssay).reduce((sum, item) => sum + item.feedbacks.length, 0) + activeFeedback + 1;
  const required = survey.completion.required;
  const answered = survey.responses.length;
  const demographicsComplete = Boolean(age && germanProficiency);
  const canComplete = demographicsComplete && required > 0 && answered >= required;
  const alreadyStarted = Boolean(survey.participant.startedAt);
  const isLastTask = activeEssay === essays.length - 1 && activeFeedback === essay.feedbacks.length - 1;

  function scrollToSurveyTop() {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function navigateToIntro() {
    setIntroVisible(true);
    setNavOpen(false);
    router.push(`/s/${token}?step=intro`, { scroll: false });
    scrollToSurveyTop();
  }

  function navigateToTask(essayIndex, feedbackIndex) {
    setActiveEssay(essayIndex);
    setActiveFeedback(feedbackIndex);
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
    navigateToTask(activeEssay, activeFeedback);
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
      navigateToTask(activeEssay + 1, 0);
    }
  }

  function previousTask() {
    if (activeFeedback > 0) {
      navigateToTask(activeEssay, activeFeedback - 1);
      return;
    }
    if (activeEssay > 0) {
      const previousEssay = essays[activeEssay - 1];
      navigateToTask(activeEssay - 1, previousEssay.feedbacks.length - 1);
    }
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
          <p className="eyebrow">Essay-Feedback-Studie</p>
          <h1 className="page-title">Willkommen, {survey.participant.pseudonym}</h1>
          <p className="page-subtitle">
            Du liest gleich mehrere Essays und bewertest jeweils drei Feedbacktexte. Die Feedbacks werden anonym angezeigt; es geht um die Qualität des Feedbacks, nicht um deine Person.
          </p>

          <div className="intro-form">
            <h2 className="panel-title">
              <UserRound size={18} /> Angaben vor dem Start
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
            <div className="intro-prompt">
              <h2 className="panel-title">Schreibauftrag</h2>
              <PromptContext topic={survey.topic} />
            </div>
            <div className="notice" style={{ marginTop: 18 }}>
              Deine Antworten werden automatisch gespeichert. Du kannst während der Bearbeitung zu bereits beantworteten Aufgaben zurückgehen.
            </div>
            {error && <div className="notice error" style={{ marginTop: 12 }}>{error}</div>}
            <button className="btn btn-primary" type="button" style={{ width: "100%", marginTop: 16 }} disabled={!demographicsComplete} onClick={beginSurvey}>
              {alreadyStarted ? "Zurück zur Bewertung" : "Bewertung starten"}
            </button>
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
            <button className={`task-button overview-task ${demographicsComplete ? "done" : ""}`} type="button" onClick={navigateToIntro}>
              <strong>
                <UserRound size={16} /> Angaben
              </strong>
              <span className="small">{demographicsComplete ? "vollständig" : "offen"}</span>
            </button>
            {essays.map((item, essayIndex) => (
              <div className="essay-task-group" key={item._id}>
                <div className="essay-task-heading">{item.title}</div>
                {item.feedbacks.map((itemFeedback, feedbackIndex) => {
                  const done = survey.questions.every((question) => responseMap.has(responseKey(item._id, itemFeedback._id, question._id)));
                  const active = essayIndex === activeEssay && feedbackIndex === activeFeedback;
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

        <section className="participant-card">
          <div className="page-head" style={{ marginBottom: 18 }}>
            <div>
              <p className="eyebrow">Aufgabe {currentTaskNumber} von {totalTasks}</p>
              <h2 className="page-title" style={{ fontSize: 28 }}>{essay?.title}</h2>
              <p className="page-subtitle">Feedback {String.fromCharCode(65 + activeFeedback)} bewerten</p>
            </div>
            <span className="status-pill" aria-live="polite">{saving || "Autosave aktiv"}</span>
          </div>

          <div className="context-panel">
            <ContextDisclosure title="Schreibauftrag">
              <PromptContext topic={survey.topic} />
            </ContextDisclosure>
            <ContextDisclosure title="Essay" defaultOpen>
              <div className="context-text">{essay?.text}</div>
            </ContextDisclosure>
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            <div>
              <strong>Feedbacktext</strong>
              <div className="feedback-text">{feedback?.text}</div>
            </div>

            <div>
              {survey.questions.map((question) => {
                const selected = responseMap.get(responseKey(essay._id, feedback._id, question._id));
                return (
                  <div className="question-block" key={question._id}>
                    <h3 style={{ margin: 0 }}>{question.text}</h3>
                    <div className="likert-grid" role="radiogroup" aria-label={question.text}>
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

            <div className="button-row" style={{ justifyContent: "space-between" }}>
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
          </div>
        </section>
      </div>
    </main>
  );
}
