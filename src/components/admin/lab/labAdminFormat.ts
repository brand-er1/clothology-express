import type { Tone } from "@/lib/admin/format";
import type { LabStatus } from "../../../../supabase/functions/_shared/labApplication";

export const LAB_STATUS_TONE: Record<LabStatus, Tone> = {
  received: "amber",
  reviewing: "blue",
  selected: "wine",
  not_selected: "neutral",
  filming_scheduled: "violet",
  in_production: "violet",
  production_done: "green",
  content_published: "green",
};
