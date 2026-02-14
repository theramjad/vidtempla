import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";

// Better Auth tables (4)

export const user = pgTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const session = pgTable("session", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const account = pgTable("account", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    mode: "date",
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    mode: "date",
    withTimezone: true,
  }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const verification = pgTable("verification", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).$defaultFn(
    () => new Date()
  ),
});

// App tables (8)

export const youtubeChannels = pgTable("youtube_channels", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  channelId: text("channel_id").unique().notNull(),
  title: text("title"),
  thumbnailUrl: text("thumbnail_url"),
  subscriberCount: integer("subscriber_count").default(0),
  accessTokenEncrypted: text("access_token_encrypted"),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  tokenExpiresAt: timestamp("token_expires_at", {
    mode: "date",
    withTimezone: true,
  }),
  tokenStatus: text("token_status").notNull().default("valid"),
  syncStatus: text("sync_status").notNull().default("idle"),
  lastSyncedAt: timestamp("last_synced_at", {
    mode: "date",
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const containers = pgTable("containers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  separator: text("separator").notNull().default("\n\n"),
  templateOrder: jsonb("template_order").$type<string[]>(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const templates = pgTable("templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const youtubeVideos = pgTable("youtube_videos", {
  id: uuid("id").defaultRandom().primaryKey(),
  channelId: uuid("channel_id")
    .notNull()
    .references(() => youtubeChannels.id, { onDelete: "cascade" }),
  videoId: text("video_id").unique().notNull(),
  title: text("title"),
  currentDescription: text("current_description"),
  containerId: uuid("container_id").references(() => containers.id, {
    onDelete: "set null",
  }),
  publishedAt: timestamp("published_at", {
    mode: "date",
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const videoVariables = pgTable(
  "video_variables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => youtubeVideos.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    variableName: text("variable_name").notNull(),
    variableValue: text("variable_value"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    uniqueVideoTemplateVariable: unique().on(
      table.videoId,
      table.templateId,
      table.variableName
    ),
  })
);

export const descriptionHistory = pgTable("description_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  videoId: uuid("video_id")
    .notNull()
    .references(() => youtubeVideos.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  versionNumber: integer("version_number").notNull(),
  createdBy: uuid("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  planTier: text("plan_tier").notNull().default("free"),
  status: text("status").notNull().default("active"),
  currentPeriodStart: timestamp("current_period_start", {
    mode: "date",
    withTimezone: true,
  }),
  currentPeriodEnd: timestamp("current_period_end", {
    mode: "date",
    withTimezone: true,
  }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: text("event_id").unique().notNull(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at", {
    mode: "date",
    withTimezone: true,
  }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});
