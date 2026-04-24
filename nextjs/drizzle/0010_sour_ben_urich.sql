CREATE TABLE "video_variable_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"template_id" uuid,
	"variable_name" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"change_type" text NOT NULL,
	"changed_by" uuid,
	"organization_id" text,
	"history_version_number" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "description_history" ADD COLUMN "render_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "youtube_videos" ADD COLUMN "render_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "video_variable_events" ADD CONSTRAINT "video_variable_events_video_id_youtube_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."youtube_videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_variable_events" ADD CONSTRAINT "video_variable_events_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_variable_events" ADD CONSTRAINT "video_variable_events_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_variable_events" ADD CONSTRAINT "video_variable_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_variable_events_video_created_at_idx" ON "video_variable_events" USING btree ("video_id","created_at");--> statement-breakpoint
CREATE INDEX "video_variable_events_video_template_name_idx" ON "video_variable_events" USING btree ("video_id","template_id","variable_name","created_at");--> statement-breakpoint
-- Preflight: renumber any duplicate (video_id, version_number) rows to a dense
-- 1..N sequence ordered by created_at. Preserves audit trail; never drops rows.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY created_at, id) AS rn
  FROM description_history
)
UPDATE description_history dh
SET version_number = ranked.rn
FROM ranked
WHERE dh.id = ranked.id AND dh.version_number <> ranked.rn;--> statement-breakpoint
ALTER TABLE "description_history" ADD CONSTRAINT "description_history_video_id_version_number_unique" UNIQUE("video_id","version_number");