import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, mutation, query } from "./_generated/server";

const STUDY_KEY = "single-study";
const DEFAULT_NOTIFICATION_EMAIL = "leon.biermann@gmx.net";
const OVERALL_HELPFULNESS_QUESTION_KEY = "gesamt_hilfreich";
const METHOD_ORDER = ["baseline", "direct", "single"];
const FIXED_QUESTIONS = [
  {
    key: "verstaendlichkeit",
    text: "Wie verständlich ist dieses Feedback für eine:n Schüler:in der {grade}?",
    description:
      "Beurteile, ob die Formulierungen klar, altersangemessen und leicht nachzuvollziehen sind.",
    labels: ["gar nicht verständlich", "kaum verständlich", "eher unverständlich", "teils/teils", "eher verständlich", "sehr verständlich", "vollständig verständlich"]
  },
  {
    key: "spezifitaet",
    text: "Wie spezifisch bezieht sich dieses Feedback auf genau diesen Essay?",
    description:
      "Beurteile, ob das Feedback konkrete Stellen, Inhalte oder Probleme aus dem Essay aufgreift, statt nur allgemein zu beschreiben, wie ein guter Essay aussehen sollte.",
    labels: ["gar nicht spezifisch", "kaum spezifisch", "eher allgemein", "teils/teils", "eher spezifisch", "sehr spezifisch", "genau auf diesen Essay zugeschnitten"]
  },
  {
    key: "handlungsorientierung",
    text: "Wie gut zeigt das Feedback konkrete nächste Schritte für die Überarbeitung?",
    description:
      "Beurteile, ob du als Schüler:in klar erkennen würdest, was du als Nächstes ändern, ergänzen oder verbessern kannst.",
    labels: ["gar nicht umsetzbar", "kaum umsetzbar", "eher vage", "teils/teils", "eher umsetzbar", "sehr umsetzbar", "ganz konkrete nächste Schritte"]
  },
  {
    key: "priorisierung",
    text: "Wie klar macht das Feedback, was bei der Überarbeitung als Erstes und eventuell danach als Zweites, Drittes usw. gemacht werden soll?",
    description:
      "Beurteile, ob klar wird, womit die Überarbeitung beginnen sollte und ob weitere Schritte sinnvoll geordnet sind.",
    labels: ["sehr unklar", "unklar", "eher unklar", "teils/teils", "eher klar", "sehr klar", "klare nächste Schritte"]
  },
  {
    key: "bewaeltigbarkeit",
    text: "Wie gut bewältigbar ist dieses Feedback für eine:n Schüler:in der {grade}?",
    description:
      "Beurteile, ob Umfang, Sprache und Anzahl der Hinweise für die angegebene Klassenstufe gut zu bewältigen sind.",
    labels: ["sehr überfordernd", "überfordernd", "eher überfordernd", "teils/teils", "eher bewältigbar", "gut bewältigbar", "sehr gut bewältigbar"]
  },
  {
    key: "gesamt_hilfreich",
    text: "Wie hilfreich ist dieses Feedback insgesamt aus deiner Sicht als Schüler:in der {grade}?",
    description:
      "Beurteile abschließend den Gesamteindruck: Wie sehr würde dir dieses Feedback helfen, den Essay sinnvoll zu überarbeiten?",
    labels: ["gar nicht hilfreich", "kaum hilfreich", "eher nicht hilfreich", "teils/teils", "eher hilfreich", "sehr hilfreich", "außerordentlich hilfreich"]
  }
];
const TABLES = [
  "responses",
  "participantFeedbackOrders",
  "groupEssayAssignments",
  "participants",
  "groups",
  "feedbacks",
  "automaticMethodRankings",
  "automaticPairwiseDetails",
  "essays",
  "topics",
  "questions",
  "settings"
];

function requireAdmin(adminPassword) {
  const expected = process.env.ADMIN_PASSWORD || "admin";
  if (adminPassword !== expected) {
    throw new Error("Admin-Passwort ist nicht korrekt.");
  }
}

function now() {
  return Date.now();
}

function compareMethodKeys(a, b) {
  const normalizedA = String(a || "").trim().toLowerCase();
  const normalizedB = String(b || "").trim().toLowerCase();
  const indexA = METHOD_ORDER.indexOf(normalizedA);
  const indexB = METHOD_ORDER.indexOf(normalizedB);
  const orderA = indexA === -1 ? METHOD_ORDER.length : indexA;
  const orderB = indexB === -1 ? METHOD_ORDER.length : indexB;
  return orderA - orderB || String(a || "").localeCompare(String(b || ""));
}

function formatNotificationDate(timestamp) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin"
  }).format(new Date(timestamp));
}

function notificationSubject(event, participantCode) {
  const eventLabel = event === "started" ? "Survey gestartet" : "Survey abgeschlossen";
  return `${eventLabel}: ${participantCode}`;
}

function notificationText(args) {
  const eventLabel = args.event === "started" ? "gestartet" : "abgeschlossen";
  return [
    `Ein Survey wurde ${eventLabel}.`,
    "",
    `Zeitpunkt: ${formatNotificationDate(args.at)}`,
    `Teilnehmer-Code: ${args.participantCode}`,
    `Pseudonym: ${args.participantPseudonym}`,
    `Gruppe: ${args.groupKey || "-"}`,
    `Thema: ${args.topicTitle || "-"}`,
    `Klasse: ${args.gradeLevel ? `${args.gradeLevel}. Klasse` : "-"}`
  ].join("\n");
}

export const sendSurveyLifecycleEmail = internalAction({
  args: {
    event: v.union(v.literal("started"), v.literal("completed")),
    participantCode: v.string(),
    participantPseudonym: v.string(),
    groupKey: v.optional(v.string()),
    topicTitle: v.optional(v.string()),
    gradeLevel: v.optional(v.string()),
    at: v.number()
  },
  handler: async (ctx, args) => {
    void ctx;
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || process.env.RESEND_FROM;
    const to = process.env.SURVEY_NOTIFICATION_EMAIL || DEFAULT_NOTIFICATION_EMAIL;
    if (!apiKey || !from) {
      console.warn("Survey email notification skipped: RESEND_API_KEY and EMAIL_FROM/RESEND_FROM are required.");
      return { ok: false, skipped: true };
    }

    const response = await globalThis.fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to,
        subject: notificationSubject(args.event, args.participantCode),
        text: notificationText(args)
      })
    });

    if (!response.ok) {
      console.error("Survey email notification failed", response.status, await response.text());
      return { ok: false, skipped: false };
    }
    return { ok: true };
  }
});

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeGradeLevel(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (/^(5|5\.|5th|grade 5|5th grade|klasse 5|5\. klasse)$/.test(raw)) return "5";
  if (/^(9|9\.|9th|grade 9|9th grade|klasse 9|9\. klasse)$/.test(raw)) return "9";
  return "";
}

