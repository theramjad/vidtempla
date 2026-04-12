ALTER TABLE "description_history" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "youtube_channels" ADD COLUMN "drift_baselined_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "youtube_videos" ADD COLUMN "drift_detected_at" timestamp with time zone;