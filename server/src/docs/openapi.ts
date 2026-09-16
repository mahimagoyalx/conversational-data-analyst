import type { JsonObject } from "swagger-ui-express";

const errorCodes = [
  "invalid_request",
  "unsupported_question",
  "invalid_plan",
  "database_error",
  "internal_error",
] as const;

const errorResponse = {
  description: "Client-safe error. Internal SQL, stack traces, and file paths are never returned.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
    },
  },
};

export const openApiDocument: JsonObject = {
  openapi: "3.0.3",
  info: {
    title: "Conversational Data Analyst API",
    version: "0.1.0",
    description: [
      "Ask natural-language questions about synthetic banking data.",
      "",
      "The client sends only a question. The server planner produces a structured QueryPlan;",
      "a trusted Query Builder maps that plan to parameterized SQL. Raw SQL is never accepted",
      "from the client or the planner.",
    ].join(" "),
  },
  servers: [{ url: "/", description: "Current host" }],
  tags: [
    { name: "Health", description: "Service liveness" },
    { name: "Chat", description: "Conversational analytics" },
    { name: "Docs", description: "OpenAPI description" },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        operationId: "getHealth",
        responses: {
          "200": {
            description: "Service is running",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
                example: {
                  success: true,
                  data: { status: "ok" },
                },
              },
            },
          },
        },
      },
    },
    "/api/chat": {
      post: {
        tags: ["Chat"],
        summary: "Ask an analytics question",
        operationId: "postChat",
        description: [
          "Validates a non-empty question, plans a QueryPlan, executes a trusted SELECT,",
          "and returns a natural-language answer plus visualization data.",
          "Extra request fields (including `sql`) are rejected.",
        ].join(" "),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChatRequest" },
              examples: {
                onboarding: {
                  summary: "Segment-filtered onboarding count",
                  value: { question: "How many Retail customers were onboarded?" },
                },
                comparison: {
                  summary: "Categorical comparison",
                  value: { question: "Show onboarding volume by segment." },
                },
                topCustomers: {
                  summary: "Top customers by transaction value",
                  value: { question: "Show the top five customers by transaction value." },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Structured analytics result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ChatSuccessResponse" },
                example: {
                  success: true,
                  data: {
                    answer: "There were 53 Retail onboarding applications.",
                    visualization: { type: "kpi", title: "Onboarding count" },
                    columns: [{ key: "value", label: "Onboarding count" }],
                    rows: [{ value: 53 }],
                  },
                },
              },
            },
          },
          "400": {
            ...errorResponse,
            description: "Missing, empty, or extra request fields",
          },
          "422": {
            ...errorResponse,
            description: "Question is outside supported analytics, including SQL-like input",
          },
          "500": {
            ...errorResponse,
            description: "Invalid planner output or database failure",
          },
        },
      },
    },
    "/api/openapi.json": {
      get: {
        tags: ["Docs"],
        summary: "OpenAPI document",
        operationId: "getOpenApiDocument",
        responses: {
          "200": {
            description: "OpenAPI 3 description of this API",
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ChatRequest: {
        type: "object",
        additionalProperties: false,
        required: ["question"],
        properties: {
          question: {
            type: "string",
            minLength: 1,
            description: "Natural-language analytics question. Must not be empty or SQL.",
            example: "How many Retail customers were onboarded?",
          },
        },
      },
      Visualization: {
        type: "object",
        required: ["type", "title"],
        properties: {
          type: {
            type: "string",
            enum: ["kpi", "table", "bar", "line"],
          },
          title: { type: "string" },
        },
      },
      AnalyticsColumn: {
        type: "object",
        required: ["key", "label"],
        properties: {
          key: { type: "string", example: "value" },
          label: { type: "string", example: "Onboarding count" },
        },
      },
      AnalyticsRow: {
        type: "object",
        required: ["value"],
        properties: {
          label: {
            type: "string",
            description: "Present for grouped or ranked results",
          },
          value: {
            type: "number",
            nullable: true,
          },
        },
      },
      AnalyticsResult: {
        type: "object",
        required: ["answer", "visualization", "columns", "rows"],
        properties: {
          answer: {
            type: "string",
            description: "Natural-language summary of the query result",
          },
          visualization: { $ref: "#/components/schemas/Visualization" },
          columns: {
            type: "array",
            items: { $ref: "#/components/schemas/AnalyticsColumn" },
          },
          rows: {
            type: "array",
            items: { $ref: "#/components/schemas/AnalyticsRow" },
          },
        },
      },
      ChatSuccessResponse: {
        type: "object",
        required: ["success", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          data: { $ref: "#/components/schemas/AnalyticsResult" },
        },
      },
      ErrorBody: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: { type: "string", enum: [...errorCodes] },
          message: { type: "string" },
        },
      },
      ErrorResponse: {
        type: "object",
        required: ["success", "error"],
        properties: {
          success: { type: "boolean", enum: [false] },
          error: { $ref: "#/components/schemas/ErrorBody" },
        },
      },
      HealthResponse: {
        type: "object",
        required: ["success", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          data: {
            type: "object",
            required: ["status"],
            properties: {
              status: { type: "string", example: "ok" },
            },
          },
        },
      },
    },
  },
};
