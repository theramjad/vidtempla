/**
 * YouTube tRPC router
 * Handles all YouTube-related API procedures
 */

import { z } from 'zod';
import { protectedProcedure } from '@/server/trpc/init';
import { TRPCError } from '@trpc/server';
import { getOAuthUrl } from '@/lib/clients/youtube';
import { decrypt, encrypt } from '@/utils/encryption';
import { refreshAccessToken, fetchChannelVideos } from '@/lib/clients/youtube';
import {
  parseVariables,
  parseUserVariables,
  buildDescription,
  findMissingVariables,
} from '@/utils/templateParser';
import { inngestClient } from '@/lib/clients/inngest';
import { db } from '@/db';
import { youtubeChannels, containers, templates, youtubeVideos, videoVariables, descriptionHistory } from '@/db/schema';
import { eq, and, desc, asc, sql, count, isNull, ilike, inArray, getTableColumns } from 'drizzle-orm';
import { checkVideoLimit, checkChannelLimit } from '@/lib/plan-limits';
import { router } from '@/server/trpc/init';

export const youtubeRouter = router({
  // ==================== Channel Management ====================

  channels: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const data = await db
        .select()
        .from(youtubeChannels)
        .where(eq(youtubeChannels.userId, ctx.user.id))
        .orderBy(desc(youtubeChannels.createdAt));

      return data;
    }),

    checkLimit: protectedProcedure.query(async ({ ctx }) => {
      const result = await checkChannelLimit(ctx.user.id, db);
      return result;
    }),

    initiateOAuth: protectedProcedure.mutation(async () => {
      return { url: getOAuthUrl() };
    }),

    disconnect: protectedProcedure
      .input(z.object({ channelId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await db
          .delete(youtubeChannels)
          .where(and(eq(youtubeChannels.id, input.channelId), eq(youtubeChannels.userId, ctx.user.id)));

        return { success: true };
      }),

    syncVideos: protectedProcedure
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

  containers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const data = await db
        .select({
          ...getTableColumns(containers),
          videoCount: count(youtubeVideos.id),
        })
        .from(containers)
        .leftJoin(youtubeVideos, eq(youtubeVideos.containerId, containers.id))
        .where(eq(containers.userId, ctx.user.id))
        .groupBy(containers.id)
        .orderBy(desc(containers.createdAt));

      return data;
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          templateIds: z.array(z.string().uuid()),
          separator: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const [data] = await db
          .insert(containers)
          .values({
            userId: ctx.user.id,
            name: input.name,
            templateOrder: input.templateIds,
            separator: input.separator ?? '\n\n',
          })
          .returning();

        return data;
      }),

    update: protectedProcedure
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
          templateOrder?: string[];
          separator?: string;
        } = {};
        if (input.name) updateData.name = input.name;
        if (input.templateIds) updateData.templateOrder = input.templateIds;
        if (input.separator !== undefined) updateData.separator = input.separator;

        const [data] = await db
          .update(containers)
          .set(updateData)
          .where(and(eq(containers.id, input.id), eq(containers.userId, ctx.user.id)))
          .returning();

        // Trigger Inngest event to update all videos in this container
        // Only trigger if template_order or separator changed (affects description)
        if (input.templateIds !== undefined || input.separator !== undefined) {
          const videos = await db
            .select({ id: youtubeVideos.id })
            .from(youtubeVideos)
            .where(eq(youtubeVideos.containerId, input.id));

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

    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await db
          .delete(containers)
          .where(and(eq(containers.id, input.id), eq(containers.userId, ctx.user.id)));

        return { success: true };
      }),

    getAffectedVideos: protectedProcedure
      .input(z.object({ containerId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const videos = await db
          .select({
            id: youtubeVideos.id,
            title: youtubeVideos.title,
            videoId: youtubeVideos.videoId,
          })
          .from(youtubeVideos)
          .where(eq(youtubeVideos.containerId, input.containerId))
          .orderBy(asc(youtubeVideos.title));

        return {
          videos: videos || [],
          count: videos?.length || 0,
        };
      }),
  }),

  // ==================== Template Management ====================

  templates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const data = await db
        .select()
        .from(templates)
        .where(eq(templates.userId, ctx.user.id))
        .orderBy(desc(templates.createdAt));

      // Add variable count to each template
      return data.map((template) => ({
        ...template,
        variables: parseVariables(template.content),
      }));
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          content: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const [data] = await db
          .insert(templates)
          .values({
            userId: ctx.user.id,
            name: input.name,
            content: input.content,
          })
          .returning();

        return data;
      }),

    update: protectedProcedure
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

        const [data] = await db
          .update(templates)
          .set(updateData)
          .where(and(eq(templates.id, input.id), eq(templates.userId, ctx.user.id)))
          .returning();

        // Trigger Inngest event to update all videos using this template
        // Only trigger if content changed (affects description)
        if (input.content !== undefined) {
          // Find all containers that use this template
          const containersData = await db
            .select({ id: containers.id })
            .from(containers)
            .where(
              and(
                eq(containers.userId, ctx.user.id),
                sql`${containers.templateOrder}::jsonb @> ${JSON.stringify([input.id])}::jsonb`
              )
            );

          if (containersData && containersData.length > 0) {
            const containerIds = containersData.map((c) => c.id);

            // Get all videos from these containers
            const videos = await db
              .select({ id: youtubeVideos.id })
              .from(youtubeVideos)
              .where(inArray(youtubeVideos.containerId, containerIds));

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

    delete: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await db
          .delete(templates)
          .where(and(eq(templates.id, input.id), eq(templates.userId, ctx.user.id)));

        return { success: true };
      }),

    parseVariables: protectedProcedure
      .input(z.object({ content: z.string() }))
      .query(({ input }) => {
        return { variables: parseVariables(input.content) };
      }),

    getAffectedVideos: protectedProcedure
      .input(z.object({ templateId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        // First, find all containers that use this template
        const containersData = await db
          .select({
            id: containers.id,
            name: containers.name,
            templateOrder: containers.templateOrder,
          })
          .from(containers)
          .where(
            and(
              eq(containers.userId, ctx.user.id),
              sql`${containers.templateOrder}::jsonb @> ${JSON.stringify([input.templateId])}::jsonb`
            )
          );

        if (!containersData || containersData.length === 0) {
          return {
            videos: [],
            count: 0,
            containers: [],
          };
        }

        // Get all videos from these containers
        const containerIds = containersData.map((c) => c.id);
        const videos = await db
          .select({
            id: youtubeVideos.id,
            title: youtubeVideos.title,
            videoId: youtubeVideos.videoId,
            containerId: youtubeVideos.containerId,
          })
          .from(youtubeVideos)
          .where(inArray(youtubeVideos.containerId, containerIds))
          .orderBy(asc(youtubeVideos.title));

        // Build container info with video counts
        const containerInfo = containersData.map((container) => ({
          id: container.id,
          name: container.name,
          videoCount: videos?.filter((v) => v.containerId === container.id).length || 0,
        }));

        return {
          videos: videos || [],
          count: videos?.length || 0,
          containers: containerInfo,
        };
      }),
  }),

  // ==================== Video Management ====================

  videos: router({
    list: protectedProcedure
      .input(
        z.object({
          channelId: z.union([z.string().uuid(), z.literal('')]).optional(),
          containerId: z.union([z.string().uuid(), z.literal('')]).optional(),
          search: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const filters = [eq(youtubeChannels.userId, ctx.user.id)];

        if (input.channelId && input.channelId !== '') {
          filters.push(eq(youtubeVideos.channelId, input.channelId));
        }

        if (input.containerId && input.containerId !== '') {
          filters.push(eq(youtubeVideos.containerId, input.containerId));
        }

        if (input.search) {
          filters.push(ilike(youtubeVideos.title, `%${input.search}%`));
        }

        const results = await db
          .select({
            ...getTableColumns(youtubeVideos),
            channel: {
              id: youtubeChannels.id,
              title: youtubeChannels.title,
              userId: youtubeChannels.userId,
              channelId: youtubeChannels.channelId,
            },
            container: {
              id: containers.id,
              name: containers.name,
            },
          })
          .from(youtubeVideos)
          .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
          .leftJoin(containers, eq(youtubeVideos.containerId, containers.id))
          .where(and(...filters))
          .orderBy(desc(youtubeVideos.publishedAt));

        return results;
      }),

    unassigned: protectedProcedure.query(async ({ ctx }) => {
      const data = await db
        .select({
          ...getTableColumns(youtubeVideos),
          channel: {
            id: youtubeChannels.id,
            title: youtubeChannels.title,
            userId: youtubeChannels.userId,
            channelId: youtubeChannels.channelId,
          },
        })
        .from(youtubeVideos)
        .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
        .where(and(eq(youtubeChannels.userId, ctx.user.id), isNull(youtubeVideos.containerId)))
        .orderBy(desc(youtubeVideos.publishedAt));

      return data;
    }),

    assignToContainer: protectedProcedure
      .input(
        z.object({
          videoId: z.string().uuid(),
          containerId: z.string().uuid(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // First verify the video isn't already assigned
        const [video] = await db
          .select({ containerId: youtubeVideos.containerId })
          .from(youtubeVideos)
          .where(eq(youtubeVideos.id, input.videoId));

        if (video?.containerId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Video is already assigned to a container',
          });
        }

        // Check if user has reached their assigned video limit
        // We count videos that are already assigned to containers
        const channels = await db
          .select({ id: youtubeChannels.id })
          .from(youtubeChannels)
          .where(eq(youtubeChannels.userId, ctx.user.id));

        const channelIds = channels?.map((c) => c.id) || [];

        if (channelIds.length > 0) {
          const [{ assignedCount }] = await db
            .select({ assignedCount: count() })
            .from(youtubeVideos)
            .where(
              and(
                inArray(youtubeVideos.channelId, channelIds),
                sql`${youtubeVideos.containerId} IS NOT NULL`
              )
            );

          const limitCheck = await checkVideoLimit(ctx.user.id, db);

          // If adding this video would exceed the limit, reject
          if ((assignedCount || 0) >= limitCheck.limit) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `You have reached your assigned video limit (${limitCheck.limit} videos on the ${limitCheck.planTier} plan). Please upgrade your plan to assign more videos to containers.`,
            });
          }
        }

        // Get the container's templates
        const [container] = await db
          .select({ templateOrder: containers.templateOrder })
          .from(containers)
          .where(and(eq(containers.id, input.containerId), eq(containers.userId, ctx.user.id)));

        if (!container) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Container not found',
          });
        }

        // Assign video to container
        await db
          .update(youtubeVideos)
          .set({ containerId: input.containerId })
          .where(eq(youtubeVideos.id, input.videoId));

        // Initialize variables for all templates in the container
        if (container.templateOrder && container.templateOrder.length > 0) {
          const templatesData = await db
            .select({
              id: templates.id,
              content: templates.content,
            })
            .from(templates)
            .where(inArray(templates.id, container.templateOrder));

          if (templatesData) {
            const variablesToCreate: Array<{
              videoId: string;
              templateId: string;
              variableName: string;
              variableValue: string;
            }> = [];

            templatesData.forEach((template) => {
              const variables = parseUserVariables(template.content);
              variables.forEach((varName) => {
                variablesToCreate.push({
                  videoId: input.videoId,
                  templateId: template.id,
                  variableName: varName,
                  variableValue: '',
                });
              });
            });

            if (variablesToCreate.length > 0) {
              await db.insert(videoVariables).values(variablesToCreate);
            }
          }
        }

        return { success: true };
      }),

    getVariables: protectedProcedure
      .input(z.object({ videoId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const data = await db
          .select({
            ...getTableColumns(videoVariables),
            template: {
              id: templates.id,
              name: templates.name,
              content: templates.content,
            },
          })
          .from(videoVariables)
          .leftJoin(templates, eq(videoVariables.templateId, templates.id))
          .where(eq(videoVariables.videoId, input.videoId));

        // Get video and container info for preview
        const [videoData] = await db
          .select({
            videoId: youtubeVideos.videoId,
            container: {
              id: containers.id,
              templateOrder: containers.templateOrder,
              separator: containers.separator,
            },
          })
          .from(youtubeVideos)
          .leftJoin(containers, eq(youtubeVideos.containerId, containers.id))
          .where(eq(youtubeVideos.id, input.videoId));

        return {
          variables: data,
          video: videoData || null,
        };
      }),

    updateVariables: protectedProcedure
      .input(
        z.object({
          videoId: z.string().uuid(),
          variables: z.array(
            z.object({
              templateId: z.string().uuid(),
              name: z.string(),
              value: z.string(),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Upsert all variables
        for (const variable of input.variables) {
          await db
            .insert(videoVariables)
            .values({
              videoId: input.videoId,
              templateId: variable.templateId,
              variableName: variable.name,
              variableValue: variable.value,
            })
            .onConflictDoUpdate({
              target: [videoVariables.videoId, videoVariables.templateId, videoVariables.variableName],
              set: {
                variableValue: variable.value,
              },
            });
        }

        // Trigger Inngest event to update this video's description
        await inngestClient.send({
          name: 'youtube/videos.update',
          data: {
            videoIds: [input.videoId],
            userId: ctx.user.id,
          },
        });

        return { success: true };
      }),

    getHistory: protectedProcedure
      .input(z.object({ videoId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const data = await db
          .select()
          .from(descriptionHistory)
          .where(eq(descriptionHistory.videoId, input.videoId))
          .orderBy(desc(descriptionHistory.versionNumber));

        return data;
      }),

    rollback: protectedProcedure
      .input(
        z.object({
          videoId: z.string().uuid(),
          historyId: z.string().uuid(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Get the historical description
        const [history] = await db
          .select({ description: descriptionHistory.description })
          .from(descriptionHistory)
          .where(
            and(
              eq(descriptionHistory.id, input.historyId),
              eq(descriptionHistory.videoId, input.videoId)
            )
          );

        if (!history) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'History entry not found',
          });
        }

        // Get current video state (for return metadata)
        const [video] = await db
          .select({ containerId: youtubeVideos.containerId })
          .from(youtubeVideos)
          .where(eq(youtubeVideos.id, input.videoId));

        const variables = await db
          .select({ id: videoVariables.id })
          .from(videoVariables)
          .where(eq(videoVariables.videoId, input.videoId));

        const hadContainer = !!video?.containerId;
        const variableCount = variables?.length || 0;

        // DELINK: Set container_id to NULL if video is currently in a container
        if (hadContainer) {
          await db
            .update(youtubeVideos)
            .set({ containerId: null })
            .where(eq(youtubeVideos.id, input.videoId));
        }

        // CLEAR VARIABLES: Delete all video_variables for this video
        if (variableCount > 0) {
          await db
            .delete(videoVariables)
            .where(eq(videoVariables.videoId, input.videoId));
        }

        // Update video's current description
        await db
          .update(youtubeVideos)
          .set({ currentDescription: history.description })
          .where(eq(youtubeVideos.id, input.videoId));

        // Trigger Inngest event to update on YouTube
        // The Inngest job will create the history entry after successful update
        await inngestClient.send({
          name: 'youtube/videos.update',
          data: {
            videoIds: [input.videoId],
            userId: ctx.user.id,
          },
        });

        return {
          success: true,
          delinkedContainer: hadContainer,
          variablesCleared: variableCount,
        };
      }),

    updateToYouTube: protectedProcedure
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
