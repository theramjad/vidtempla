import { z } from 'zod';
import { protectedProcedure } from '@/server/trpc/init';
import { TRPCError } from '@trpc/server';
import { supabaseServer } from '@/lib/clients/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '@/env/server.mjs';
import { router } from '@/server/trpc/init';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const ProposalSchema = z.object({
  containerName: z.string(),
  separator: z.string(),
  templates: z.array(
    z.object({
      name: z.string(),
      content: z.string(),
    })
  ),
  videoAnalysis: z.array(
    z.object({
      videoId: z.string(),
      variableValues: z.record(z.string()), // map of variableName -> value
    })
  ),
});

export type AIProposal = z.infer<typeof ProposalSchema>;

export const aiRouter = router({
  analyzeChannel: protectedProcedure
    .input(
      z.object({
        channelId: z.string().uuid(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch recent videos
      const { data: videos, error } = await supabaseServer
        .from('youtube_videos')
        .select('id, title, current_description, video_id')
        .eq('channel_id', input.channelId)
        .order('published_at', { ascending: false })
        .limit(input.limit);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      if (!videos || videos.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No videos found to analyze',
        });
      }

      // 2. Construct Prompt
      const videosText = videos
        .map(
          (v, i) =>
            `--- VIDEO ${i + 1} (ID: ${v.id}) ---\nTITLE: ${v.title}\nDESCRIPTION:\n${v.current_description}\n`
        )
        .join('\n');

      const prompt = `
      You are an expert YouTube Automation Architect. Your goal is to analyze the descriptions of these YouTube videos and create a scalable "Container" and "Template" system.

      SYSTEM DEFINITIONS:
      - **Template**: A reusable block of text. It can contain static text and variables (e.g., "Follow me on {{platform}}").
      - **Container**: An ordered list of Templates that creates a full description.
      - **Separator**: A string used to join templates (usually "\n\n").

      TASK:
      1. Analyze the patterns in the provided video descriptions.
      2. Identify static sections (intros, social links, disclaimers) -> Convert these to Templates.
      3. Identify dynamic sections (episode summaries, guest names, specific links) -> Convert these to Variables inside Templates (e.g., "{{guest_name}}", "{{episode_summary}}").
      4. Extract the variable values for EACH provided video based on your proposed structure.

      OUTPUT FORMAT (JSON ONLY):
      {
        "containerName": "Proposed Container Name (e.g., Standard Podcast Layout)",
        "separator": "\n\n",
        "templates": [
          { "name": "Template Name", "content": "Text with {{variables}}..." }
        ],
        "videoAnalysis": [
          {
            "videoId": "The UUID provided in the input",
            "variableValues": {
              "variable_name": "extracted value from this video's description"
            }
          }
        ]
      }

      CONSTRAINTS:
      - Do not Hallucinate values. If a variable value is missing in a description, use an empty string.
      - Ensure the "content" of templates combined equals the original structure as closely as possible.
      - Return ONLY valid JSON.

      INPUT DATA:
      ${videosText}
      `;

      // 3. Call Gemini
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: "application/json" } });
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // 4. Parse and Validate
        const json = JSON.parse(text);
        const proposal = ProposalSchema.parse(json);

        return proposal;
      } catch (err) {
        console.error('AI Analysis Failed:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to analyze descriptions with AI. Please try again.',
          cause: err,
        });
      }
    }),

  applyProposal: protectedProcedure
    .input(
      z.object({
        channelId: z.string().uuid(),
        proposal: ProposalSchema,
        applyToAllAnalyzed: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { proposal } = input;

      // 1. Create Templates
      const templateIdMap = new Map<string, string>(); // Name -> ID
      const templateIdsInOrder: string[] = [];

      for (const tpl of proposal.templates) {
        const { data: newTpl, error: tplError } = await supabaseServer
          .from('templates')
          .insert({
            user_id: ctx.user.id,
            name: tpl.name,
            content: tpl.content,
          })
          .select('id')
          .single();

        if (tplError) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: tplError.message });
        templateIdMap.set(tpl.name, newTpl.id);
        templateIdsInOrder.push(newTpl.id);
      }

      // 2. Create Container
      const { data: container, error: containerError } = await supabaseServer
        .from('containers')
        .insert({
          user_id: ctx.user.id,
          name: proposal.containerName,
          template_order: templateIdsInOrder,
          separator: proposal.separator,
        })
        .select('id')
        .single();

      if (containerError) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: containerError.message });

      // 3. Apply to Videos (Migration)
      if (input.applyToAllAnalyzed) {
        // For each analyzed video
        for (const videoAnalysis of proposal.videoAnalysis) {
          // A. Assign Container
          await supabaseServer
            .from('youtube_videos')
            .update({ container_id: container.id })
            .eq('id', videoAnalysis.videoId);

          // B. Insert Variables
          const variablesToInsert = [];

          // We need to map the flat variableValues map back to specific templates
          // The proposal gives us variableValues: { "var1": "val1" }
          // We know which template defines "var1" by parsing the templates created above.

          // Optimization: Pre-calculate which variable belongs to which template
          // (Simple approach: Iterate all templates, check if var exists in content)

          for (const [varName, varValue] of Object.entries(videoAnalysis.variableValues)) {
            // Find which template has this variable
            // Note: This assumes variable names are unique across the container, which is good practice but not guaranteed.
            // If duplicates exist, we assign to the first match or all matches.

            for (const tpl of proposal.templates) {
              if (tpl.content.includes(`{{${varName}}}`)) {
                const tplId = templateIdMap.get(tpl.name);
                if (tplId) {
                  variablesToInsert.push({
                    video_id: videoAnalysis.videoId,
                    template_id: tplId,
                    variable_name: varName,
                    variable_value: varValue || '',
                  });
                }
              }
            }
          }

          if (variablesToInsert.length > 0) {
            await supabaseServer.from('video_variables').insert(variablesToInsert);
          }
        }
      }

      return { success: true, containerId: container.id };
    }),
});
