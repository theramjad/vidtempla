ALTER TABLE "youtube_videos" ADD COLUMN "description_push_reserved_until" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "youtube_videos_channel_push_reservation_idx" ON "youtube_videos" USING btree ("channel_id","description_push_reserved_until");
