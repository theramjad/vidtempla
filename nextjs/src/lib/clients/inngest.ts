import { InngestEvents } from "@shared-types/inngest";
import { EventSchemas, Inngest } from "inngest";

// Shared Inngest client configured for the Next.js application.
// We keep the ID consistent across apps so functions can be served from
// multiple runtimes without duplication.
export const inngestClient = new Inngest({
  id: "admin-dashboard-template",
  schemas: new EventSchemas().fromRecord<InngestEvents>(),
}); 