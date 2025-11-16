// Test
type HelloWorld = {
    data: {
        message: string;
    };
    user: {
        id: string;
    };
};

/*
AGGREGATOR RELATED
*/

type AggregatorRun = {
};

/*
YOUTUBE
*/
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

/*
WEBHOOKS
*/
export type InngestEvents = {
    "test/hello.world": HelloWorld;
    /*
    AGGREGATE
    */
    "aggregator/run": AggregatorRun;
    /*
    YOUTUBE
    */
    "youtube/channel.sync": YouTubeChannelSync;
    "youtube/videos.update": YouTubeVideosUpdate;
};
