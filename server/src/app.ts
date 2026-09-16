import express from "express";
import type Database from "better-sqlite3";
import { MockQueryPlanner, type QueryPlanner } from "./planner/queryPlanner.js";
import { ChatService } from "./services/chatService.js";
import { createApiRouter } from "./routes/api.js";
import { errorHandler } from "./http/errorHandler.js";
import { clientErrorBody, ErrorCodes } from "./http/errors.js";

export type AppDependencies = {
  db: Database.Database;
  planner?: QueryPlanner;
};

export function createApp(deps: AppDependencies) {
  const app = express();
  const planner = deps.planner ?? new MockQueryPlanner();
  const chatService = new ChatService({ planner, db: deps.db });

  app.use(express.json());
  app.use("/api", createApiRouter(chatService));

  app.use((_req, res) => {
    res.status(404).json(
      clientErrorBody(ErrorCodes.INVALID_REQUEST, "Not found."),
    );
  });

  app.use(errorHandler);
  return app;
}
