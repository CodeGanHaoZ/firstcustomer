import { z } from "zod";

export const researchOutput = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("need_info"),
    questions: z
      .array(z.object({ question: z.string(), why: z.string() }))
      .min(1)
      .max(3),
  }),
  z.object({
    status: z.literal("done"),
    summary: z.string(),
    candidates: z
      .array(
        z.object({
          name: z.string(),
          why: z.string(),
          evidence_ids: z.array(z.string()),
        }),
      )
      .min(1),
    unknowns: z.array(z.string()),
  }),
]);
export type ResearchOutput = z.infer<typeof researchOutput>;

export const visionOutput = z.object({
  summary: z.string(),
  visible_text: z.array(z.string()),
  features: z.array(z.string()),
  prices: z.array(z.string()),
  audience_hints: z.array(z.string()),
});
export type VisionOutput = z.infer<typeof visionOutput>;

export const positioningOption = z.object({
  audience: z.string(),
  problem: z.string(),
  value_prop: z.string(),
  why: z.string(),
});
export type PositioningOption = z.infer<typeof positioningOption>;

export const experimentPlan = z.object({
  hypothesis: z.string(),
  channel: z.string(),
  min_visits: z.number().int().positive(),
  pass_leads: z.number().int().positive(),
});

export const sendBackRequest = z.object({
  missing: z.string(),
  reason: z.string(),
  source_types: z.array(z.string()),
});
export type SendBackRequest = z.infer<typeof sendBackRequest>;

export const strategyOutput = z.discriminatedUnion("status", [
  z.object({ status: z.literal("need_more"), request: sendBackRequest }),
  z.object({
    status: z.literal("done"),
    options: z.array(positioningOption).min(1).max(2),
    recommended_option: z.number().int().min(0).max(1),
    rationale: z.string(),
    experiment: experimentPlan,
    counter_responses: z.array(
      z.object({
        evidence_id: z.string(),
        response: z.enum(["accepted", "rebutted", "to_test"]),
        note: z.string(),
      }),
    ),
    guidance_for_launch: z.string().optional(),
  }),
]);
export type StrategyOutput = z.infer<typeof strategyOutput>;

export const pageContent = z.object({
  headline: z.string(),
  subheadline: z.string(),
  value_props: z.array(z.string()).min(1).max(4),
  scenarios: z.array(z.string()).min(1).max(3),
  cta_label: z.string(),
  form_prompt: z.string(),
});
export type PageContent = z.infer<typeof pageContent>;

export const launchOutput = z.discriminatedUnion("status", [
  z.object({ status: z.literal("need_more"), request: sendBackRequest }),
  z.object({
    status: z.literal("done"),
    page: pageContent,
    claims: z.array(
      z.object({
        text: z.string(),
        kind: z.enum(["metric", "comparison", "pain", "feature"]),
        evidence_id: z.string().nullable(),
        location: z.enum(["page", "asset"]),
      }),
    ),
    channel: z.object({
      name: z.string(),
      reason: z.string(),
      checklist: z.array(z.string()),
      assets: z
        .array(z.object({ title: z.string(), body: z.string() }))
        .min(1)
        .max(3),
    }),
  }),
]);
export type LaunchOutput = z.infer<typeof launchOutput>;

export const growthOutput = z.object({
  summary: z.string(),
  actions_taken: z.array(z.string()),
  uncertainties: z.array(z.string()),
  next_steps: z.array(z.string()),
  next_hypothesis: z.string().nullable(),
});
export type GrowthOutput = z.infer<typeof growthOutput>;
