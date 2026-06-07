import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  settings: defineTable({
    key: v.string(),
    title: v.string(),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("closed")),
    generatedAt: v.optional(v.number()),
    updatedAt: v.number()
  }).index("by_key", ["key"]),

  groups: defineTable({
    key: v.string(),
    name: v.string(),
    initial: v.string(),
    gradeLevel: v.optional(v.string()),
    order: v.number(),
    topicId: v.optional(v.id("topics"))
  }).index("by_key", ["key"]),

  participants: defineTable({
    inviteName: v.string(),
    pseudonym: v.string(),
    code: v.string(),
    groupId: v.id("groups"),
    token: v.string(),
    status: v.union(v.literal("not_started"), v.literal("started"), v.literal("completed"), v.literal("reopened")),
    age: v.optional(v.string()),
    germanProficiency: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    updatedAt: v.number()
  })
    .index("by_token", ["token"])
    .index("by_group", ["groupId"]),

  topics: defineTable({
    key: v.string(),
    title: v.string(),
    prompt: v.string(),
    promptImageUrl: v.optional(v.string()),
    promptImageStorageId: v.optional(v.id("_storage")),
    order: v.number()
  }).index("by_key", ["key"]),

  essays: defineTable({
    topicId: v.id("topics"),
    key: v.string(),
    title: v.string(),
    gradeLevel: v.optional(v.string()),
    text: v.string(),
    order: v.number()
  })
    .index("by_topic", ["topicId"])
    .index("by_key", ["key"]),

  feedbacks: defineTable({
    essayId: v.id("essays"),
    methodKey: v.string(),
    text: v.string(),
    setupOrder: v.number()
  }).index("by_essay", ["essayId"]),

  automaticMethodRankings: defineTable({
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
    rankingSourceModels: v.optional(v.string()),
    importedAt: v.number()
  })
    .index("by_survey_method", ["surveyMethodKey"])
    .index("by_auto_approach", ["autoApproachKey"]),

  automaticPairwiseDetails: defineTable({
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
    importedHumanNotes: v.optional(v.string()),
    importedAt: v.number()
  })
    .index("by_essay", ["essayKey"])
    .index("by_pair", ["canonicalPairKey"]),

  questions: defineTable({
    key: v.string(),
    text: v.string(),
    description: v.optional(v.string()),
    labels: v.array(v.string()),
    order: v.number()
  }).index("by_key", ["key"]),

  groupEssayAssignments: defineTable({
    groupId: v.id("groups"),
    essayId: v.id("essays"),
    order: v.number()
  })
    .index("by_group", ["groupId"])
    .index("by_essay", ["essayId"]),

  participantFeedbackOrders: defineTable({
    participantId: v.id("participants"),
    essayId: v.id("essays"),
    feedbackIds: v.array(v.id("feedbacks"))
  })
    .index("by_participant", ["participantId"])
    .index("by_participant_essay", ["participantId", "essayId"]),

  responses: defineTable({
    participantId: v.id("participants"),
    essayId: v.id("essays"),
    feedbackId: v.id("feedbacks"),
    questionId: v.id("questions"),
    value: v.number(),
    updatedAt: v.number()
  })
    .index("by_participant", ["participantId"])
    .index("by_participant_item", ["participantId", "essayId", "feedbackId"])
    .index("by_question", ["questionId"])
});
