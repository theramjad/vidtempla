import { defineConfig } from "@trigger.dev/sdk/v3";
import { syncVercelEnvVars } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: "proj_sddbyhqqadsdfcrxycch",
  runtime: "node",
  logLevel: "log",
  maxDuration: 720,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  machine: "micro",
  dirs: ["./src/trigger"],
  build: {
    extensions: [
      syncVercelEnvVars({
        projectId: "prj_8JcHH2ynheBrW2pc2KTUMdTEbvNQ",
        vercelTeamId: "team_EnX8JK9URpU5sW8LFtwVLgoz",
      }),
    ],
  },
});
