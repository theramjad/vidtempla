/**
 * YouTube tRPC router
 * Handles all YouTube-related API procedures
 */

import { z } from 'zod';
import { createTRPCRouter, adminProcedure } from '@/server/api/trpc';
import { TRPCError } from '@trpc/server';
import { getOAuthUrl } from '@/lib/clients/youtube';
import { decrypt, encrypt } from '@/utils/encryption';
import { refreshAccessToken, fetchChannelVideos } from '@/lib/clients/youtube';
import {
  parseVariables,
  buildDescription,
  findMissingVariables,
} from '@/utils/templateParser';
import { inngestClient } from '@/lib/clients/inngest';
import { supabaseServer } from '@/lib/clients/supabase';
import type { Database } from '@shared-types/database.types';

export const youtubeRouter = createTRPCRouter({
  // ==================== Channel Management ====================

  channels: createTRPCRouter({
    list: adminProcedure.query(async ({ ctx }): Promise<Database['public']['Tables']['youtube_channels']['Row'][]> => {
      const { data, error } = await supabaseServer
        .from('youtube_channels')
        .select('*')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false });

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      return data || [];
    }),

    initiateOAuth: adminProcedure.mutation(async () => {
      return { url: getOAuthUrl() };
    }),

    disconnect: adminProcedure
      .input(z.object({ channelId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const { error } = await supabaseServer
          .from('youtube_channels')
          .delete()
          .eq('id', input.channelId)
          .eq('user_id', ctx.user.id);

        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

        return { success: true };
      }),

    syncVideos: adminProcedure
      .input(z.object({ channelId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        // Trigger Inngest event to sync videos in background
        await inngestClient.send({
          name: 'youtube/channel.sync',
          data: {
            channelId: input.channelId,
            userId: ctx.user.id,
          },
        });

        return { success: true, jobId: `sync-${input.channelId}-${Date.now()}` };
      }),
  }),

  // ==================== Container Management ====================

  containers: createTRPCRouter({
    list: adminProcedure.query(async ({ ctx }): Promise<Database['public']['Tables']['containers']['Row'][]> => {
      const { data, error } = await supabaseServer
        .from('containers')
        .select(`
          *,
          videos:youtube_videos(count)
        `)
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false });

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      return data;
    }),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          templateIds: z.array(z.string().uuid()),
          separator: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { data, error } = await supabaseServer
          .from('containers')
          .insert({
            user_id: ctx.user.id,
            name: input.name,
            template_order: input.templateIds,
            separator: input.separator ?? '\n\n',
          })
          .select()
          .single();

        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

        return data;
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().min(1).optional(),
          templateIds: z.array(z.string().uuid()).optional(),
          separator: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const updateData: {
          name?: string;
          template_order?: string[];
          separator?: string;
        } = {};
        if (input.name) updateData.name = input.name;
        if (input.templateIds) updateData.template_order = input.templateIds;
        if (input.separator !== undefined) updateData.separator = input.separator;

        const { data, error } = await supabaseServer
          .from('containers')
          .update(updateData)
          .eq('id', input.id)
          .eq('user_id', ctx.user.id)
          .select()
          .single();

        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

        // Trigger Inngest event to update all videos in this container
        // Only trigger if template_order or separator changed (affects description)
        if (input.templateIds !== undefined || input.separator !== undefined) {
          const { data: videos } = await supabaseServer
            .from('youtube_videos')
            .select('id')
            .eq('container_id', input.id);

          if (videos && videos.length > 0) {
            await inngestClient.send({
              name: 'youtube/videos.update',
              data: {
                videoIds: videos.map((v) => v.id),
                userId: ctx.user.id,
              },
            });
          }
        }

        return data;
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const { error } = await supabaseServer
          .from('containers')
          .delete()
          .eq('id', input.id)
          .eq('user_id', ctx.user.id);

        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

        return { success: true };
      }),

    getAffectedVideos: adminProcedure
      .input(z.object({ containerId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const { data: videos, error } = await supabaseServer
          .from('youtube_videos')
          .select('id, title, video_id')
          .eq('container_id', input.containerId)
          .order('title', { ascending: true });

        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

        return {
          videos: videos || [],
          count: videos?.length || 0,
        };
      }),
  }),

  // ==================== Template Management ====================

  templates: createTRPCRouter({
    list: adminProcedure.query(async ({ ctx }): Promise<(Database['public']['Tables']['templates']['Row'] & { variables: string[] })[]> => {
      const { data, error } = await supabaseServer
        .from('templates')
        .select('*')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false });

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      // Add variable count to each template
      return (data || []).map((template) => ({
        ...template,
        variables: parseVariables(template.content),
      }));
    }),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          content: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { data, error } = await supabaseServer
          .from('templates')
          .insert({
            user_id: ctx.user.id,
            name: input.name,
            content: input.content,
          })
          .select()
          .single();

        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

        return data;
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().min(1).optional(),
          content: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const updateData: {
          name?: string;
          content?: string;
        } = {};
        if (input.name) updateData.name = input.name;
        if (input.content !== undefined) updateData.content = input.content;

        const { data, error } = await supabaseServer
          .from('templates')
          .update(updateData)
          .eq('id', input.id)
          .eq('user_id', ctx.user.id)
          .select()
          .single();

        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

        // Trigger Inngest event to update all videos using this template
        // Only trigger if content changed (affects description)
        if (input.content !== undefined) {
          // Find all containers that use this template
          const { data: containers } = await supabaseServer
            .from('containers')
            .select('id')
            .eq('user_id', ctx.user.id)
            .contains('template_order', [input.id]);

          if (containers && containers.length > 0) {
            const containerIds = containers.map((c) => c.id);

            // Get all videos from these containers
            const { data: videos } = await supabaseServer
              .from('youtube_videos')
              .select('id')
              .in('container_id', containerIds);

            if (videos && videos.length > 0) {
              await inngestClient.send({
                name: 'youtube/videos.update',
                data: {
                  videoIds: videos.map((v) => v.id),
                  userId: ctx.user.id,
                },
              });
            }
          }
        }

        return data;
      }),

    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const { error } = await supabaseServer
          .from('templates')
          .delete()
          .eq('id', input.id)
          .eq('user_id', ctx.user.id);

        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

        return { success: true };
      }),

    parseVariables: adminProcedure
      .input(z.object({ content: z.string() }))
      .query(({ input }) => {
        return { variables: parseVariables(input.content) };
      }),

    getAffectedVideos: adminProcedure
      .input(z.object({ templateId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        // First, find all containers that use this template
        const { data: containers, error: containerError } = await supabaseServer
          .from('containers')
          .select('id, name, template_order')
          .eq('user_id', ctx.user.id)
          .contains('template_order', [input.templateId]);

        if (containerError) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: containerError.message });

        if (!containers || containers.length === 0) {
          return {
            videos: [],
            count: 0,
            containers: [],
          };
        }

        // Get all videos from these containers
        const containerIds = containers.map((c) => c.id);
        const { data: videos, error: videoError } = await supabaseServer
          .from('youtube_videos')
          .select('id, title, video_id, container_id')
          .in('container_id', containerIds)
          .order('title', { ascending: true });

        if (videoError) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: videoError.message });

        // Build container info with video counts
        const containerInfo = containers.map((container) => ({
          id: container.id,
          name: container.name,
          videoCount: videos?.filter((v) => v.container_id === container.id).length || 0,
        }));

        return {
          videos: videos || [],
          count: videos?.length || 0,
          containers: containerInfo,
        };
      }),
  }),

  // ==================== Video Management ====================

  videos: createTRPCRouter({
    list: adminProcedure
      .input(
        z.object({
          channelId: z.union([z.string().uuid(), z.literal('')]).optional(),
          containerId: z.union([z.string().uuid(), z.literal('')]).optional(),
          search: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        let query = supabaseServer
          .from('youtube_videos')
          .select(`
            *,
            channel:youtube_channels!inner(id, title, user_id),
            container:containers(id, name)
          `)
          .eq('channel.user_id', ctx.user.id);

        if (input.channelId && input.channelId !== '') {
          query = query.eq('channel_id', input.channelId);
        }

        if (input.containerId && input.containerId !== '') {
          query = query.eq('container_id', input.containerId);
        }

        if (input.search) {
          query = query.ilike('title', `%${input.search}%`);
        }

        const { data, error } = await query.order('published_at', {
          ascending: false,
        });

        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

        return data || [];
      }),

    unassigned: adminProcedure.query(async ({ ctx }) => {
      const { data, error } = await supabaseServer
        .from('youtube_videos')
        .select(`
          *,
          channel:youtube_channels!inner(id, title, user_id)
        `)
        .eq('channel.user_id', ctx.user.id)
        .is('container_id', null)
        .order('published_at', { ascending: false });

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      return data;
    }),

    assignToContainer: adminProcedure
      .input(
        z.object({
          videoId: z.string().uuid(),
          containerId: z.string().uuid(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // First verify the video isn't already assigned
        const { data: video } = await supabaseServer
          .from('youtube_videos')
          .select('container_id')
          .eq('id', input.videoId)
          .single();

        if (video?.container_id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Video is already assigned to a container',
          });
        }

        // Get the container's templates
        const { data: container } = await supabaseServer
          .from('containers')
          .select('template_order')
          .eq('id', input.containerId)
          .eq('user_id', ctx.user.id)
          .single();

        if (!container) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Container not found',
          });
        }

        // Assign video to container
        const { error: updateError } = await supabaseServer
          .from('youtube_videos')
          .update({ container_id: input.containerId })
          .eq('id', input.videoId);

        if (updateError) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: updateError.message });

        // Initialize variables for all templates in the container
        if (container.template_order && container.template_order.length > 0) {
          const { data: templates } = await supabaseServer
            .from('templates')
            .select('id, content')
            .in('id', container.template_order);

          if (templates) {
            const variablesToCreate: Array<{
              video_id: string;
              template_id: string;
              variable_name: string;
              variable_value: string;
              variable_type: string;
            }> = [];

            templates.forEach((template) => {
              const variables = parseVariables(template.content);
              variables.forEach((varName) => {
                variablesToCreate.push({
                  video_id: input.videoId,
                  template_id: template.id,
                  variable_name: varName,
                  variable_value: '',
                  variable_type: 'text',
                });
              });
            });

            if (variablesToCreate.length > 0) {
              await supabaseServer
                .from('video_variables')
                .insert(variablesToCreate);
            }
          }
        }

        return { success: true };
      }),

    getVariables: adminProcedure
      .input(z.object({ videoId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const { data, error } = await supabaseServer
          .from('video_variables')
          .select(`
            *,
            template:templates(id, name)
          `)
          .eq('video_id', input.videoId);

        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

        return data;
      }),

    updateVariables: adminProcedure
      .input(
        z.object({
          videoId: z.string().uuid(),
          variables: z.array(
            z.object({
              templateId: z.string().uuid(),
              name: z.string(),
              value: z.string(),
              type: z.enum(['text', 'number', 'date', 'url']),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Upsert all variables
        for (const variable of input.variables) {
          await supabaseServer
            .from('video_variables')
            .upsert(
              {
                video_id: input.videoId,
                template_id: variable.templateId,
                variable_name: variable.name,
                variable_value: variable.value,
                variable_type: variable.type,
              },
              {
                onConflict: 'video_id,template_id,variable_name',
              }
            );
        }

        // Trigger Inngest event to update this video's description
        // Placeholder for now
        return { success: true };
      }),

    preview: adminProcedure
      .input(z.object({ videoId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        // Get video with container
        const { data: video } = await supabaseServer
          .from('youtube_videos')
          .select(`
            *,
            container:containers(id, template_order, separator)
          `)
          .eq('id', input.videoId)
          .single();

        if (!video || !video.container) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Video must be assigned to a container first',
          });
        }

        if (!video.container.template_order || video.container.template_order.length === 0) {
          return { description: '' };
        }

        // Get templates in order
        const { data: templates } = await supabaseServer
          .from('templates')
          .select('id, content')
          .in('id', video.container.template_order);

        if (!templates) {
          return { description: '' };
        }

        // Sort templates according to template_order
        const sortedTemplates = video.container.template_order
          .map((id: string) => templates.find((t) => t.id === id))
          .filter((t): t is { id: string; content: string } => t !== undefined);

        // Get all variables for this video
        const { data: variables } = await supabaseServer
          .from('video_variables')
          .select('variable_name, variable_value')
          .eq('video_id', input.videoId);

        // Build variables map
        const variablesMap: Record<string, string> = {};
        variables?.forEach((v) => {
          variablesMap[v.variable_name] = v.variable_value || '';
        });

        // Build description with container's separator
        const description = buildDescription(
          sortedTemplates,
          variablesMap,
          video.container.separator
        );

        return { description };
      }),

    getHistory: adminProcedure
      .input(z.object({ videoId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const { data, error } = await supabaseServer
          .from('description_history')
          .select('*')
          .eq('video_id', input.videoId)
          .order('version_number', { ascending: false });

        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

        return data;
      }),

    rollback: adminProcedure
      .input(
        z.object({
          videoId: z.string().uuid(),
          historyId: z.string().uuid(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Get the historical description
        const { data: history } = await supabaseServer
          .from('description_history')
          .select('description')
          .eq('id', input.historyId)
          .eq('video_id', input.videoId)
          .single();

        if (!history) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'History entry not found',
          });
        }

        // Update video's current description
        await supabaseServer
          .from('youtube_videos')
          .update({ current_description: history.description })
          .eq('id', input.videoId);

        // Trigger Inngest event to update on YouTube
        // The Inngest job will create the history entry after successful update
        await inngestClient.send({
          name: 'youtube/videos.update',
          data: {
            videoIds: [input.videoId],
            userId: ctx.user.id,
          },
        });

        return { success: true };
      }),

    updateToYouTube: adminProcedure
      .input(
        z.object({
          videoIds: z.array(z.string().uuid()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Trigger Inngest event to update these videos
        await inngestClient.send({
          name: 'youtube/videos.update',
          data: {
            videoIds: input.videoIds,
            userId: ctx.user.id,
          },
        });

        return { success: true };
      }),
  }),
});