function token() {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2)}`;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const nameBank = {
  A: ["Astra", "Arden", "Aurel", "Aris", "Aven", "Anik"],
  B: ["Bex", "Bryn", "Bora", "Balen", "Bria", "Bardo"],
  C: ["Cyra", "Cato", "Celes", "Corin", "Cass", "Ciri"],
  D: ["Dax", "Dara", "Dorin", "Diona", "Dray", "Davo"],
  E: ["Eira", "Ezra", "Elio", "Enna", "Eron", "Edda"],
  F: ["Fenn", "Fara", "Finn", "Fiora", "Falk", "Faye"],
  G: ["Galen", "Gara", "Grix", "Giona", "Gav", "Gesa"],
  H: ["Hale", "Hera", "Hux", "Hanna", "Hiro", "Heda"],
  I: ["Ira", "Iven", "Iska", "Ivo", "Ilon", "Inda"],
  J: ["Jora", "Jax", "Juno", "Jalen", "Jari", "Jessa"],
  K: ["Kara", "Kian", "Kora", "Kael", "Kess", "Kiro"],
  L: ["Lira", "Lio", "Lenn", "Luma", "Larek", "Leia"],
  M: ["Mira", "Maro", "Mika", "Maven", "Mara", "Miro"],
  N: ["Nira", "Nox", "Nero", "Nara", "Nilo", "Nessa"],
  O: ["Orin", "Ona", "Orex", "Oryn", "Olia", "Oren"],
  P: ["Pax", "Pira", "Poe", "Pella", "Pavo", "Pria"],
  Q: ["Quin", "Qira", "Quell", "Qaro", "Quen", "Qira"],
  R: ["Rhea", "Rion", "Rax", "Rana", "Rivo", "Rey"],
  S: ["Sora", "Senn", "Sira", "Sol", "Savio", "Sela"],
  T: ["Tara", "Talon", "Tess", "Tiro", "Tova", "Tane"],
  U: ["Una", "Urix", "Ulan", "Uri", "Ulva", "Uren"],
  V: ["Vera", "Vex", "Vira", "Vano", "Voss", "Vela"],
  W: ["Wren", "Wynn", "Wira", "Waro", "Wex", "Wila"],
  X: ["Xara", "Xen", "Xira", "Xavo", "Xeri", "Xan"],
  Y: ["Yara", "Yen", "Yori", "Yula", "Yavo", "Yris"],
  Z: ["Zara", "Zed", "Zora", "Zain", "Ziva", "Zeno"]
};

function pseudonymFor(initial, index) {
  const letter = (initial || "A").toUpperCase().slice(0, 1);
  const names = nameBank[letter] || nameBank.A;
  const base = names[index % names.length];
  const suffix = index >= names.length ? ` ${Math.floor(index / names.length) + 1}` : "";
  return `${base}${suffix}`;
}

async function collect(ctx, table) {
  return await ctx.db.query(table).collect();
}

function defaultSettings() {
  return {
    key: STUDY_KEY,
    title: "Essay-Feedback-Studie",
    status: "draft",
    updatedAt: 0
  };
}

async function readSettings(ctx) {
  const existing = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", STUDY_KEY))
    .first();
  return existing || defaultSettings();
}

async function ensureSettings(ctx) {
  const existing = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", STUDY_KEY))
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("settings", {
    key: STUDY_KEY,
    title: "Essay-Feedback-Studie",
    status: "draft",
    updatedAt: now()
  });
  return await ctx.db.get(id);
}

async function ensureFixedQuestions(ctx) {
  const responses = await collect(ctx, "responses");
  const questions = (await collect(ctx, "questions")).sort((a, b) => a.order - b.order);
  const matches =
    questions.length === FIXED_QUESTIONS.length &&
    questions.every((question, index) => {
      const fixed = FIXED_QUESTIONS[index];
      return (
        question.key === fixed.key &&
        question.text === fixed.text &&
        question.description === fixed.description &&
        question.labels.length === fixed.labels.length &&
        question.labels.every((label, labelIndex) => label === fixed.labels[labelIndex])
      );
    });
  if (matches) return questions;
  if (responses.length > 0) {
    throw new Error("Die festen Bewertungsfragen können nach Antworten nicht automatisch ersetzt werden.");
  }
  await clearTables(ctx, ["questions"]);
  const inserted = [];
  for (let index = 0; index < FIXED_QUESTIONS.length; index += 1) {
    const question = FIXED_QUESTIONS[index];
    const id = await ctx.db.insert("questions", {
      key: question.key,
      text: question.text,
      description: question.description,
      labels: question.labels,
      order: index
    });
    const row = await ctx.db.get(id);
    if (row) inserted.push(row);
  }
  return inserted;
}

async function clearTables(ctx, tables) {
  for (const table of tables) {
    const rows = await collect(ctx, table);
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
  }
}

async function getStudyData(ctx, options = {}) {
  const settings = options.ensureSettings ? await ensureSettings(ctx) : await readSettings(ctx);
  const groups = (await collect(ctx, "groups")).sort((a, b) => a.order - b.order);
  const participants = await collect(ctx, "participants");
  const topics = (await collect(ctx, "topics")).sort((a, b) => a.order - b.order);
  const essays = await collect(ctx, "essays");
  const feedbacks = await collect(ctx, "feedbacks");
  const automaticRankings = (await collect(ctx, "automaticMethodRankings")).sort((a, b) => a.combinedRank - b.combinedRank);
  const automaticPairwiseDetails = (await collect(ctx, "automaticPairwiseDetails")).sort(
    (a, b) => a.essayKey.localeCompare(b.essayKey) || a.canonicalPairKey.localeCompare(b.canonicalPairKey)
  );
  const questions = (await collect(ctx, "questions")).sort((a, b) => a.order - b.order);
  const assignments = await collect(ctx, "groupEssayAssignments");
  const responses = await collect(ctx, "responses");
  return { settings, groups, participants, topics, essays, feedbacks, automaticRankings, automaticPairwiseDetails, questions, assignments, responses };
}

async function resolveTopicPromptImage(ctx, topic) {
  if (!topic) return null;
  const storageUrl = topic.promptImageStorageId ? await ctx.storage.getUrl(topic.promptImageStorageId) : null;
  return {
    ...topic,
    promptImageUrl: storageUrl || topic.promptImageUrl
  };
}

async function resolveTopicPromptImages(ctx, topics) {
  return await Promise.all(topics.map((topic) => resolveTopicPromptImage(ctx, topic)));
}

async function scheduleSurveyLifecycleEmail(ctx, event, participant, at) {
  const group = await ctx.db.get(participant.groupId);
  const topic = group?.topicId ? await ctx.db.get(group.topicId) : null;
  await ctx.scheduler.runAfter(0, internal.study.sendSurveyLifecycleEmail, {
    event,
    participantCode: participant.code,
    participantPseudonym: participant.pseudonym,
    groupKey: group?.key || undefined,
    topicTitle: topic?.title || undefined,
    gradeLevel: group?.gradeLevel || undefined,
    at
  });
}

function validateData(data) {
  const errors = [];
  if (data.groups.length !== 6) errors.push("Es müssen genau 6 Gruppen angelegt sein.");
  if (data.topics.length !== 3) errors.push("Es müssen genau 3 Themen importiert sein.");
  if (data.questions.length !== FIXED_QUESTIONS.length) errors.push(`Es müssen genau ${FIXED_QUESTIONS.length} feste Bewertungsfragen angelegt sein.`);

  for (const question of data.questions) {
    if (question.labels.length !== 7) {
      errors.push(`Frage ${question.key} benötigt genau 7 Labels.`);
    }
  }

  const topicEssayCounts = new Map();
  const topicGradeEssayCounts = new Map();
  for (const topic of data.topics) {
    const essays = data.essays.filter((essay) => essay.topicId === topic._id);
    topicEssayCounts.set(topic._id, essays.length);
    if (essays.length === 0) errors.push(`Thema ${topic.title} hat keine Essays.`);
    for (const gradeLevel of ["5", "9"]) {
      const gradeEssays = essays.filter((essay) => normalizeGradeLevel(essay.gradeLevel) === gradeLevel);
      topicGradeEssayCounts.set(`${topic._id}:${gradeLevel}`, gradeEssays.length);
      if (gradeEssays.length === 0) errors.push(`Thema ${topic.title} braucht Essays für Klasse ${gradeLevel}.`);
    }
  }
  const distinctCounts = new Set([...topicEssayCounts.values()]);
  if (distinctCounts.size > 1) errors.push("Alle Themen müssen gleich viele Essays haben.");
  const distinctTopicGradeCounts = new Set([...topicGradeEssayCounts.values()]);
  if (distinctTopicGradeCounts.size > 1) errors.push("Alle Thema-Klassenstufe-Kombinationen müssen gleich viele Essays haben.");

  for (const essay of data.essays) {
    if (!normalizeGradeLevel(essay.gradeLevel)) errors.push(`Essay ${essay.key} benötigt eine Klassenstufe (5 oder 9).`);
    const count = data.feedbacks.filter((feedback) => feedback.essayId === essay._id).length;
    if (count !== 3) errors.push(`Essay ${essay.key} benötigt genau 3 Feedbacktexte.`);
  }

  const groupsByTopic = new Map();
  const groupsByGrade = new Map();
  for (const group of data.groups) {
    const groupAssignments = data.assignments.filter((assignment) => assignment.groupId === group._id);
    const gradeLevel = normalizeGradeLevel(group.gradeLevel);
    if (groupAssignments.length > 0 && !gradeLevel) errors.push(`Gruppe ${group.name} benötigt eine Klassenstufe (5 oder 9).`);
    if (gradeLevel) groupsByGrade.set(gradeLevel, (groupsByGrade.get(gradeLevel) || 0) + 1);
    if (groupAssignments.length > 0 && !group.topicId) {
      errors.push(`Gruppe ${group.name} ist keinem Thema zugeordnet.`);
      continue;
    }
    if (group.topicId) groupsByTopic.set(group.topicId, (groupsByTopic.get(group.topicId) || 0) + 1);
  }
  if (data.assignments.length > 0) {
    for (const topic of data.topics) {
      if ((groupsByTopic.get(topic._id) || 0) !== 2) {
        errors.push(`Thema ${topic.title} muss genau 2 Gruppen haben.`);
      }
    }
    for (const gradeLevel of ["5", "9"]) {
      if ((groupsByGrade.get(gradeLevel) || 0) !== data.topics.length) {
        errors.push(`Klasse ${gradeLevel} braucht genau ${data.topics.length} Gruppen.`);
      }
    }
  }

  for (const group of data.groups) {
    const groupParticipants = data.participants.filter((participant) => participant.groupId === group._id);
    if (groupParticipants.length === 0) errors.push(`Gruppe ${group.name} hat keine Teilnehmenden.`);
    const groupAssignments = data.assignments.filter((assignment) => assignment.groupId === group._id);
    if (groupAssignments.length === 0) errors.push(`Gruppe ${group.name} hat keine Essays.`);
    for (const assignment of groupAssignments) {
      const essay = data.essays.find((item) => item._id === assignment.essayId);
      if (essay && normalizeGradeLevel(essay.gradeLevel) !== normalizeGradeLevel(group.gradeLevel)) {
        errors.push(`Gruppe ${group.name} enthält Essay ${essay.key} aus einer anderen Klassenstufe.`);
      }
    }
  }

  return errors;
}

function completionStats(data) {
  const requiredByParticipant = new Map();
  const responseByParticipant = new Map();
  const questionCount = data.questions.length;
  for (const participant of data.participants) {
    const assignmentCount = data.assignments.filter((assignment) => assignment.groupId === participant.groupId).length;
    requiredByParticipant.set(participant._id, assignmentCount * 3 * questionCount);
    responseByParticipant.set(participant._id, 0);
  }
  for (const response of data.responses) {
    responseByParticipant.set(response.participantId, (responseByParticipant.get(response.participantId) || 0) + 1);
  }
  const required = [...requiredByParticipant.values()].reduce((sum, value) => sum + value, 0);
  const answered = [...responseByParticipant.values()].reduce((sum, value) => sum + value, 0);
  return { required, answered };
}

function ordinalAlpha(ratingsByItem) {
  const itemPairs = [];
  const allValues = [];
  for (const ratings of ratingsByItem.values()) {
    const values = ratings.filter((value) => Number.isFinite(value));
    allValues.push(...values);
    for (let i = 0; i < values.length; i += 1) {
      for (let j = i + 1; j < values.length; j += 1) {
        itemPairs.push((values[i] - values[j]) ** 2);
      }
    }
  }
  if (itemPairs.length === 0 || allValues.length < 2) return null;
  const observed = itemPairs.reduce((sum, value) => sum + value, 0) / itemPairs.length;
  const expectedPairs = [];
  for (let i = 0; i < allValues.length; i += 1) {
    for (let j = i + 1; j < allValues.length; j += 1) {
      expectedPairs.push((allValues[i] - allValues[j]) ** 2);
    }
  }
  const expected = expectedPairs.reduce((sum, value) => sum + value, 0) / expectedPairs.length;
  if (!expected) return 1;
  return Math.max(-1, Math.min(1, 1 - observed / expected));
}

function addParticipantRating(ratingsByItem, itemKey, participantId, value) {
  const ratings = ratingsByItem.get(itemKey) || new Map();
  ratings.set(participantId, value);
  ratingsByItem.set(itemKey, ratings);
}

function alphaFromParticipantRatings(ratingsByItem) {
  const valueMap = new Map();
  for (const [itemKey, ratingsByParticipant] of ratingsByItem.entries()) {
    valueMap.set(itemKey, [...ratingsByParticipant.values()]);
  }
  return ordinalAlpha(valueMap);
}

function agreement(data) {
  const byQuestion = [];
  const itemMaps = new Map();
  const feedbackById = new Map(data.feedbacks.map((feedback) => [feedback._id, feedback]));
  const overallMap = new Map();

  for (const question of data.questions) {
    itemMaps.set(question._id, new Map());
  }

  for (const response of data.responses) {
    const feedback = feedbackById.get(response.feedbackId);
    if (!feedback || !Number.isFinite(response.value)) continue;
    const map = itemMaps.get(response.questionId);
    if (!map) continue;
    const itemKey = `${response.essayId}:${feedback._id}`;
    addParticipantRating(map, itemKey, response.participantId, response.value);
    addParticipantRating(overallMap, `${response.questionId}:${itemKey}`, response.participantId, response.value);
  }

  for (const question of data.questions) {
    const alpha = alphaFromParticipantRatings(itemMaps.get(question._id) || new Map());
    byQuestion.push({
      questionId: question._id,
      key: question.key,
      text: question.text,
      alpha
    });
  }

  return {
    overallAlpha: alphaFromParticipantRatings(overallMap),
    byQuestion
  };
}

function comparisonBucket(rows, scope, methodA, methodB) {
  const key = `${scope.sort}:${methodA}:${methodB}`;
  const existing = rows.get(key);
  if (existing) return existing;
  const row = {
    scopeKey: scope.key,
    scopeLabel: scope.label,
    sort: scope.sort,
    methodA,
    methodB,
    winsA: 0,
    ties: 0,
    winsB: 0,
    pairedCount: 0,
    deltaSum: 0
  };
  rows.set(key, row);
  return row;
}

function addComparison(rows, scope, methodA, methodB, delta) {
  const row = comparisonBucket(rows, scope, methodA, methodB);
  row.pairedCount += 1;
  row.deltaSum += delta;
  if (delta > 0) {
    row.winsA += 1;
  } else if (delta < 0) {
    row.winsB += 1;
  } else {
    row.ties += 1;
  }
}

function sortedValues(values) {
  return values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
}

function describeValues(values) {
  const sorted = sortedValues(values);
  if (sorted.length === 0) {
    return {
      count: 0,
      mean: null,
      median: null,
      standardDeviation: null,
      min: null,
      max: null,
      favorablePercent: null,
      topBoxPercent: null
    };
  }
  const sum = sorted.reduce((total, value) => total + value, 0);
  const mean = sum / sorted.length;
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const variance =
    sorted.length > 1 ? sorted.reduce((total, value) => total + (value - mean) ** 2, 0) / (sorted.length - 1) : null;
  return {
    count: sorted.length,
    mean,
    median,
    standardDeviation: variance == null ? null : Math.sqrt(variance),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    favorablePercent: (sorted.filter((value) => value >= 5).length / sorted.length) * 100,
    topBoxPercent: (sorted.filter((value) => value >= 6).length / sorted.length) * 100
  };
}

function spearmanCorrelation(pairs) {
  if (pairs.length < 2) return null;
  const sumSquaredDelta = pairs.reduce((sum, pair) => sum + (pair.humanRank - pair.automaticRank) ** 2, 0);
  const n = pairs.length;
  return 1 - (6 * sumSquaredDelta) / (n * (n ** 2 - 1));
}

function rankRows(rows, scoreKey, rankKey = "rank", descending = true) {
  const ranked = [...rows].sort((a, b) => {
    const scoreA = Number.isFinite(a[scoreKey]) ? a[scoreKey] : descending ? -Infinity : Infinity;
    const scoreB = Number.isFinite(b[scoreKey]) ? b[scoreKey] : descending ? -Infinity : Infinity;
    return descending ? scoreB - scoreA || compareMethodKeys(a.methodKey, b.methodKey) : scoreA - scoreB || compareMethodKeys(a.methodKey, b.methodKey);
  });
  let previousScore = null;
  let previousRank = 0;
  const rankByMethod = new Map();
  for (let index = 0; index < ranked.length; index += 1) {
    const row = ranked[index];
    const score = row[scoreKey];
    const rank = Number.isFinite(score) && score === previousScore ? previousRank : index + 1;
    previousScore = score;
    previousRank = rank;
    rankByMethod.set(row.methodKey, rank);
  }
  return rows.map((row) => ({ ...row, [rankKey]: rankByMethod.get(row.methodKey) }));
}

function fitBradleyTerry(methodKeys, comparisons) {
  if (methodKeys.length === 0) return new Map();
  const wins = new Map(methodKeys.map((methodKey) => [methodKey, 0]));
  const pairCounts = new Map();
  for (const comparison of comparisons) {
    wins.set(comparison.methodA, (wins.get(comparison.methodA) || 0) + comparison.scoreA);
    wins.set(comparison.methodB, (wins.get(comparison.methodB) || 0) + comparison.scoreB);
    const pairKey = [comparison.methodA, comparison.methodB].sort().join("\u0000");
    pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + comparison.scoreA + comparison.scoreB);
  }

  let abilities = new Map(methodKeys.map((methodKey) => [methodKey, 1]));
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const nextAbilities = new Map();
    for (const methodKey of methodKeys) {
      const winCount = wins.get(methodKey) || 0;
      let denominator = 0;
      for (const otherMethodKey of methodKeys) {
        if (otherMethodKey === methodKey) continue;
        const pairKey = [methodKey, otherMethodKey].sort().join("\u0000");
        const count = pairCounts.get(pairKey) || 0;
        if (!count) continue;
        denominator += count / ((abilities.get(methodKey) || 1) + (abilities.get(otherMethodKey) || 1));
      }
      nextAbilities.set(methodKey, denominator ? Math.max(1e-9, winCount / denominator) : 1e-9);
    }
    const meanAbility = [...nextAbilities.values()].reduce((sum, value) => sum + value, 0) / methodKeys.length || 1;
    abilities = new Map([...nextAbilities.entries()].map(([methodKey, ability]) => [methodKey, ability / meanAbility]));
  }
  return abilities;
}

function describePairwiseRanking(methodKeys, valuesByMethod, comparisons) {
  const abilities = fitBradleyTerry(methodKeys, comparisons);
  const counts = new Map(
    methodKeys.map((methodKey) => [
      methodKey,
      {
        wins: 0,
        losses: 0,
        ties: 0,
        comparisons: 0
      }
    ])
  );
  for (const comparison of comparisons) {
    const countA = counts.get(comparison.methodA);
    const countB = counts.get(comparison.methodB);
    if (!countA || !countB) continue;
    countA.comparisons += 1;
    countB.comparisons += 1;
    if (comparison.scoreA > comparison.scoreB) {
      countA.wins += 1;
      countB.losses += 1;
    } else if (comparison.scoreA < comparison.scoreB) {
      countA.losses += 1;
      countB.wins += 1;
    } else {
      countA.ties += 1;
      countB.ties += 1;
    }
  }
  return rankRows(
    methodKeys.map((methodKey) => {
      const values = valuesByMethod.get(methodKey) || [];
      const summary = describeValues(values);
      const ability = abilities.get(methodKey) || 0;
      return {
        methodKey,
        mean: summary.mean,
        count: summary.count,
        btAbility: ability,
        btScore: ability > 0 ? Math.log(ability) : null,
        ...(counts.get(methodKey) || { wins: 0, losses: 0, ties: 0, comparisons: 0 })
      };
    }),
    "btAbility",
    "btRank"
  );
}

function automaticRankingComparison(data) {
  const methodGroups = new Map();
  for (const row of groupedRatingRows(data)) {
    if (row.questionKey !== OVERALL_HELPFULNESS_QUESTION_KEY) continue;
    pushGroupedValue(methodGroups, row.methodKey, { methodKey: row.methodKey }, row.value);
  }
  const methodStats = [...methodGroups.values()]
    .map((group) => ({
      methodKey: group.methodKey,
      ...describeValues(group.values)
    }))
    .sort((a, b) => compareMethodKeys(a.methodKey, b.methodKey));
  const automaticBySurveyMethod = new Map(
    data.automaticRankings
      .filter((ranking) => ranking.surveyMethodKey)
      .map((ranking) => [ranking.surveyMethodKey, ranking])
  );
  const feedbackMethodKeys = [...new Set(data.feedbacks.map((feedback) => feedback.methodKey))].sort(compareMethodKeys);
  const humanRankByMethod = new Map();
  const sortedHumanStats = [...methodStats].sort((a, b) => (b.mean || 0) - (a.mean || 0) || compareMethodKeys(a.methodKey, b.methodKey));
  for (let index = 0; index < sortedHumanStats.length; index += 1) {
    humanRankByMethod.set(sortedHumanStats[index].methodKey, index + 1);
  }

  const rows = methodStats.map((method) => {
    const automatic = automaticBySurveyMethod.get(method.methodKey);
    const humanRank = humanRankByMethod.get(method.methodKey);
    return {
      methodKey: method.methodKey,
      humanMean: method.mean,
      humanRank,
      humanCount: method.count,
      autoApproachKey: automatic?.autoApproachKey || null,
      displayName: automatic?.displayName || method.methodKey,
      automaticCombinedRank: automatic?.combinedRank ?? null,
      automaticCombinedAbility: automatic?.combinedAbility ?? null,
      automaticCombinedScore: automatic?.combinedScore ?? null,
      rankDelta:
        automatic && Number.isFinite(humanRank) && Number.isFinite(automatic.combinedRank)
          ? humanRank - automatic.combinedRank
          : null,
      gemmaRank: automatic?.gemmaRank ?? null,
      llamaRank: automatic?.llamaRank ?? null,
      openaiRank: automatic?.openaiRank ?? null
    };
  });

  const rowsWithAutomaticRank = rows
    .filter((row) => Number.isFinite(row.humanRank) && Number.isFinite(row.automaticCombinedRank))
    .sort((a, b) => a.automaticCombinedRank - b.automaticCombinedRank || compareMethodKeys(a.methodKey, b.methodKey));
  const automaticRankWithinMappedMethods = new Map();
  for (let index = 0; index < rowsWithAutomaticRank.length; index += 1) {
    automaticRankWithinMappedMethods.set(rowsWithAutomaticRank[index].methodKey, index + 1);
  }
  const rankPairs = rowsWithAutomaticRank.map((row) => ({
    humanRank: row.humanRank,
    automaticRank: automaticRankWithinMappedMethods.get(row.methodKey)
  }));

  const mappedSurveyMethodKeys = data.automaticRankings
    .filter((ranking) => ranking.surveyMethodKey)
    .map((ranking) => ranking.surveyMethodKey)
    .sort(compareMethodKeys);
  const missingSurveyMethodKeys = feedbackMethodKeys.filter((methodKey) => !automaticBySurveyMethod.has(methodKey));
  const unmappedAutomaticApproaches = data.automaticRankings
    .filter((ranking) => !ranking.surveyMethodKey)
    .map((ranking) => ranking.autoApproachKey)
    .sort((a, b) => a.localeCompare(b));

  return {
    rows,
    spearman: spearmanCorrelation(rankPairs),
    mappedCount: mappedSurveyMethodKeys.length,
    totalAutomaticRows: data.automaticRankings.length,
    mappedSurveyMethodKeys,
    missingSurveyMethodKeys,
    unmappedAutomaticApproaches
  };
}

function automaticRowsBySurveyMethod(data) {
  const mappedAutomaticRows = data.automaticRankings
    .filter((ranking) => ranking.surveyMethodKey)
    .sort((a, b) => a.combinedRank - b.combinedRank || a.surveyMethodKey.localeCompare(b.surveyMethodKey));
  const surveyRankByMethod = new Map();
  for (let index = 0; index < mappedAutomaticRows.length; index += 1) {
    surveyRankByMethod.set(mappedAutomaticRows[index].surveyMethodKey, index + 1);
  }
  return new Map(
    mappedAutomaticRows.map((ranking) => [
      ranking.surveyMethodKey,
      {
        automaticSurveyRank: surveyRankByMethod.get(ranking.surveyMethodKey),
        automaticCombinedRank: ranking.combinedRank,
        automaticCombinedAbility: ranking.combinedAbility,
        automaticCombinedScore: ranking.combinedScore,
        autoApproachKey: ranking.autoApproachKey,
        displayName: ranking.displayName
      }
    ])
  );
}

function humanRankingComparison(data) {
  const feedbackById = new Map(data.feedbacks.map((feedback) => [feedback._id, feedback]));
  const participantById = new Map(data.participants.map((participant) => [participant._id, participant]));
  const essayById = new Map(data.essays.map((essay) => [essay._id, essay]));
  const questionById = new Map(data.questions.map((question) => [question._id, question]));
  const topicById = new Map(data.topics.map((topic) => [topic._id, topic]));
  const automaticByMethod = automaticRowsBySurveyMethod(data);
  const methodKeys = [...new Set(data.feedbacks.map((feedback) => feedback.methodKey))].sort(compareMethodKeys);
  const ratingContexts = new Map();

  for (const response of data.responses) {
    const feedback = feedbackById.get(response.feedbackId);
    const participant = participantById.get(response.participantId);
    const essay = essayById.get(response.essayId);
    const question = questionById.get(response.questionId);
    if (!feedback || !participant || !essay || question?.key !== OVERALL_HELPFULNESS_QUESTION_KEY || !Number.isFinite(response.value)) continue;
    const key = `${response.participantId}:${response.essayId}`;
    const context = ratingContexts.get(key) || {
      participant,
      essay,
      methods: new Map()
    };
    const values = context.methods.get(feedback.methodKey) || [];
    values.push(response.value);
    context.methods.set(feedback.methodKey, values);
    ratingContexts.set(key, context);
  }

  const overallValuesByMethod = new Map(methodKeys.map((methodKey) => [methodKey, []]));
  const overallComparisons = [];
  const essayValuesByMethod = new Map();
  const essayComparisons = new Map();
  const annotatorRankingsByEssay = new Map();

  for (const context of ratingContexts.values()) {
    const methodValues = [...context.methods.entries()]
      .map(([methodKey, values]) => ({
        methodKey,
        value: values.reduce((sum, value) => sum + value, 0) / values.length
      }))
      .filter((row) => Number.isFinite(row.value))
      .sort((a, b) => compareMethodKeys(a.methodKey, b.methodKey));
    if (methodValues.length < 2) continue;

    const essayKey = context.essay.key;
    if (!essayValuesByMethod.has(essayKey)) essayValuesByMethod.set(essayKey, new Map());
    if (!essayComparisons.has(essayKey)) essayComparisons.set(essayKey, []);
    if (!annotatorRankingsByEssay.has(essayKey)) annotatorRankingsByEssay.set(essayKey, []);

    for (const row of methodValues) {
      const overallValues = overallValuesByMethod.get(row.methodKey) || [];
      overallValues.push(row.value);
      overallValuesByMethod.set(row.methodKey, overallValues);
      const essayValues = essayValuesByMethod.get(essayKey);
      const values = essayValues.get(row.methodKey) || [];
      values.push(row.value);
      essayValues.set(row.methodKey, values);
    }

    const participantRanking = rankRows(methodValues, "value", "humanRank").map((row) => ({
      participantId: context.participant._id,
      participantPseudonym: context.participant.pseudonym,
      participantCode: context.participant.code,
      methodKey: row.methodKey,
      humanRank: row.humanRank,
      mean: row.value,
      ...(automaticByMethod.get(row.methodKey) || {})
    }));
    annotatorRankingsByEssay.get(essayKey).push(...participantRanking);

    for (let i = 0; i < methodValues.length; i += 1) {
      for (let j = i + 1; j < methodValues.length; j += 1) {
        const methodA = methodValues[i];
        const methodB = methodValues[j];
        const comparison =
          methodA.value > methodB.value
            ? { methodA: methodA.methodKey, methodB: methodB.methodKey, scoreA: 1, scoreB: 0 }
            : methodA.value < methodB.value
              ? { methodA: methodA.methodKey, methodB: methodB.methodKey, scoreA: 0, scoreB: 1 }
              : { methodA: methodA.methodKey, methodB: methodB.methodKey, scoreA: 0.5, scoreB: 0.5 };
        overallComparisons.push(comparison);
        essayComparisons.get(essayKey).push(comparison);
      }
    }
  }

  const overallRows = describePairwiseRanking(methodKeys, overallValuesByMethod, overallComparisons).map((row) => ({
    ...row,
    ...(automaticByMethod.get(row.methodKey) || {}),
    rankDelta:
      automaticByMethod.has(row.methodKey) && Number.isFinite(row.btRank)
        ? row.btRank - automaticByMethod.get(row.methodKey).automaticSurveyRank
        : null
  }));

  const essayRows = [...essayValuesByMethod.entries()]
    .map(([essayKey, valuesByMethod]) => {
      const essay = data.essays.find((item) => item.key === essayKey);
      const topic = essay ? topicById.get(essay.topicId) : null;
      const essayMethodKeys = [...valuesByMethod.keys()].sort(compareMethodKeys);
      const rows = describePairwiseRanking(essayMethodKeys, valuesByMethod, essayComparisons.get(essayKey) || []).map((row) => ({
        ...row,
        ...(automaticByMethod.get(row.methodKey) || {}),
        rankDelta:
          automaticByMethod.has(row.methodKey) && Number.isFinite(row.btRank)
            ? row.btRank - automaticByMethod.get(row.methodKey).automaticSurveyRank
            : null
      }));
      return {
        essayId: essay?._id || "",
        essayKey,
        essayTitle: essay?.title || essayKey,
        topicKey: topic?.key || "",
        topicTitle: topic?.title || "",
        methodRows: rows,
        annotatorRows: (annotatorRankingsByEssay.get(essayKey) || []).sort(
          (a, b) =>
            a.participantCode.localeCompare(b.participantCode) ||
            compareMethodKeys(a.methodKey, b.methodKey) ||
            a.humanRank - b.humanRank
        )
      };
    })
    .sort((a, b) => a.essayKey.localeCompare(b.essayKey));

  const rowsWithAutomaticRank = overallRows
    .filter((row) => Number.isFinite(row.btRank) && Number.isFinite(row.automaticSurveyRank))
    .map((row) => ({ humanRank: row.btRank, automaticRank: row.automaticSurveyRank }));

  return {
    overallRows,
    essayRows,
    spearman: spearmanCorrelation(rowsWithAutomaticRank),
    comparisonCount: overallComparisons.length,
    note:
      data.automaticRankings.some((ranking) => ranking.surveyMethodKey)
        ? "Human ranks use only the final overall-helpfulness question. Automatic ranks are overall method-level ranks from the imported automatic CSV; no per-essay automatic ranks are present in that CSV."
        : "Import automatic rankings to compare human ranks against automatic ranks."
  };
}

function winnerForMeans(firstValue, secondValue, methodFirst, methodSecond) {
  if (!Number.isFinite(firstValue) || !Number.isFinite(secondValue)) {
    return { preferredMethodKey: null, winnerInCanonicalOrder: null };
  }
  if (firstValue > secondValue) {
    return { preferredMethodKey: methodFirst, winnerInCanonicalOrder: "first" };
  }
  if (firstValue < secondValue) {
    return { preferredMethodKey: methodSecond, winnerInCanonicalOrder: "second" };
  }
  return { preferredMethodKey: "tie", winnerInCanonicalOrder: "tie" };
}

function matchesPreference(humanWinner, automaticWinner) {
  if (!humanWinner || !automaticWinner) return null;
  return humanWinner === automaticWinner;
}

function pairwiseHumanVotesByEssay(data) {
  const feedbackById = new Map(data.feedbacks.map((feedback) => [feedback._id, feedback]));
  const questionById = new Map(data.questions.map((question) => [question._id, question]));
  const essayById = new Map(data.essays.map((essay) => [essay._id, essay]));
  const contexts = new Map();

  for (const response of data.responses) {
    const feedback = feedbackById.get(response.feedbackId);
    const question = questionById.get(response.questionId);
    const essay = essayById.get(response.essayId);
    if (!feedback || !essay || question?.key !== OVERALL_HELPFULNESS_QUESTION_KEY || !Number.isFinite(response.value)) continue;
    const contextKey = `${response.participantId}:${essay.key}`;
    const context = contexts.get(contextKey) || {
      essayKey: essay.key,
      participantId: response.participantId,
      methods: new Map()
    };
    context.methods.set(feedback.methodKey, response.value);
    contexts.set(contextKey, context);
  }

  const pairRows = new Map();
  for (const context of contexts.values()) {
    const methodValues = [...context.methods.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (let i = 0; i < methodValues.length; i += 1) {
      for (let j = i + 1; j < methodValues.length; j += 1) {
        const [methodFirst, valueFirst] = methodValues[i];
        const [methodSecond, valueSecond] = methodValues[j];
        const key = `${context.essayKey}:${methodFirst}|${methodSecond}`;
        const row = pairRows.get(key) || {
          essayKey: context.essayKey,
          canonicalPairKey: `${methodFirst}|${methodSecond}`,
          methodFirst,
          methodSecond,
          valuesFirst: [],
          valuesSecond: [],
          humanVotesFirst: 0,
          humanVotesSecond: 0,
          humanTies: 0,
          humanPairedCount: 0
        };
        row.valuesFirst.push(valueFirst);
        row.valuesSecond.push(valueSecond);
        row.humanPairedCount += 1;
        if (valueFirst > valueSecond) {
          row.humanVotesFirst += 1;
        } else if (valueFirst < valueSecond) {
          row.humanVotesSecond += 1;
        } else {
          row.humanTies += 1;
        }
        pairRows.set(key, row);
      }
    }
  }

  return pairRows;
}

function pairwiseDeepComparison(data) {
  const humanPairs = pairwiseHumanVotesByEssay(data);
  const rows = data.automaticPairwiseDetails.map((detail) => {
    const human = humanPairs.get(`${detail.essayKey}:${detail.canonicalPairKey}`);
    const humanMeanFirst = human?.valuesFirst?.length ? human.valuesFirst.reduce((sum, value) => sum + value, 0) / human.valuesFirst.length : null;
    const humanMeanSecond = human?.valuesSecond?.length ? human.valuesSecond.reduce((sum, value) => sum + value, 0) / human.valuesSecond.length : null;
    const humanMeanPreference = winnerForMeans(humanMeanFirst, humanMeanSecond, detail.methodFirst, detail.methodSecond);
    const humanVotePreference =
      human && human.humanVotesFirst > human.humanVotesSecond
        ? { preferredMethodKey: detail.methodFirst, winnerInCanonicalOrder: "first" }
        : human && human.humanVotesFirst < human.humanVotesSecond
          ? { preferredMethodKey: detail.methodSecond, winnerInCanonicalOrder: "second" }
          : human
            ? { preferredMethodKey: "tie", winnerInCanonicalOrder: "tie" }
            : { preferredMethodKey: null, winnerInCanonicalOrder: null };
    return {
      pairwiseDetailId: detail._id,
      essayKey: detail.essayKey,
      topic: detail.topic || "",
      gradeLevel: detail.gradeLevel || "",
      groupKey: detail.groupKey || "",
      groupLabel: detail.groupLabel || "",
      orderInGroup: detail.orderInGroup ?? null,
      confirmed: detail.confirmed,
      canonicalPairKey: detail.canonicalPairKey,
      methodFirst: detail.methodFirst,
      methodSecond: detail.methodSecond,
      combinedRankFirst: detail.combinedRankFirst ?? null,
      combinedAbilityFirst: detail.combinedAbilityFirst ?? null,
      combinedRankSecond: detail.combinedRankSecond ?? null,
      combinedAbilitySecond: detail.combinedAbilitySecond ?? null,
      majorityPreferredMethodKey: detail.majorityPreferredMethodKey || null,
      majorityWinnerInCanonicalOrder: detail.majorityWinnerInCanonicalOrder || null,
      majorityVoteCount: detail.majorityVoteCount ?? null,
      validJudgeVoteCount: detail.validJudgeVoteCount,
      invalidJudgeVoteCount: detail.invalidJudgeVoteCount,
      judgeUnanimous: detail.judgeUnanimous,
      gemmaWinnerInCanonicalOrder: detail.gemmaWinnerInCanonicalOrder || null,
      gemmaPreferredMethodKey: detail.gemmaPreferredMethodKey || null,
      llamaWinnerInCanonicalOrder: detail.llamaWinnerInCanonicalOrder || null,
      llamaPreferredMethodKey: detail.llamaPreferredMethodKey || null,
      openaiWinnerInCanonicalOrder: detail.openaiWinnerInCanonicalOrder || null,
      openaiPreferredMethodKey: detail.openaiPreferredMethodKey || null,
      humanMeanFirst,
      humanMeanSecond,
      humanMeanPreferredMethodKey: humanMeanPreference.preferredMethodKey,
      humanMeanWinnerInCanonicalOrder: humanMeanPreference.winnerInCanonicalOrder,
      humanVotePreferredMethodKey: humanVotePreference.preferredMethodKey,
      humanVoteWinnerInCanonicalOrder: humanVotePreference.winnerInCanonicalOrder,
      humanVotesFirst: human?.humanVotesFirst || 0,
      humanVotesSecond: human?.humanVotesSecond || 0,
      humanTies: human?.humanTies || 0,
      humanPairedCount: human?.humanPairedCount || 0,
      humanMatchesMajority: matchesPreference(humanVotePreference.winnerInCanonicalOrder, detail.majorityWinnerInCanonicalOrder || null),
      humanMatchesCombinedRank: matchesPreference(humanMeanPreference.winnerInCanonicalOrder, winnerForMeans(
        detail.combinedAbilityFirst ?? null,
        detail.combinedAbilitySecond ?? null,
        detail.methodFirst,
        detail.methodSecond
      ).winnerInCanonicalOrder),
      humanMatchesGemma: matchesPreference(humanVotePreference.winnerInCanonicalOrder, detail.gemmaWinnerInCanonicalOrder || null),
      humanMatchesLlama: matchesPreference(humanVotePreference.winnerInCanonicalOrder, detail.llamaWinnerInCanonicalOrder || null),
      humanMatchesOpenai: matchesPreference(humanVotePreference.winnerInCanonicalOrder, detail.openaiWinnerInCanonicalOrder || null)
    };
  });

  const rowsWithHuman = rows.filter((row) => row.humanVoteWinnerInCanonicalOrder);
  const countMatches = (field) => rowsWithHuman.filter((row) => row[field] === true).length;
  const byEssay = [...new Map(rows.map((row) => [row.essayKey, row])).values()]
    .map((essay) => {
      const essayRows = rows.filter((row) => row.essayKey === essay.essayKey);
      const withHuman = essayRows.filter((row) => row.humanVoteWinnerInCanonicalOrder);
      return {
        essayKey: essay.essayKey,
        topic: essay.topic,
        gradeLevel: essay.gradeLevel,
        groupLabel: essay.groupLabel,
        pairCount: essayRows.length,
        humanPairCount: withHuman.length,
        majorityMatches: withHuman.filter((row) => row.humanMatchesMajority === true).length,
        unanimousCount: essayRows.filter((row) => row.judgeUnanimous).length,
        rows: essayRows
      };
    })
    .sort((a, b) => a.essayKey.localeCompare(b.essayKey));

  return {
    totalPairs: rows.length,
    humanComparedPairs: rowsWithHuman.length,
    majorityMatches: countMatches("humanMatchesMajority"),
    combinedRankMatches: countMatches("humanMatchesCombinedRank"),
    gemmaMatches: countMatches("humanMatchesGemma"),
    llamaMatches: countMatches("humanMatchesLlama"),
    openaiMatches: countMatches("humanMatchesOpenai"),
    unanimousPairs: rows.filter((row) => row.judgeUnanimous).length,
    disagreementRows: rowsWithHuman.filter((row) => row.humanMatchesMajority === false),
    byEssay
  };
}

function groupedRatingRows(data) {
  const feedbackById = new Map(data.feedbacks.map((feedback) => [feedback._id, feedback]));
  const essayById = new Map(data.essays.map((essay) => [essay._id, essay]));
  const topicById = new Map(data.topics.map((topic) => [topic._id, topic]));
  const questionById = new Map(data.questions.map((question) => [question._id, question]));
  const rows = [];

  for (const response of data.responses) {
    const feedback = feedbackById.get(response.feedbackId);
    const essay = essayById.get(response.essayId);
    const topic = essay ? topicById.get(essay.topicId) : null;
    const question = questionById.get(response.questionId);
    if (!feedback || !essay || !question || !Number.isFinite(response.value)) continue;
    rows.push({
      value: response.value,
      methodKey: feedback.methodKey,
      questionId: question._id,
      questionKey: question.key,
      questionText: question.text,
      questionOrder: question.order,
      essayId: essay._id,
      essayKey: essay.key,
      essayTitle: essay.title,
      topicKey: topic?.key || "",
      topicTitle: topic?.title || ""
    });
  }

  return rows;
}

function pushGroupedValue(groups, key, meta, value) {
  const group = groups.get(key) || { ...meta, values: [] };
  group.values.push(value);
  groups.set(key, group);
}

function countsByLikert(values) {
  const counts = [1, 2, 3, 4, 5, 6, 7].map((value) => ({
    value,
    count: values.filter((rating) => rating === value).length
  }));
  return counts;
}

function resultsAnalytics(data) {
  const rows = groupedRatingRows(data);
  const methodGroups = new Map();
  const questionGroups = new Map();
  const methodQuestionGroups = new Map();
  const essayMethodGroups = new Map();

  for (const row of rows) {
    pushGroupedValue(methodGroups, row.methodKey, { methodKey: row.methodKey }, row.value);
    pushGroupedValue(
      questionGroups,
      row.questionKey,
      { questionKey: row.questionKey, questionText: row.questionText, questionOrder: row.questionOrder },
      row.value
    );
    pushGroupedValue(
      methodQuestionGroups,
      `${row.questionKey}:${row.methodKey}`,
      { questionKey: row.questionKey, questionText: row.questionText, questionOrder: row.questionOrder, methodKey: row.methodKey },
      row.value
    );
    pushGroupedValue(
      essayMethodGroups,
      `${row.essayKey}:${row.methodKey}`,
      {
        essayKey: row.essayKey,
        essayTitle: row.essayTitle,
        topicKey: row.topicKey,
        topicTitle: row.topicTitle,
        methodKey: row.methodKey
      },
      row.value
    );
  }

  const methodStats = [...methodGroups.values()]
    .map((group) => ({
      methodKey: group.methodKey,
      ...describeValues(group.values)
    }))
    .sort((a, b) => compareMethodKeys(a.methodKey, b.methodKey));

  const questionStats = [...questionGroups.values()]
    .map((group) => ({
      questionKey: group.questionKey,
      questionText: group.questionText,
      questionOrder: group.questionOrder,
      ...describeValues(group.values)
    }))
    .sort((a, b) => a.questionOrder - b.questionOrder);

  const methodQuestionStats = [...methodQuestionGroups.values()]
    .map((group) => ({
      questionKey: group.questionKey,
      questionText: group.questionText,
      questionOrder: group.questionOrder,
      methodKey: group.methodKey,
      ...describeValues(group.values)
    }))
    .sort((a, b) => a.questionOrder - b.questionOrder || compareMethodKeys(a.methodKey, b.methodKey));

  const essayMethodStats = [...essayMethodGroups.values()]
    .map((group) => ({
      essayKey: group.essayKey,
      essayTitle: group.essayTitle,
      topicKey: group.topicKey,
      topicTitle: group.topicTitle,
      methodKey: group.methodKey,
      ...describeValues(group.values)
    }))
    .sort((a, b) => a.essayKey.localeCompare(b.essayKey) || compareMethodKeys(a.methodKey, b.methodKey));

  const ratingDistributions = [...methodGroups.values()]
    .map((group) => ({
      methodKey: group.methodKey,
      count: group.values.length,
      mean: describeValues(group.values).mean,
      counts: countsByLikert(group.values)
    }))
    .sort((a, b) => compareMethodKeys(a.methodKey, b.methodKey));

  return {
    methodStats,
    questionStats,
    methodQuestionStats,
    essayMethodStats,
    ratingDistributions,
    methodComparisons: methodComparisons(data),
    automaticRankingComparison: automaticRankingComparison(data),
    humanRankingComparison: humanRankingComparison(data),
    pairwiseDeepComparison: pairwiseDeepComparison(data)
  };
}

function editableResponseRows(data) {
  const participantById = new Map(data.participants.map((participant) => [participant._id, participant]));
  const groupById = new Map(data.groups.map((group) => [group._id, group]));
  const essayById = new Map(data.essays.map((essay) => [essay._id, essay]));
  const topicById = new Map(data.topics.map((topic) => [topic._id, topic]));
  const feedbackById = new Map(data.feedbacks.map((feedback) => [feedback._id, feedback]));
  const questionById = new Map(data.questions.map((question) => [question._id, question]));

  return data.responses
    .map((response) => {
      const participant = participantById.get(response.participantId);
      const group = participant ? groupById.get(participant.groupId) : null;
      const essay = essayById.get(response.essayId);
      const topic = essay ? topicById.get(essay.topicId) : null;
      const feedback = feedbackById.get(response.feedbackId);
      const question = questionById.get(response.questionId);
      if (!participant || !essay || !feedback || !question) return null;
      return {
        responseId: response._id,
        value: response.value,
        updatedAt: response.updatedAt,
        participantId: participant._id,
        participantPseudonym: participant.pseudonym,
        participantCode: participant.code,
        participantStatus: participant.status,
        groupId: participant.groupId,
        groupKey: group?.key || "",
        groupName: group?.name || "",
        topicKey: topic?.key || "",
        topicTitle: topic?.title || "",
        essayId: essay._id,
        essayKey: essay.key,
        essayTitle: essay.title,
        feedbackId: feedback._id,
        methodKey: feedback.methodKey,
        feedbackText: feedback.text,
        feedbackOrder: feedback.setupOrder,
        questionId: question._id,
        questionKey: question.key,
        questionText: question.text,
        questionOrder: question.order,
        questionLabels: question.labels
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.participantCode.localeCompare(b.participantCode) ||
        a.essayKey.localeCompare(b.essayKey) ||
        a.questionOrder - b.questionOrder ||
        compareMethodKeys(a.methodKey, b.methodKey) ||
        a.feedbackOrder - b.feedbackOrder
    );
}

function methodComparisons(data) {
  const feedbackById = new Map(data.feedbacks.map((feedback) => [feedback._id, feedback]));
  const questionById = new Map(data.questions.map((question) => [question._id, question]));
  const responsesByRatingContext = new Map();

  for (const response of data.responses) {
    const feedback = feedbackById.get(response.feedbackId);
    const question = questionById.get(response.questionId);
    if (!feedback || !question || !Number.isFinite(response.value)) continue;
    const key = `${response.participantId}:${response.essayId}:${response.questionId}`;
    const context = responsesByRatingContext.get(key) || {
      question,
      methods: new Map()
    };
    const values = context.methods.get(feedback.methodKey) || [];
    values.push(response.value);
    context.methods.set(feedback.methodKey, values);
    responsesByRatingContext.set(key, context);
  }

  const rows = new Map();
  for (const context of responsesByRatingContext.values()) {
    const methodValues = [...context.methods.entries()]
      .map(([methodKey, values]) => ({
        methodKey,
        value: values.reduce((sum, value) => sum + value, 0) / values.length
      }))
      .sort((a, b) => compareMethodKeys(a.methodKey, b.methodKey));

    for (let i = 0; i < methodValues.length; i += 1) {
      for (let j = i + 1; j < methodValues.length; j += 1) {
        const methodA = methodValues[i];
        const methodB = methodValues[j];
        const delta = methodA.value - methodB.value;
        const questionScope = {
          key: context.question.key,
          label: context.question.key,
          sort: context.question.order + 1
        };
        addComparison(rows, { key: "all", label: "Alle Kriterien", sort: 0 }, methodA.methodKey, methodB.methodKey, delta);
        addComparison(rows, questionScope, methodA.methodKey, methodB.methodKey, delta);
      }
    }
  }

  return [...rows.values()]
    .map((row) => {
      const meanDelta = row.deltaSum / row.pairedCount;
      return {
        scopeKey: row.scopeKey,
        scopeLabel: row.scopeLabel,
        methodA: row.methodA,
        methodB: row.methodB,
        winsA: row.winsA,
        ties: row.ties,
        winsB: row.winsB,
        pairedCount: row.pairedCount,
        meanDelta,
        winner: meanDelta > 0 ? row.methodA : meanDelta < 0 ? row.methodB : "Gleichstand"
      };
    })
    .sort((a, b) => {
      const sortA = a.scopeKey === "all" ? 0 : (data.questions.find((question) => question.key === a.scopeKey)?.order || 0) + 1;
      const sortB = b.scopeKey === "all" ? 0 : (data.questions.find((question) => question.key === b.scopeKey)?.order || 0) + 1;
      if (sortA !== sortB) return sortA - sortB;
      const methodSort = compareMethodKeys(a.methodA, b.methodA);
      return methodSort || compareMethodKeys(a.methodB, b.methodB);
    });
}

export const dashboard = query({
  args: { adminPassword: v.string() },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    const data = await getStudyData(ctx);
    const stats = completionStats(data);
    const validationErrors = validateData(data);
    const alpha = agreement(data);
    const analytics = resultsAnalytics(data);
    return {
      settings: data.settings,
      groups: data.groups,
      participants: data.participants,
      topics: await resolveTopicPromptImages(ctx, data.topics),
      essays: data.essays,
      feedbacks: data.feedbacks,
      automaticRankings: data.automaticRankings,
      automaticPairwiseDetails: data.automaticPairwiseDetails,
      questions: data.questions,
      assignments: data.assignments,
      responseCount: data.responses.length,
      completion: {
        ...stats,
        percent: stats.required ? Math.round((stats.answered / stats.required) * 100) : 0,
        completedParticipants: data.participants.filter((item) => item.status === "completed").length
      },
      validationErrors,
      agreement: alpha,
      resultsAnalytics: analytics,
      methodComparisons: analytics.methodComparisons,
      editableResponses: editableResponseRows(data)
    };
  }
});

export const importParticipantGroups = mutation({
  args: {
    adminPassword: v.string(),
    groups: v.array(
      v.object({
        groupKey: v.string(),
        names: v.array(v.string())
      })
    )
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    const responses = await collect(ctx, "responses");
    if (responses.length > 0) throw new Error("Teilnehmende können nach Antworten nicht ersetzt werden.");
    await clearTables(ctx, ["participantFeedbackOrders", "participants", "groups", "groupEssayAssignments"]);
    await ensureSettings(ctx);
    await ensureFixedQuestions(ctx);

    for (let groupIndex = 0; groupIndex < args.groups.length; groupIndex += 1) {
      const groupInput = args.groups[groupIndex];
      const key = groupInput.groupKey.trim().toUpperCase();
      const initial = key.slice(0, 1) || String.fromCharCode(65 + groupIndex);
      const groupId = await ctx.db.insert("groups", {
        key,
        name: `Gruppe ${key}`,
        initial,
        order: groupIndex
      });
      const cleanNames = groupInput.names.map((name) => name.trim()).filter(Boolean);
      for (let participantIndex = 0; participantIndex < cleanNames.length; participantIndex += 1) {
        await ctx.db.insert("participants", {
          inviteName: cleanNames[participantIndex],
          pseudonym: pseudonymFor(initial, participantIndex),
          code: `${key}-${String(participantIndex + 1).padStart(2, "0")}`,
          groupId,
          token: token(),
          status: "not_started",
          updatedAt: now()
        });
      }
    }

    return { ok: true };
  }
});

export const importMaterials = mutation({
  args: {
    adminPassword: v.string(),
    rows: v.array(
      v.object({
        topicKey: v.string(),
        topicTitle: v.string(),
        prompt: v.string(),
        promptImageUrl: v.optional(v.string()),
        essayKey: v.string(),
        essayTitle: v.string(),
        gradeLevel: v.optional(v.string()),
        essayText: v.string(),
        methodKey: v.string(),
        feedbackText: v.string()
      })
    )
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    const responses = await collect(ctx, "responses");
    if (responses.length > 0) throw new Error("Materialien können nach Antworten nicht ersetzt werden.");
    await clearTables(ctx, ["participantFeedbackOrders", "groupEssayAssignments", "feedbacks", "essays", "topics"]);
    await ensureSettings(ctx);
    await ensureFixedQuestions(ctx);

    const topicIds = new Map();
    const essayIds = new Map();
    const essayGrades = new Map();
    for (const row of args.rows) {
      const topicKey = slug(row.topicKey || row.topicTitle);
      if (!topicKey) continue;
      let topicId = topicIds.get(topicKey);
      if (!topicId) {
        topicId = await ctx.db.insert("topics", {
          key: topicKey,
          title: row.topicTitle || row.topicKey,
          prompt: row.prompt,
          promptImageUrl: row.promptImageUrl || undefined,
          order: topicIds.size
        });
        topicIds.set(topicKey, topicId);
      }

      const essayKey = slug(row.essayKey || row.essayTitle);
      const essayMapKey = `${topicKey}:${essayKey}`;
      let essayId = essayIds.get(essayMapKey);
      const gradeLevel = normalizeGradeLevel(row.gradeLevel);
      if (!gradeLevel) {
        throw new Error(`Essay ${row.essayKey || row.essayTitle} benötigt gradeLevel 5 oder 9.`);
      }
      const existingGrade = essayGrades.get(essayMapKey);
      if (existingGrade && existingGrade !== gradeLevel) {
        throw new Error(`Essay ${row.essayKey || row.essayTitle} hat widersprüchliche gradeLevel-Werte.`);
      }
      essayGrades.set(essayMapKey, gradeLevel);
      if (!essayId) {
        essayId = await ctx.db.insert("essays", {
          topicId,
          key: essayKey,
          title: row.essayTitle || row.essayKey,
          gradeLevel: gradeLevel || undefined,
          text: row.essayText,
          order: essayIds.size
        });
        essayIds.set(essayMapKey, essayId);
      }

      await ctx.db.insert("feedbacks", {
        essayId,
        methodKey: row.methodKey.trim(),
        text: row.feedbackText,
        setupOrder: 0
      });
    }

    return { ok: true };
  }
});

export const importAutomaticRankings = mutation({
  args: {
    adminPassword: v.string(),
    rows: v.array(
      v.object({
        surveyMethodKey: v.optional(v.string()),
        autoApproachKey: v.string(),
        displayName: v.string(),
        isCurrentManualAnnotationMethod: v.boolean(),
        materialFeedbackRows: v.optional(v.number()),
        combinedRank: v.number(),
        combinedAbility: v.number(),
        combinedScore: v.number(),
        combinedWins: v.number(),
        combinedLosses: v.number(),
        combinedTies: v.number(),
        combinedComparisons: v.number(),
        gemmaRank: v.optional(v.number()),
        gemmaAbility: v.optional(v.number()),
        gemmaScore: v.optional(v.number()),
        gemmaWins: v.optional(v.number()),
        gemmaLosses: v.optional(v.number()),
        gemmaTies: v.optional(v.number()),
        gemmaComparisons: v.optional(v.number()),
        llamaRank: v.optional(v.number()),
        llamaAbility: v.optional(v.number()),
        llamaScore: v.optional(v.number()),
        llamaWins: v.optional(v.number()),
        llamaLosses: v.optional(v.number()),
        llamaTies: v.optional(v.number()),
        llamaComparisons: v.optional(v.number()),
        openaiRank: v.optional(v.number()),
        openaiAbility: v.optional(v.number()),
        openaiScore: v.optional(v.number()),
        openaiWins: v.optional(v.number()),
        openaiLosses: v.optional(v.number()),
        openaiTies: v.optional(v.number()),
        openaiComparisons: v.optional(v.number()),
        rankingGeneratedAt: v.optional(v.string()),
        rankingDescription: v.optional(v.string()),
        rankingSourceModels: v.optional(v.string())
      })
    )
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    if (args.rows.length === 0) {
      throw new Error("Die automatische Ranking-CSV enthält keine importierbaren Zeilen.");
    }

    const autoApproachKeys = new Set();
    const surveyMethodKeys = new Set();
    for (const row of args.rows) {
      const autoApproachKey = row.autoApproachKey.trim();
      const surveyMethodKey = row.surveyMethodKey?.trim() || "";
      if (!autoApproachKey) {
        throw new Error("Jede automatische Ranking-Zeile benötigt autoApproachKey.");
      }
      if (autoApproachKeys.has(autoApproachKey)) {
        throw new Error(`Doppelter autoApproachKey in automatischen Rankings: ${autoApproachKey}`);
      }
      autoApproachKeys.add(autoApproachKey);
      if (surveyMethodKey) {
        if (surveyMethodKeys.has(surveyMethodKey)) {
          throw new Error(`Doppelter surveyMethodKey in automatischen Rankings: ${surveyMethodKey}`);
        }
        surveyMethodKeys.add(surveyMethodKey);
      }
    }

    await clearTables(ctx, ["automaticMethodRankings"]);
    const importedAt = now();
    for (const row of args.rows) {
      const surveyMethodKey = row.surveyMethodKey?.trim() || undefined;
      await ctx.db.insert("automaticMethodRankings", {
        ...row,
        surveyMethodKey,
        autoApproachKey: row.autoApproachKey.trim(),
        displayName: row.displayName.trim() || row.autoApproachKey.trim(),
        rankingGeneratedAt: row.rankingGeneratedAt?.trim() || undefined,
        rankingDescription: row.rankingDescription?.trim() || undefined,
        rankingSourceModels: row.rankingSourceModels?.trim() || undefined,
        importedAt
      });
    }

    const feedbackMethodKeys = [...new Set((await collect(ctx, "feedbacks")).map((feedback) => feedback.methodKey))].sort((a, b) =>
      a.localeCompare(b)
    );
    return {
      ok: true,
      importedRows: args.rows.length,
      mappedSurveyMethods: surveyMethodKeys.size,
      unmappedAutomaticApproaches: args.rows.length - surveyMethodKeys.size,
      missingSurveyMethodKeys: feedbackMethodKeys.filter((methodKey) => !surveyMethodKeys.has(methodKey))
    };
  }
});

export const importAutomaticPairwiseDetails = mutation({
  args: {
    adminPassword: v.string(),
    rows: v.array(
      v.object({
        essayKey: v.string(),
        topic: v.optional(v.string()),
        gradeLevel: v.optional(v.string()),
        groupKey: v.optional(v.string()),
        groupLabel: v.optional(v.string()),
        orderInGroup: v.optional(v.number()),
        confirmed: v.boolean(),
        canonicalPairKey: v.string(),
        methodFirst: v.string(),
        methodSecond: v.string(),
        combinedRankFirst: v.optional(v.number()),
        combinedAbilityFirst: v.optional(v.number()),
        combinedRankSecond: v.optional(v.number()),
        combinedAbilitySecond: v.optional(v.number()),
        validJudgeVoteCount: v.number(),
        invalidJudgeVoteCount: v.number(),
        majorityPreferredMethodKey: v.optional(v.string()),
        majorityWinnerInCanonicalOrder: v.optional(v.string()),
        majorityVoteCount: v.optional(v.number()),
        judgeUnanimous: v.boolean(),
        gemmaWinnerInCanonicalOrder: v.optional(v.string()),
        gemmaPreferredMethodKey: v.optional(v.string()),
        gemmaRankFirst: v.optional(v.number()),
        gemmaRankSecond: v.optional(v.number()),
        llamaWinnerInCanonicalOrder: v.optional(v.string()),
        llamaPreferredMethodKey: v.optional(v.string()),
        llamaRankFirst: v.optional(v.number()),
        llamaRankSecond: v.optional(v.number()),
        openaiWinnerInCanonicalOrder: v.optional(v.string()),
        openaiPreferredMethodKey: v.optional(v.string()),
        openaiRankFirst: v.optional(v.number()),
        openaiRankSecond: v.optional(v.number()),
        importedHumanPreferredMethodKey: v.optional(v.string()),
        importedHumanWinnerInCanonicalOrder: v.optional(v.string()),
        importedHumanMeanFirst: v.optional(v.number()),
        importedHumanMeanSecond: v.optional(v.number()),
        importedHumanRankFirst: v.optional(v.number()),
        importedHumanRankSecond: v.optional(v.number()),
        importedHumanMatchesMajorityPreferredMethod: v.optional(v.boolean()),
        importedHumanMatchesCombinedBradleyTerryOrder: v.optional(v.boolean()),
        importedHumanNotes: v.optional(v.string())
      })
    )
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    if (args.rows.length === 0) {
      throw new Error("Die Pairwise-Details-CSV enthält keine importierbaren Zeilen.");
    }

    const rowKeys = new Set();
    for (const row of args.rows) {
      const essayKey = row.essayKey.trim();
      const canonicalPairKey = row.canonicalPairKey.trim();
      if (!essayKey || !canonicalPairKey || !row.methodFirst.trim() || !row.methodSecond.trim()) {
        throw new Error("Jede Pairwise-Details-Zeile benötigt essayKey, canonicalPairKey, methodFirst und methodSecond.");
      }
      const rowKey = `${essayKey}:${canonicalPairKey}`;
      if (rowKeys.has(rowKey)) {
        throw new Error(`Doppelte Pairwise-Details-Zeile: ${rowKey}`);
      }
      rowKeys.add(rowKey);
    }

    await clearTables(ctx, ["automaticPairwiseDetails"]);
    const importedAt = now();
    for (const row of args.rows) {
      await ctx.db.insert("automaticPairwiseDetails", {
        ...row,
        essayKey: row.essayKey.trim(),
        canonicalPairKey: row.canonicalPairKey.trim(),
        methodFirst: row.methodFirst.trim(),
        methodSecond: row.methodSecond.trim(),
        importedAt
      });
    }

    const essayKeys = new Set((await collect(ctx, "essays")).map((essay) => essay.key));
    return {
      ok: true,
      importedRows: args.rows.length,
      unmatchedEssayKeys: [...new Set(args.rows.map((row) => row.essayKey).filter((essayKey) => !essayKeys.has(essayKey)))].sort((a, b) =>
        a.localeCompare(b)
      )
    };
  }
});

export const syncFixedQuestions = mutation({
  args: { adminPassword: v.string() },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    await ensureFixedQuestions(ctx);
    return { ok: true };
  }
});

export const generateAssignments = mutation({
  args: { adminPassword: v.string() },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    await ensureFixedQuestions(ctx);
    const data = await getStudyData(ctx);
    const responses = await collect(ctx, "responses");
    if (responses.length > 0) throw new Error("Zuweisungen können nach Antworten nicht neu generiert werden.");
    await clearTables(ctx, ["participantFeedbackOrders", "groupEssayAssignments"]);

    const topics = shuffle(data.topics);
    const groups = shuffle(data.groups);
    const gradeLevels = ["5", "9"];
    if (topics.length !== 3 || groups.length !== 6) {
      throw new Error(
        `Für die Randomisierung werden genau 3 Themen und 6 Gruppen benötigt. Aktuell gefunden: ${topics.length} Themen und ${groups.length} Gruppen. Importiere zuerst Materialien und Teilnehmende.`
      );
    }
    const topicGradeCounts = [];
    for (const topic of topics) {
      for (const gradeLevel of gradeLevels) {
        const count = data.essays.filter((essay) => essay.topicId === topic._id && normalizeGradeLevel(essay.gradeLevel) === gradeLevel).length;
        if (count === 0) throw new Error(`Thema ${topic.title} braucht Essays für Klasse ${gradeLevel}.`);
        topicGradeCounts.push(count);
      }
    }
    if (new Set(topicGradeCounts).size > 1) {
      throw new Error("Alle Thema-Klassenstufe-Kombinationen müssen gleich viele Essays haben.");
    }

    for (let topicIndex = 0; topicIndex < topics.length; topicIndex += 1) {
      const topic = topics[topicIndex];
      const topicGroups = groups.slice(topicIndex * 2, topicIndex * 2 + 2);
      const topicGrades = shuffle(gradeLevels);
      for (let groupIndex = 0; groupIndex < topicGroups.length; groupIndex += 1) {
        const group = topicGroups[groupIndex];
        const gradeLevel = topicGrades[groupIndex];
        const essaysForGroup = shuffle(
          data.essays.filter((essay) => essay.topicId === topic._id && normalizeGradeLevel(essay.gradeLevel) === gradeLevel)
        );
        if (essaysForGroup.length === 0) {
          throw new Error(`Thema ${topic.title} braucht Essays für Klasse ${gradeLevel}.`);
        }
        await ctx.db.patch(group._id, { topicId: topic._id, gradeLevel });
        for (let essayIndex = 0; essayIndex < essaysForGroup.length; essayIndex += 1) {
          await ctx.db.insert("groupEssayAssignments", {
            groupId: group._id,
            essayId: essaysForGroup[essayIndex]._id,
            order: essayIndex
          });
        }
      }
    }

    const allFeedbacks = await collect(ctx, "feedbacks");
    for (const essay of data.essays) {
      const feedbacks = shuffle(allFeedbacks.filter((feedback) => feedback.essayId === essay._id));
      for (let index = 0; index < feedbacks.length; index += 1) {
        await ctx.db.patch(feedbacks[index]._id, { setupOrder: index });
      }
    }

    const settings = await ensureSettings(ctx);
    await ctx.db.patch(settings._id, { generatedAt: now(), updatedAt: now() });
    return { ok: true };
  }
});

export const setStudyStatus = mutation({
  args: {
    adminPassword: v.string(),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("closed"))
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    await ensureFixedQuestions(ctx);
    const data = await getStudyData(ctx, { ensureSettings: true });
    if (args.status === "active") {
      const errors = validateData(data);
      if (errors.length) throw new Error(errors.join(" "));
    }
    await ctx.db.patch(data.settings._id, { status: args.status, updatedAt: now() });
    return { ok: true };
  }
});

export const updateFeedbackOrder = mutation({
  args: {
    adminPassword: v.string(),
    essayId: v.id("essays"),
    feedbackIds: v.array(v.id("feedbacks"))
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    const started = (await collect(ctx, "participants")).some((participant) => participant.startedAt);
    if (started) throw new Error("Feedbackreihenfolgen sind nach dem ersten Start eingefroren.");
    for (let index = 0; index < args.feedbackIds.length; index += 1) {
      await ctx.db.patch(args.feedbackIds[index], { setupOrder: index });
    }
    return { ok: true };
  }
});

export const generatePromptImageUploadUrl = mutation({
  args: { adminPassword: v.string() },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    return await ctx.storage.generateUploadUrl();
  }
});

export const saveTopicPromptImage = mutation({
  args: {
    adminPassword: v.string(),
    topicId: v.id("topics"),
    storageId: v.id("_storage")
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    await ctx.db.patch(args.topicId, {
      promptImageStorageId: args.storageId,
      promptImageUrl: undefined
    });
    return { ok: true };
  }
});

export const clearTopicPromptImage = mutation({
  args: {
    adminPassword: v.string(),
    topicId: v.id("topics")
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    await ctx.db.patch(args.topicId, {
      promptImageStorageId: undefined,
      promptImageUrl: undefined
    });
    return { ok: true };
  }
});

export const reopenParticipant = mutation({
  args: {
    adminPassword: v.string(),
    participantId: v.id("participants")
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    await ctx.db.patch(args.participantId, {
      status: "reopened",
      completedAt: undefined,
      updatedAt: now()
    });
    return { ok: true };
  }
});

export const updateResponse = mutation({
  args: {
    adminPassword: v.string(),
    responseId: v.id("responses"),
    value: v.number()
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    if (!Number.isInteger(args.value) || args.value < 1 || args.value > 7) {
      throw new Error("Bewertungen müssen ganzzahlig zwischen 1 und 7 sein.");
    }

    const response = await ctx.db.get(args.responseId);
    if (!response) {
      throw new Error("Bewertung wurde nicht gefunden.");
    }

    const participant = await ctx.db.get(response.participantId);
    const essay = await ctx.db.get(response.essayId);
    const feedback = await ctx.db.get(response.feedbackId);
    const question = await ctx.db.get(response.questionId);
    if (!participant || !essay || !feedback || !question || feedback.essayId !== response.essayId) {
      throw new Error("Bewertungskontext wurde nicht vollständig gefunden.");
    }

    const updatedAt = now();
    await ctx.db.patch(response._id, { value: args.value, updatedAt });
    await ctx.db.patch(participant._id, { updatedAt });
    return { ok: true };
  }
});

export const resetStudy = mutation({
  args: { adminPassword: v.string() },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    await clearTables(ctx, TABLES);
    await ensureSettings(ctx);
    await ensureFixedQuestions(ctx);
    return { ok: true };
  }
});

export const participantSurvey = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    const settings = await readSettings(ctx);
    if (!participant) return { kind: "missing", settings };
    if (settings.status === "draft") return { kind: "draft", settings, participant };
    if (settings.status === "closed") return { kind: "closed", settings, participant };
    if (participant.status === "completed") return { kind: "completed", settings, participant };

    const group = await ctx.db.get(participant.groupId);
    const assignments = (await ctx.db
      .query("groupEssayAssignments")
      .withIndex("by_group", (q) => q.eq("groupId", participant.groupId))
      .collect()).sort((a, b) => a.order - b.order);
    const topic = group?.topicId ? await resolveTopicPromptImage(ctx, await ctx.db.get(group.topicId)) : null;
    const questions = (await collect(ctx, "questions")).sort((a, b) => a.order - b.order);
    const orders = await ctx.db
      .query("participantFeedbackOrders")
      .withIndex("by_participant", (q) => q.eq("participantId", participant._id))
      .collect();
    const responses = await ctx.db
      .query("responses")
      .withIndex("by_participant", (q) => q.eq("participantId", participant._id))
      .collect();

    const essays = [];
    for (const assignment of assignments) {
      const essay = await ctx.db.get(assignment.essayId);
      if (!essay) continue;
      const setupFeedbacks = (await ctx.db
        .query("feedbacks")
        .withIndex("by_essay", (q) => q.eq("essayId", essay._id))
        .collect()).sort((a, b) => a.setupOrder - b.setupOrder);
      const order = orders.find((item) => item.essayId === essay._id);
      const feedbacks = order
        ? order.feedbackIds.map((id) => setupFeedbacks.find((feedback) => feedback._id === id)).filter(Boolean)
        : setupFeedbacks;
      essays.push({ ...essay, feedbacks });
    }

    const required = essays.length * 3 * questions.length;
    return {
      kind: "survey",
      settings,
      participant,
      group,
      topic,
      essays,
      questions,
      responses,
      completion: {
        required,
        answered: responses.length,
        percent: required ? Math.round((responses.length / required) * 100) : 0
      }
    };
  }
});

export const startParticipant = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    const settings = await ensureSettings(ctx);
    if (!participant || settings.status !== "active" || participant.status === "completed") return { ok: false };
    if (!participant.startedAt) {
      const startedAt = now();
      await ctx.db.patch(participant._id, { startedAt, status: "started", updatedAt: startedAt });
      await scheduleSurveyLifecycleEmail(ctx, "started", participant, startedAt);
    }
    const assignments = await ctx.db
      .query("groupEssayAssignments")
      .withIndex("by_group", (q) => q.eq("groupId", participant.groupId))
      .collect();
    for (const assignment of assignments) {
      const existing = await ctx.db
        .query("participantFeedbackOrders")
        .withIndex("by_participant_essay", (q) => q.eq("participantId", participant._id).eq("essayId", assignment.essayId))
        .first();
      if (existing) continue;
      const feedbackIds = (await ctx.db
        .query("feedbacks")
        .withIndex("by_essay", (q) => q.eq("essayId", assignment.essayId))
        .collect())
        .sort((a, b) => a.setupOrder - b.setupOrder)
        .map((feedback) => feedback._id);
      await ctx.db.insert("participantFeedbackOrders", {
        participantId: participant._id,
        essayId: assignment.essayId,
        feedbackIds
      });
    }
    return { ok: true };
  }
});

export const saveDemographics = mutation({
  args: {
    token: v.string(),
    age: v.string(),
    germanProficiency: v.string()
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!participant || participant.status === "completed") return { ok: false };
    await ctx.db.patch(participant._id, {
      age: args.age,
      germanProficiency: args.germanProficiency,
      updatedAt: now()
    });
    return { ok: true };
  }
});

export const saveResponse = mutation({
  args: {
    token: v.string(),
    essayId: v.id("essays"),
    feedbackId: v.id("feedbacks"),
    questionId: v.id("questions"),
    value: v.number()
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!participant || participant.status === "completed") return { ok: false };
    const existing = await ctx.db
      .query("responses")
      .withIndex("by_participant_item", (q) =>
        q.eq("participantId", participant._id).eq("essayId", args.essayId).eq("feedbackId", args.feedbackId)
      )
      .collect();
    const response = existing.find((item) => item.questionId === args.questionId);
    if (response) {
      await ctx.db.patch(response._id, { value: args.value, updatedAt: now() });
    } else {
      await ctx.db.insert("responses", {
        participantId: participant._id,
        essayId: args.essayId,
        feedbackId: args.feedbackId,
        questionId: args.questionId,
        value: args.value,
        updatedAt: now()
      });
    }
    await ctx.db.patch(participant._id, { updatedAt: now() });
    return { ok: true };
  }
});

export const completeParticipant = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const data = await getStudyData(ctx);
    const participant = data.participants.find((item) => item.token === args.token);
    if (!participant || participant.status === "completed") return { ok: false };
    if (!participant.age || !participant.germanProficiency) {
      throw new Error("Demografische Angaben fehlen.");
    }
    const assignmentCount = data.assignments.filter((assignment) => assignment.groupId === participant.groupId).length;
    const required = assignmentCount * 3 * data.questions.length;
    const answered = data.responses.filter((response) => response.participantId === participant._id).length;
    if (answered < required) {
      throw new Error("Es sind noch nicht alle Bewertungen vollständig.");
    }
    const completedAt = now();
    await ctx.db.patch(participant._id, {
      status: "completed",
      completedAt,
      updatedAt: completedAt
    });
    await scheduleSurveyLifecycleEmail(ctx, "completed", participant, completedAt);
    return { ok: true };
  }
});

export const exportResponsesCsv = query({
  args: { adminPassword: v.string() },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    const data = await getStudyData(ctx);
    const participantById = new Map(data.participants.map((participant) => [participant._id, participant]));
    const groupById = new Map(data.groups.map((group) => [group._id, group]));
    const essayById = new Map(data.essays.map((essay) => [essay._id, essay]));
    const topicById = new Map(data.topics.map((topic) => [topic._id, topic]));
    const feedbackById = new Map(data.feedbacks.map((feedback) => [feedback._id, feedback]));
    const questionById = new Map(data.questions.map((question) => [question._id, question]));
    const header = [
      "annotatorPseudonym",
      "annotatorCode",
      "groupKey",
      "topicKey",
      "essayKey",
      "methodKey",
      "questionKey",
      "value",
      "age",
      "germanProficiency",
      "completed"
    ];
    const lines = [header.join(",")];
    for (const response of data.responses) {
      const participant = participantById.get(response.participantId);
      const group = participant ? groupById.get(participant.groupId) : null;
      const essay = essayById.get(response.essayId);
      const topic = essay ? topicById.get(essay.topicId) : null;
      const feedback = feedbackById.get(response.feedbackId);
      const question = questionById.get(response.questionId);
      const row = [
        participant?.pseudonym || "",
        participant?.code || "",
        group?.key || "",
        topic?.key || "",
        essay?.key || "",
        feedback?.methodKey || "",
        question?.key || "",
        response.value,
        participant?.age || "",
        participant?.germanProficiency || "",
        participant?.status === "completed" ? "1" : "0"
      ];
      lines.push(row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
    }
    return lines.join("\n");
  }
});
