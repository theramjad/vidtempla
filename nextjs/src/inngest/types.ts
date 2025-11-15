/**
 * Inngest Event Types for YouTube Description Updater
 * Defines all events that trigger background jobs
 */

export type YouTubeEvents = {
  /**
   * Triggered when a channel needs to sync videos from YouTube
   */
  'youtube/channel.sync': {
    data: {
      channelId: string;
      userId: string;
    };
  };

  /**
   * Triggered when video descriptions need to be updated
   * Used for manual updates of specific videos
   */
  'youtube/videos.update': {
    data: {
      videoIds: string[];
      userId: string;
    };
  };

  /**
   * Triggered when a container is updated
   * Updates all videos assigned to this container
   */
  'youtube/container.updated': {
    data: {
      containerId: string;
      userId: string;
    };
  };

  /**
   * Triggered when a template is updated
   * Updates all videos in containers that use this template
   */
  'youtube/template.updated': {
    data: {
      templateId: string;
      userId: string;
    };
  };
};
