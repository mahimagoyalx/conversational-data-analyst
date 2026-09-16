import { ChatApiError, type ChatResponse, type ChatSuccess } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isChatResponse(value: unknown): value is ChatResponse {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    return false;
  }
  if (value.success) {
    return isRecord(value.data);
  }
  return isRecord(value.error) && typeof value.error.message === "string";
}

export async function askQuestion(question: string): Promise<ChatSuccess> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
  } catch {
    throw new ChatApiError(
      "api_failure",
      "Could not reach the analytics service. Check that the backend is running.",
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ChatApiError("api_failure", "The server returned an invalid response.");
  }

  if (!isChatResponse(payload)) {
    throw new ChatApiError("api_failure", "The server returned an unexpected response.");
  }

  if (!payload.success) {
    throw new ChatApiError(payload.error.code, payload.error.message);
  }

  return payload;
}
