# Spam Comment Detection

Auto-detect and remove spam comments on YouTube videos using a cheap LLM.

## Steps
1. Collect spam comment samples from existing `list_comment_threads` data
2. Build classification prompt (spam vs legitimate) targeting a cheap model (Haiku or similar)
3. Add MCP tool + REST endpoint for scanning and bulk-removing spam comments
4. Optional: Inngest scheduled task to auto-scan periodically
