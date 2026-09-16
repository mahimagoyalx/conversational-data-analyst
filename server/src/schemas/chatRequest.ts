import { z } from "zod";

export const ChatRequestSchema = z
  .object({
    question: z.string().trim().min(1, "Question is required."),
  })
  .strict();

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
