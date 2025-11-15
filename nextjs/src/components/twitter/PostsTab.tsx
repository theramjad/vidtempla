import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/utils/api";
import { useState } from "react";

// Component
export const PostsTab = () => {
  // State
  const [postLimit, setPostLimit] = useState(100);
  const [selectedAccountId, setSelectedAccountId] = useState<string | "all">(
    "all",
  );

  // Queries
  const { data: accounts, isLoading: isLoadingAccounts } =
    api.admin.twitter.list.useQuery();

  const { data: tweets, isLoading: isLoadingTweets } =
    api.admin.twitter.listPosts.useQuery({
      limit: postLimit,
      account_id: selectedAccountId === "all" ? undefined : Number(selectedAccountId),
    });

  const filteredTweets = tweets || [];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Account:</span>
          <Select
            value={selectedAccountId}
            onValueChange={(value) => setSelectedAccountId(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts?.map((account) => (
                <SelectItem key={account.id} value={String(account.id)}>
                  @{account.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Limit:</span>
          <Input
            type="number"
            min={1}
            max={1000}
            defaultValue={100}
            className="w-24"
            onChange={(e) => {
              const value = parseInt(e.target.value);
              if (value >= 1 && value <= 1000) {
                setPostLimit(value);
              }
            }}
          />
        </div>

        <div className="text-sm text-muted-foreground">
          {filteredTweets.length} posts
        </div>
      </div>

      {isLoadingAccounts || isLoadingTweets ? (
        <div className="text-center text-muted-foreground">
          Loading posts...
        </div>
      ) : !tweets || tweets.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          No posts found
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTweets.map((tweet: any) => (
            <div key={tweet.id} className="rounded-md border p-4">
              {/* Tweet text */}
              <p className="text-sm leading-relaxed">{tweet.text}</p>
              {/* Metadata */}
              <div className="mt-2 text-xs text-muted-foreground">
                @{tweet.twitter_account.username} • {new Date(tweet.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </div>

              {/* Associated links */}
              {Array.isArray(tweet.links) && tweet.links.length > 0 && (
                <div className="mt-3 ml-4 space-y-3">
                  {tweet.links.map((link: any) => {
                    const excerpt =
                      typeof link.content === "string"
                        ? link.content.replace(/\s+/g, " ").trim().slice(0, 200)
                        : "";

                    return (
                      <div key={link.url} className="space-y-1">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-emerald-600 underline underline-offset-4"
                        >
                          {link.url}
                        </a>
                        {excerpt && (
                          <p className="text-xs text-muted-foreground leading-snug">
                            {excerpt}
                            {link.content && link.content.length > 200 ? "…" : ""}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
