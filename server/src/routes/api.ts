import { Router } from "express";
import { ChatRequestSchema } from "../schemas/chatRequest.js";
import type { ChatService } from "../services/chatService.js";

export function createApiRouter(chatService: ChatService) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      success: true,
      data: { status: "ok" },
    });
  });

  router.post("/chat", (req, res, next) => {
    try {
      const body = ChatRequestSchema.parse(req.body);
      const data = chatService.ask(body.question);
      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
