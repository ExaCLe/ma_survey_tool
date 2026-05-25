import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const STUDY_KEY = "single-study";
const TABLES = [
  "responses",
  "participantFeedbackOrders",
  "groupEssayAssignments",
  "participants",
  "groups",
  "feedbacks",
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

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  const questions = (await collect(ctx, "questions")).sort((a, b) => a.order - b.order);
  const assignments = await collect(ctx, "groupEssayAssignments");
  const responses = await collect(ctx, "responses");
  return { settings, groups, participants, topics, essays, feedbacks, questions, assignments, responses };
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

function validateData(data) {
  const errors = [];
  if (data.groups.length !== 6) errors.push("Es müssen genau 6 Gruppen angelegt sein.");
  if (data.topics.length !== 3) errors.push("Es müssen genau 3 Themen importiert sein.");
  if (data.questions.length === 0) errors.push("Es muss mindestens eine Likert-Frage angelegt sein.");

  for (const question of data.questions) {
    if (question.labels.length !== 7) {
      errors.push(`Frage ${question.key} benötigt genau 7 Labels.`);
    }
  }

  const topicEssayCounts = new Map();
  for (const topic of data.topics) {
    const essays = data.essays.filter((essay) => essay.topicId === topic._id);
    topicEssayCounts.set(topic._id, essays.length);
    if (essays.length === 0) errors.push(`Thema ${topic.title} hat keine Essays.`);
    if (essays.length % 2 !== 0) errors.push(`Thema ${topic.title} braucht eine gerade Anzahl Essays.`);
  }
  const distinctCounts = new Set([...topicEssayCounts.values()]);
  if (distinctCounts.size > 1) errors.push("Alle Themen müssen gleich viele Essays haben.");

  for (const essay of data.essays) {
    const count = data.feedbacks.filter((feedback) => feedback.essayId === essay._id).length;
    if (count !== 3) errors.push(`Essay ${essay.key} benötigt genau 3 Feedbacktexte.`);
  }

  const groupsByTopic = new Map();
  for (const group of data.groups) {
    if (!group.topicId) {
      errors.push(`Gruppe ${group.name} ist keinem Thema zugeordnet.`);
      continue;
    }
    groupsByTopic.set(group.topicId, (groupsByTopic.get(group.topicId) || 0) + 1);
  }
  for (const topic of data.topics) {
    if ((groupsByTopic.get(topic._id) || 0) !== 2) {
      errors.push(`Thema ${topic.title} muss genau 2 Gruppen haben.`);
    }
  }

  for (const group of data.groups) {
    const groupParticipants = data.participants.filter((participant) => participant.groupId === group._id);
    if (groupParticipants.length === 0) errors.push(`Gruppe ${group.name} hat keine Teilnehmenden.`);
    const groupAssignments = data.assignments.filter((assignment) => assignment.groupId === group._id);
    if (groupAssignments.length === 0) errors.push(`Gruppe ${group.name} hat keine Essays.`);
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

function agreement(data) {
  const byQuestion = [];
  const itemMaps = new Map();
  const participantById = new Map(data.participants.map((participant) => [participant._id, participant]));
  const feedbackById = new Map(data.feedbacks.map((feedback) => [feedback._id, feedback]));
  const essayById = new Map(data.essays.map((essay) => [essay._id, essay]));

  for (const question of data.questions) {
    itemMaps.set(question._id, new Map());
  }

  for (const response of data.responses) {
    const participant = participantById.get(response.participantId);
    const essay = essayById.get(response.essayId);
    const feedback = feedbackById.get(response.feedbackId);
    if (!participant || !essay || !feedback) continue;
    const map = itemMaps.get(response.questionId);
    if (!map) continue;
    const itemKey = `${participant.groupId}:${essay._id}:${feedback._id}`;
    const values = map.get(itemKey) || [];
    values.push(response.value);
    map.set(itemKey, values);
  }

  for (const question of data.questions) {
    const alpha = ordinalAlpha(itemMaps.get(question._id) || new Map());
    byQuestion.push({
      questionId: question._id,
      key: question.key,
      text: question.text,
      alpha
    });
  }

  const overallMap = new Map();
  for (const questionMap of itemMaps.values()) {
    for (const [key, values] of questionMap.entries()) {
      const existing = overallMap.get(key) || [];
      existing.push(...values);
      overallMap.set(key, existing);
    }
  }

  return {
    overallAlpha: ordinalAlpha(overallMap),
    byQuestion
  };
}

function averages(data) {
  const rows = [];
  for (const question of data.questions) {
    for (const feedback of data.feedbacks) {
      const values = data.responses
        .filter((response) => response.questionId === question._id && response.feedbackId === feedback._id)
        .map((response) => response.value);
      if (!values.length) continue;
      const essay = data.essays.find((item) => item._id === feedback.essayId);
      const topic = essay ? data.topics.find((item) => item._id === essay.topicId) : null;
      rows.push({
        questionKey: question.key,
        questionText: question.text,
        methodKey: feedback.methodKey,
        essayKey: essay?.key || "",
        topicKey: topic?.key || "",
        count: values.length,
        mean: values.reduce((sum, value) => sum + value, 0) / values.length
      });
    }
  }
  return rows;
}

export const dashboard = query({
  args: { adminPassword: v.string() },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    const data = await getStudyData(ctx);
    const stats = completionStats(data);
    const validationErrors = validateData(data);
    const alpha = agreement(data);
    return {
      settings: data.settings,
      groups: data.groups,
      participants: data.participants,
      topics: await resolveTopicPromptImages(ctx, data.topics),
      essays: data.essays,
      feedbacks: data.feedbacks,
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
      averages: averages(data)
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

    const topicIds = new Map();
    const essayIds = new Map();
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
      if (!essayId) {
        essayId = await ctx.db.insert("essays", {
          topicId,
          key: essayKey,
          title: row.essayTitle || row.essayKey,
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

export const saveQuestions = mutation({
  args: {
    adminPassword: v.string(),
    questions: v.array(
      v.object({
        key: v.string(),
        text: v.string(),
        labels: v.array(v.string())
      })
    )
  },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    const responses = await collect(ctx, "responses");
    if (responses.length > 0) throw new Error("Fragen können nach Antworten nicht ersetzt werden.");
    await clearTables(ctx, ["questions"]);
    for (let index = 0; index < args.questions.length; index += 1) {
      const question = args.questions[index];
      await ctx.db.insert("questions", {
        key: slug(question.key) || `q${index + 1}`,
        text: question.text,
        labels: question.labels,
        order: index
      });
    }
    return { ok: true };
  }
});

export const generateAssignments = mutation({
  args: { adminPassword: v.string() },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    const data = await getStudyData(ctx);
    const responses = await collect(ctx, "responses");
    if (responses.length > 0) throw new Error("Zuweisungen können nach Antworten nicht neu generiert werden.");
    await clearTables(ctx, ["participantFeedbackOrders", "groupEssayAssignments"]);

    const topics = shuffle(data.topics);
    const groups = shuffle(data.groups);
    if (topics.length !== 3 || groups.length !== 6) {
      throw new Error(
        `Für die Randomisierung werden genau 3 Themen und 6 Gruppen benötigt. Aktuell gefunden: ${topics.length} Themen und ${groups.length} Gruppen. Importiere zuerst Materialien und Teilnehmende.`
      );
    }

    for (let topicIndex = 0; topicIndex < topics.length; topicIndex += 1) {
      const topic = topics[topicIndex];
      const topicGroups = groups.slice(topicIndex * 2, topicIndex * 2 + 2);
      const topicEssays = shuffle(data.essays.filter((essay) => essay.topicId === topic._id));
      if (topicEssays.length % 2 !== 0) {
        throw new Error(`Thema ${topic.title} braucht eine gerade Anzahl Essays.`);
      }
      const split = topicEssays.length / 2;
      for (let groupIndex = 0; groupIndex < topicGroups.length; groupIndex += 1) {
        const group = topicGroups[groupIndex];
        await ctx.db.patch(group._id, { topicId: topic._id });
        const essaysForGroup = topicEssays.slice(groupIndex * split, groupIndex * split + split);
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

export const resetStudy = mutation({
  args: { adminPassword: v.string() },
  handler: async (ctx, args) => {
    requireAdmin(args.adminPassword);
    await clearTables(ctx, TABLES);
    await ensureSettings(ctx);
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
      await ctx.db.patch(participant._id, { startedAt: now(), status: "started", updatedAt: now() });
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
    await ctx.db.patch(participant._id, {
      status: "completed",
      completedAt: now(),
      updatedAt: now()
    });
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
