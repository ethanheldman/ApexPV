// Step / pole-weight recommender from body height + weight.
//
// These are heuristics from common pole vault coaching. They're starting
// points — a real coach should always override.
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const CalcQuery = z.object({
  height_cm: z.coerce.number().min(120).max(230).optional(),
  weight_lb: z.coerce.number().min(60).max(400).optional(),
  experience: z.enum(["beginner", "intermediate", "advanced", "elite"]).default("intermediate"),
});

const STEPS_FOR = {
  beginner: 6,
  intermediate: 8,
  advanced: 10,
  elite: 12,
} as const;

export async function calcRoutes(app: FastifyInstance) {
  app.get("/step", async (req, reply) => {
    const parsed = CalcQuery.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const { height_cm, weight_lb, experience } = parsed.data;
    if (!height_cm || !weight_lb)
      return reply
        .code(400)
        .send({ error: "Need both height_cm and weight_lb. Add them in Settings." });

    // Stride length ≈ 1.17 × leg length; leg length ≈ 0.45 × body height.
    const heightIn = height_cm / 2.54;
    const legLengthIn = heightIn * 0.45;
    const strideIn = legLengthIn * 1.17;

    const steps = STEPS_FOR[experience];
    // Mid-mark = stride × (steps / 2). On a left-foot lead approach, the mid-mark
    // is hit at the (steps/2 + 1)-th step from the box. Close enough for coaching.
    const midMarkIn = strideIn * (steps / 2);
    const fullApproachIn = strideIn * steps;

    // Pole weight rec: floor at body weight, recommended +5/+10/+15 by experience.
    const polePadByExp = { beginner: 0, intermediate: 5, advanced: 10, elite: 15 };
    const recPoleLb = weight_lb + polePadByExp[experience];

    // Approximate pole length: shorter for beginners, longer with experience
    const poleLenFt = { beginner: 13.0, intermediate: 13.5, advanced: 14.5, elite: 15.0 }[
      experience
    ];

    return {
      experience,
      stride_in: Number(strideIn.toFixed(1)),
      steps,
      mid_mark_in: Number(midMarkIn.toFixed(0)),
      mid_mark_ft: Number((midMarkIn / 12).toFixed(1)),
      full_approach_in: Number(fullApproachIn.toFixed(0)),
      full_approach_ft: Number((fullApproachIn / 12).toFixed(1)),
      recommended_pole_weight_lb: recPoleLb,
      recommended_pole_length_ft: poleLenFt,
      caveat:
        "Heuristic only. Real step depends on speed, plant timing, and coach input.",
    };
  });
}
