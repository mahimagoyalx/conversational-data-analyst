import type Database from "better-sqlite3";
import type { QueryPlanner } from "../planner/queryPlanner.js";
import { parseQueryPlan } from "../schemas/queryPlan.js";
import { ErrorCodes, HttpError } from "../http/errors.js";
import { buildQuery, QueryBuilderError } from "./queryBuilder.js";
import { presentAnalytics, type AnalyticsResult } from "./analyticsPresenter.js";

export type ChatServiceDependencies = {
  planner: QueryPlanner;
  db: Database.Database;
};

export class ChatService {
  constructor(private readonly deps: ChatServiceDependencies) {}

  ask(question: string): AnalyticsResult {
    const plannerResult = this.deps.planner.plan(question);
    if (!plannerResult.ok) {
      throw new HttpError(422, ErrorCodes.UNSUPPORTED_QUESTION, plannerResult.message);
    }

    let plan;
    try {
      plan = parseQueryPlan(plannerResult.plan);
    } catch {
      throw new HttpError(
        500,
        ErrorCodes.INVALID_PLAN,
        "I couldn't interpret that question.",
      );
    }

    let built;
    try {
      built = buildQuery(plan);
    } catch (err) {
      if (err instanceof QueryBuilderError) {
        throw new HttpError(
          500,
          ErrorCodes.INVALID_PLAN,
          "I couldn't answer that question with the available analytics.",
        );
      }
      throw err;
    }

    let rawRows: unknown[];
    try {
      rawRows = this.deps.db.prepare(built.sql).all(...built.params);
    } catch {
      throw new HttpError(
        500,
        ErrorCodes.DATABASE_ERROR,
        "I couldn't retrieve analytics right now.",
      );
    }

    return presentAnalytics(plan, rawRows);
  }
}
