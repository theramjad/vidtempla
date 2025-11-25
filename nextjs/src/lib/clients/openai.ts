import OpenAI from 'openai';
import { env } from '@/env/server.mjs';

const globalForOpenAI = globalThis as unknown as {
  openai: OpenAI | undefined;
};

export const openai =
  globalForOpenAI.openai ??
  new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

if (env.NODE_ENV !== 'production') globalForOpenAI.openai = openai;
