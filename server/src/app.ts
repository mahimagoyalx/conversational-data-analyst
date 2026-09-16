import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json());

  // Analytics API routes will be added later.
  // QueryPlanner must never generate SQL; QueryBuilder maps validated QueryPlans
  // to trusted parameterized queries.

  return app;
}
