import { supabaseServer } from "@/lib/clients/supabase";
import { TRPCError } from "@trpc/server";
import axios from "axios";
import { z } from "zod";
import { adminProcedure, createTRPCRouter } from "../../trpc";

// Admin router for Twitter account management
export const twitterRouter = createTRPCRouter({
  // 1. List all accounts
  list: adminProcedure.query(async () => {
    const { data: accounts, error } = await supabaseServer
      .from("twitter_accounts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return accounts;
  }),

  // 2. Add account by username (via RapidAPI Twttr API)
  addAccount: adminProcedure
    .input(z.object({ username: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const username = input.username.replace(/^@/, "");

      // Fetch account info from RapidAPI Twitter API (twitter-api45)
      const response = await axios.get(
        "https://twitter-api45.p.rapidapi.com/screenname.php",
        {
          params: { screenname: username },
          headers: {
            "x-rapidapi-key": process.env.RAPID_API_KEY!,
            "x-rapidapi-host": "twitter-api45.p.rapidapi.com",
          },
        },
      );
      const user = response.data ?? null;

      // If the account is not found, throw an error
      if (!user || !user.rest_id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Unable to find Twitter account",
        });
      }

      // Parse the response
      const { rest_id, profile, name, sub_count, avatar } = user as {
        rest_id: string;
        profile?: string;
        name?: string;
        sub_count?: number;
        avatar?: string;
      };

      // Check if the user with that rest_id already exists
      const { data: existingAccount } = await supabaseServer
        .from("twitter_accounts")
        .select("id")
        .eq("id", Number.parseInt(rest_id, 10))
        .single();
      if (existingAccount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Account already exists",
        });
      }

      // Insert the account into the database
      const { data: account, error } = await supabaseServer
        .from("twitter_accounts")
        .insert({
          id: Number.parseInt(rest_id, 10),
          username: profile ?? username,
          display_name: name ?? null,
          followers_count: sub_count ?? null,
          profile_image_url: avatar ?? null,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;

      return account;
    }),

  // 3. Delete account
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const { error } = await supabaseServer
        .from("twitter_accounts")
        .delete()
        .eq("id", input.id);

      if (error) throw error;
      return { success: true } as const;
    }),

  // 4. List tweets (posts)
  listPosts: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(1000).default(100),
        account_id: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      let query = supabaseServer
        .from("tweets")
        .select(
          `
          *,
          twitter_account:twitter_accounts(username)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(input.limit);

      if (input.account_id !== undefined) {
        query = query.eq("account_id", input.account_id);
      }

      const { data: tweets, error } = await query;
      if (error) throw error;
      return tweets;
    }),
});
