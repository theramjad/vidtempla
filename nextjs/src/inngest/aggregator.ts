import { inngestClient } from "@/lib/clients/inngest";
import { supabaseServer } from "@/lib/clients/supabase";
import { Database } from "@shared-types/database.types";

/**
 * Aggregator workflow
 * -------------------
 * This scheduled function runs once every hour (at minute 0) and orchestrates
 * the end-to-end aggregation pipeline for AI news, papers, tools and model
 * releases. Each major operation is wrapped in `step.run` to ensure that it
 * can be retried safely if it fails.
 */


/*
 Helper types 
*/

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

interface Media {
  url: string;
  type: string;
  alt?: string;
  [key: string]: Json | undefined;
}

interface UrlInfo {
  url: string;
  expanded: string;
  display: string;
  [key: string]: Json | undefined;
}

interface LinkToFetch {
  url: string;
  tweetId: number;
}

/*───────────────────────────────────────────────────────────────────────────*
 *  Minimal types for twitter-api45 timeline endpoint
 *───────────────────────────────────────────────────────────────────────────*/
interface ApiTweet {
  tweet_id: string;
  text: string;
  created_at: string;
  conversation_id: string;
  media?: {
    photo?: { media_url_https: string }[];
    video?: { variants: { url: string; bitrate?: number }[] }[];
  };
  entities?: { urls?: { url: string; expanded_url?: string; display_url?: string }[] };
}

interface TwitterApi45Response {
  timeline: ApiTweet[];
}

// ---------------------------------------------------------------------------
//  Aggregator workflow – executed hourly via Inngest cron
// ---------------------------------------------------------------------------
export const aggregatorRun = inngestClient.createFunction(
  {
    // Unique identifier for this function in Inngest
    id: "aggregator/run",
  },
  {
    // event: "aggregator/run",
    cron: `0 * * * *`, // Run every hour at minute 0
  },
  async ({ step, logger }) => {

    // Fetch Twitter accounts to monitor
    const twitterAccounts = await step.run("db: fetch Twitter accounts", async () => {
      const { data, error } = await supabaseServer
        .from("twitter_accounts")
        .select("*");
      if (error) throw error;
      return data ?? [];
    });

    // Iterate through each account and aggregate its timeline
    for (const account of twitterAccounts) {
      const { id: accountId, username } = account;

      // Fetch, parse and upsert the timeline for this account
      await step.run(`twitter: fetch, parse & upsert timeline - ${username}`, async () => {
        // Fetch the timeline data
        const url = `https://twitter-api45.p.rapidapi.com/timeline.php?screenname=${encodeURIComponent(username)}`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "x-rapidapi-key": process.env.RAPID_API_KEY!,
            "x-rapidapi-host": "twitter-api45.p.rapidapi.com",
          },
        });
        if (!response.ok) {
          logger.warn({ accountId, status: response.status }, "Twitter API returned non-200 from Twitter API");
          return null;
        }

        // Parse the response
        const data = (await response.json()) as TwitterApi45Response;
        const timelineItems: ApiTweet[] = data.timeline ?? [];

        // Prepare tweets for upsert and collect links to fetch
        const tweetsForUpsert: Database["public"]["Tables"]["tweets"]["Row"][] = [];
        const linksToFetch: LinkToFetch[] = [];

        // Iterate through each tweet in the timeline
        for (const apiTweet of timelineItems) {
          if (!apiTweet.text) continue;

          // Build a flat media list (photos & first mp4 variant per video)
          const parsedMedia: Media[] | undefined = (() => {
            const list: Media[] = [];
            if (apiTweet.media?.photo) {
              apiTweet.media.photo.forEach((p) => list.push({ url: p.media_url_https, type: "photo" }));
            }
            if (apiTweet.media?.video) {
              apiTweet.media.video.forEach((v) => {
                const variant = v.variants.find((vv) => vv.url?.endsWith(".mp4")) ?? v.variants[0];
                if (variant?.url) list.push({ url: variant.url, type: "video" });
              });
            }
            return list.length ? list : undefined;
          })();

          // Pull out external URLs referenced in the tweet
          const parsedUrls: UrlInfo[] | undefined = apiTweet.entities?.urls?.map((u) => ({
            url: u.url,
            expanded: u.expanded_url ?? u.url,
            display: u.display_url ?? u.expanded_url ?? u.url,
          }));

          // Check if the tweet already exists in the database
          const tweetId = Number(apiTweet.tweet_id);
          const { data: existingTweet, error: existingTweetErr } = await supabaseServer
            .from("tweets")
            .select("id")
            .eq("id", tweetId);
          if (existingTweetErr) throw existingTweetErr;
          if (existingTweet?.length) continue;

          // Add the tweet to the list of tweets to upsert so it can be batched
          tweetsForUpsert.push({
            id: tweetId,
            account_id: Number(accountId),
            text: apiTweet.text,
            expanded_urls: (parsedUrls ?? null) as unknown as Json,
            media: (parsedMedia ?? null) as unknown as Json,
            in_reply_to_id: null,
            raw_payload: apiTweet as unknown as Json,
            created_at: new Date(apiTweet.created_at).toISOString(),
            inserted_at: new Date().toISOString(),
            like_count: 0,
            quote_count: 0,
            reply_count: 0,
            retweet_count: 0,
            thread_id: null,
          });

          // For each parsed URL, check if the link has already been scraped
          // If not, add it to the list of links to fetch
          parsedUrls?.forEach(async (u) => {
            linksToFetch.push({ url: u.expanded, tweetId });
          });
        }

        // Persist tweets into Supabase
        if (tweetsForUpsert.length) {
          const { data, error } = await supabaseServer
            .from("tweets")
            .upsert(tweetsForUpsert, { onConflict: "id" })
            .select("id");
          if (error) throw error;
        }

        return { linksToFetch };
      });
    }
  },
);