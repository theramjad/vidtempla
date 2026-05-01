import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const routerPath = resolve(scriptDir, "../src/server/api/routers/dashboard/youtube.ts");
const source = readFileSync(routerPath, "utf8");

const containerRouterStart = source.indexOf("containers: router({");
const templateRouterStart = source.indexOf("templates: router({", containerRouterStart);

assert.notEqual(containerRouterStart, -1, "containers router block was not found");
assert.notEqual(templateRouterStart, -1, "templates router block was not found");

const containerRouter = source.slice(containerRouterStart, templateRouterStart);
const getAffectedVideosStart = containerRouter.indexOf("getAffectedVideos: orgProcedure");
const procedureEnd = containerRouter.indexOf("  }),", getAffectedVideosStart);

assert.notEqual(
  getAffectedVideosStart,
  -1,
  "containers.getAffectedVideos procedure was not found"
);
assert.notEqual(procedureEnd, -1, "containers.getAffectedVideos procedure end was not found");

const procedure = containerRouter.slice(getAffectedVideosStart, procedureEnd);

assert.match(
  procedure,
  /\.innerJoin\(\s*containers\s*,\s*eq\(\s*containers\.id\s*,\s*youtubeVideos\.containerId\s*\)\s*\)/s,
  "containers.getAffectedVideos must join youtubeVideos through containers"
);
assert.match(
  procedure,
  /eq\(\s*youtubeVideos\.containerId\s*,\s*input\.containerId\s*\)/s,
  "containers.getAffectedVideos must filter by the requested container id"
);
assert.match(
  procedure,
  /eq\(\s*containers\.organizationId\s*,\s*ctx\.organizationId\s*\)/s,
  "containers.getAffectedVideos must filter by the active organization"
);

console.log("youtube router org guard checks passed");
