import { relations } from "drizzle-orm";
import {
  user,
  session,
  account,
  verification,
  youtubeChannels,
  containers,
  templates,
  youtubeVideos,
  videoVariables,
  descriptionHistory,
  subscriptions,
  webhookEvents,
} from "./schema";

// User relations
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  youtubeChannels: many(youtubeChannels),
  containers: many(containers),
  templates: many(templates),
  subscriptions: many(subscriptions),
  descriptionHistory: many(descriptionHistory),
}));

// Session relations
export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

// Account relations
export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// Verification relations (no relations - standalone)

// YouTube Channels relations
export const youtubeChannelsRelations = relations(
  youtubeChannels,
  ({ one, many }) => ({
    user: one(user, {
      fields: [youtubeChannels.userId],
      references: [user.id],
    }),
    youtubeVideos: many(youtubeVideos),
  })
);

// Containers relations
export const containersRelations = relations(containers, ({ one, many }) => ({
  user: one(user, {
    fields: [containers.userId],
    references: [user.id],
  }),
  youtubeVideos: many(youtubeVideos),
}));

// Templates relations
export const templatesRelations = relations(templates, ({ one, many }) => ({
  user: one(user, {
    fields: [templates.userId],
    references: [user.id],
  }),
  videoVariables: many(videoVariables),
}));

// YouTube Videos relations
export const youtubeVideosRelations = relations(
  youtubeVideos,
  ({ one, many }) => ({
    youtubeChannel: one(youtubeChannels, {
      fields: [youtubeVideos.channelId],
      references: [youtubeChannels.id],
    }),
    container: one(containers, {
      fields: [youtubeVideos.containerId],
      references: [containers.id],
    }),
    videoVariables: many(videoVariables),
    descriptionHistory: many(descriptionHistory),
  })
);

// Video Variables relations
export const videoVariablesRelations = relations(videoVariables, ({ one }) => ({
  youtubeVideo: one(youtubeVideos, {
    fields: [videoVariables.videoId],
    references: [youtubeVideos.id],
  }),
  template: one(templates, {
    fields: [videoVariables.templateId],
    references: [templates.id],
  }),
}));

// Description History relations
export const descriptionHistoryRelations = relations(
  descriptionHistory,
  ({ one }) => ({
    youtubeVideo: one(youtubeVideos, {
      fields: [descriptionHistory.videoId],
      references: [youtubeVideos.id],
    }),
    createdByUser: one(user, {
      fields: [descriptionHistory.createdBy],
      references: [user.id],
    }),
  })
);

// Subscriptions relations
export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(user, {
    fields: [subscriptions.userId],
    references: [user.id],
  }),
}));

// Webhook Events relations (no relations - standalone)
