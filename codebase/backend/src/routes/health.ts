import { Router } from "express";
import { getAiHealth } from "../services/hfInferenceService.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "feedback-api" });
});

router.get("/ai/health", (_req, res) => {
  getAiHealth()
    .then((health) => res.json(health))
    .catch((error) =>
      res.json({
        provider: "huggingface",
        status: "down",
        model: "unknown",
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error),
      }),
    );
});

export default router;
