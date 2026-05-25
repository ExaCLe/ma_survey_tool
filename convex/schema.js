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

  questions: defineTable({
    key: v.string(),
    text: v.string(),
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
