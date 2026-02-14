import { EventSchemas, Inngest } from "inngest";

type YouTubeChannelSync = {
  data: {
    channelId: string;
    userId: string;
  };
};

type YouTubeVideosUpdate = {
  data: {
    videoIds: string[];
    userId: string;
  };
};

export type InngestEvents = {
  "test/hello.world": { data: { message: string }; user: { id: string } };
  "aggregator/run": Record<string, never>;
  "youtube/channel.sync": YouTubeChannelSync;
  "youtube/videos.update": YouTubeVideosUpdate;
};

// Shared Inngest client configured for the Next.js application.
export const inngestClient = new Inngest({
  id: "vidtempla",
  schemas: new EventSchemas().fromRecord<InngestEvents>(),
});
