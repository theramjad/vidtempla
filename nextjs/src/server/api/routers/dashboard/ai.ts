import { z } from 'zod';
import { protectedProcedure } from '@/server/trpc/init';
import { TRPCError } from '@trpc/server';
import { supabaseServer } from '@/lib/clients/supabase';
import { openai } from '@/lib/clients/openai';
import { zodResponseFormat, zodTextFormat } from 'openai/helpers/zod';
import { env } from '@/env/server.mjs';
import { router } from '@/server/trpc/init';

const ProposalSchema = z.object({
  containerName: z.string(),
  separator: z.string(),
  templates: z.array(
    z.object({
      name: z.string(),
      content: z.string(),
      action: z.enum(['create', 'reuse']).describe("Set to 'reuse' if this matches an EXISTING SYSTEM TEMPLATE, otherwise 'create'"),
    })
  ),
  videoAnalysis: z.array(
    z.object({
      videoId: z.string(),
      variableValues: z.array(
        z.object({
          name: z.string(),
          value: z.string(),
        })
      ),
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
        .is('container_id', null)
        .order('published_at', { ascending: false })
        .limit(input.limit);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      if (!videos || videos.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No videos found to analyze',
        });
      }

      // 2. Fetch existing templates
      const { data: existingTemplates } = await supabaseServer
        .from('templates')
        .select('name, content')
        .eq('user_id', ctx.user.id);

      // 3. Construct Prompt
      const videosText = videos
        .map(
          (v, i) =>
            `--- VIDEO ${i + 1} (ID: ${v.id}) ---\nTITLE: ${v.title}\nDESCRIPTION:\n${v.current_description}\n`
        )
        .join('\n');

      const existingTemplatesText = existingTemplates?.length
        ? `<EXISTING_TEMPLATES>\n${existingTemplates
          .map((t) => `<TEMPLATE name="${t.name}">\n${t.content}\n</TEMPLATE>`)
          .join('\n')}\n</EXISTING_TEMPLATES>`
        : '<EXISTING_TEMPLATES>None</EXISTING_TEMPLATES>';

      const systemPrompt = `
      You are an expert YouTube Automation Architect. Your goal is to analyze the descriptions of these YouTube videos and create a scalable "Container" and "Template" system.

      SYSTEM DEFINITIONS:
      - **Template**: A reusable block of text. It can contain static text and variables (e.g., "Follow me on {{platform}}").
      - **Container**: An ordered list of Templates that creates a full description.
      - **Separator**: A string used to join templates (usually "\n\n").

      TASK:
      1. Analyze the patterns in the provided video descriptions.
      2. Check the <EXISTING_TEMPLATES> provided in the user input. If a section of the description matches an existing template (structure and variables), YOU MUST REUSE IT and set action="reuse".
      3. Identify static sections (intros, social links, disclaimers) -> Convert these to Templates (action="create").
      4. Identify dynamic sections (episode summaries, guest names, specific links) -> Convert these to Variables inside Templates (e.g., "{{coupon_code}}", "{{episode_summary}}").
      5. Extract the variable values for EACH provided video based on your proposed structure.

      GUIDELINES FOR TEMPLATE CREATION:
      - **REUSE EXISTING TEMPLATES**: If an existing template matches the content, use its exact Name and Content in your proposal and set action="reuse".
      - **PREFER GRANULAR, MODULAR TEMPLATES**. Break the description down into smaller, logical components.
      - Create separate templates for distinct sections (e.g., "Episode Content", "Timestamps", "Social Links", "Sponsors", "Gear", "Disclaimer").
      - Avoid creating massive "Footer" templates. Instead, split static sections into their own templates so they can be reordered or updated independently.
      - Use {{variables}} for content that changes between videos within these templates.
      - Aim for 5-10 templates for a typical video description to ensure maximum flexibility.

      FEW-SHOT EXAMPLES:

      <EXAMPLE_1>
        <INPUT_DESCRIPTION>
        Welcome to Episode 45! In this video, we talk about React 19.
        
        Timestamps:
        0:00 Intro
        1:00 React 19
        
        Follow me:
        Twitter: @example
        Instagram: @example
        
        Gear I use:
        Camera: Sony A7
        Lens: 24mm
        
        Disclaimer: This video contains affiliate links.
        </INPUT_DESCRIPTION>

        <DESIRED_OUTPUT_STRUCTURE>
          <TEMPLATE name="Episode Content">
            Welcome to {{episode_title}}! In this video, {{episode_summary}}.
          </TEMPLATE>
            
          <TEMPLATE name="Timestamps">
            Timestamps:
            {{timestamps}}
          </TEMPLATE>

          <TEMPLATE name="Social Links">
            Follow me:
            Twitter: @example
            Instagram: @example
          </TEMPLATE>
            
          <TEMPLATE name="Gear">
            Gear I use:
            Camera: Sony A7
            Lens: 24mm
            
            Disclaimer: This video contains affiliate links.
          </TEMPLATE>
        </DESIRED_OUTPUT_STRUCTURE>
      </EXAMPLE_1>

      <EXAMPLE_2>
        <INPUT_DESCRIPTION>
        Today's guest is John Doe, CEO of TechCorp.
        We discuss the future of AI.
        
        Get 20% off at ExampleStore with code: TECH20
        
        Join our Discord: discord.gg/example
        Subscribe for more!
        </INPUT_DESCRIPTION>

        <DESIRED_OUTPUT_STRUCTURE>
          <TEMPLATE name="Guest Intro">
            Today's guest is {{guest_name}}, {{guest_title}}.
            We discuss {{topic}}.
          </TEMPLATE>

          <TEMPLATE name="Sponsor">
            Get {{discount_amount}} off at {{sponsor_name}} with code: {{promo_code}}
          </TEMPLATE>

          <TEMPLATE name="Socials">
            Join our Discord: discord.gg/example
            Subscribe for more!
          </TEMPLATE>
        </DESIRED_OUTPUT_STRUCTURE>

        <REASONING>
        We split the Guest Intro, Sponsor, and Socials into separate templates. This allows us to easily swap out the Sponsor template or update Social links without touching the guest info.
        </REASONING>
      </EXAMPLE_2>

      <EXAMPLE_3>
        <INPUT_DESCRIPTION>
        My Daily Vlog #102
        Just walking around Tokyo today.
        
        Music by Epidemic Sound.
        </INPUT_DESCRIPTION>

        <DESIRED_OUTPUT_STRUCTURE>
          <TEMPLATE name="Video Title">
            {{video_title}}
          </TEMPLATE>

          <TEMPLATE name="Description">
            {{video_description}}
          </TEMPLATE>

          <TEMPLATE name="Credits">
            Music by Epidemic Sound.
          </TEMPLATE>
        </DESIRED_OUTPUT_STRUCTURE>

        <REASONING>
        Even simple descriptions are broken down. The Title and Description are separate templates, and the static Credits get their own template.
        </REASONING>
      </EXAMPLE_3>

      OUTPUT FORMAT:
      You must return a valid JSON object matching the provided schema.

      CONSTRAINTS:
      - Do not Hallucinate values. If a variable value is missing in a description, use an empty string.
      - Ensure the "content" of templates combined equals the original structure as closely as possible.
      `;

      const userMessage = `
      INPUT DATA:
      ${existingTemplatesText}
      ${videosText}
      `;

      // 4. Call OpenAI
      try {
        const resp = await openai.responses.parse({
          model: 'gpt-4.1-mini',
          input: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userMessage,
            },
          ],
          text: {
            format: zodTextFormat(ProposalSchema, 'ai_proposal'),
          },
        });

        const proposal = resp.output_parsed;

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
        let tplId: string | null = null;

        // Logic based on AI's 'action'
        if (tpl.action === 'reuse') {
          // AI says reuse -> Try to find by NAME first (as it should have used the existing name)
          const { data: existingByName } = await supabaseServer
            .from('templates')
            .select('id')
            .eq('user_id', ctx.user.id)
            .eq('name', tpl.name)
            .maybeSingle();

          if (existingByName) {
            tplId = existingByName.id;
          } else {
            // Fallback: maybe it hallucinated the name but content matches?
            const { data: existingByContent } = await supabaseServer
              .from('templates')
              .select('id')
              .eq('user_id', ctx.user.id)
              .eq('content', tpl.content)
              .maybeSingle();

            if (existingByContent) tplId = existingByContent.id;
          }
        }

        // If action was 'create' OR if 'reuse' failed to find a match (safety fallback)
        if (!tplId) {
          // Check for duplicate content even if AI said create (deduplication safety)
          const { data: existingByContent } = await supabaseServer
            .from('templates')
            .select('id')
            .eq('user_id', ctx.user.id)
            .eq('content', tpl.content)
            .maybeSingle();

          if (existingByContent) {
            tplId = existingByContent.id;
          } else {
            // Actually create it
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
            tplId = newTpl.id;
          }
        }

        templateIdMap.set(tpl.name, tplId);
        templateIdsInOrder.push(tplId);
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

          for (const { name: varName, value: varValue } of videoAnalysis.variableValues) {
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
