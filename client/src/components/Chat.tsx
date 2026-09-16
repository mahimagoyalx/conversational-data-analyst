import { useState, type FormEvent } from "react";
import { askQuestion } from "../api";
import { ChatApiError, type ChatMessage } from "../types";
import Message from "./Message";

export const SUGGESTED_QUESTIONS = [
  "Show monthly onboarding applications by customer segment.",
  "Which branches have the highest rejection rate?",
  "Compare retail and SME onboarding volumes.",
  "Show the top five customers by transaction value.",
] as const;

function nextId() {
  return crypto.randomUUID();
}

function errorCopy(err: unknown): { text: string; code: string } {
  if (err instanceof ChatApiError) {
    if (err.code === "unsupported_question") {
      return { text: err.message, code: err.code };
    }
    if (err.code === "invalid_request") {
      return { text: err.message, code: err.code };
    }
    return { text: err.message, code: err.code };
  }
  return {
    text: "Something went wrong while contacting the analytics service.",
    code: "api_failure",
  };
}

export default function Chat() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  const canSubmit = !loading;

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      setInputError("Enter a question before asking.");
      return;
    }

    setInputError(null);
    setQuestion("");
    setLoading(true);
    setMessages((current) => [
      ...current,
      { id: nextId(), role: "user", text: trimmed },
    ]);

    try {
      const response = await askQuestion(trimmed);
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: "assistant",
          text: response.data.answer,
          result: response.data,
        },
      ]);
    } catch (err) {
      const copy = errorCopy(err);
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: "assistant",
          text: copy.text,
          errorCode: copy.code,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(question);
  }

  return (
    <div className="chat">
      <section className="chat__history" aria-live="polite">
        {messages.length === 0 && (
          <p className="chat__empty">
            Ask a question about onboarding or transactions, or choose a suggestion.
          </p>
        )}
        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
        {loading && (
          <p className="message message--assistant message--loading">Analyst is working…</p>
        )}
      </section>

      <div className="chat__suggestions">
        {SUGGESTED_QUESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="chip"
            disabled={loading}
            onClick={() => void submit(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form className="chat__composer" onSubmit={onSubmit}>
        <label htmlFor="question" className="sr-only">
          Question
        </label>
        <input
          id="question"
          name="question"
          value={question}
          disabled={loading}
          placeholder="Ask about onboarding or transactions"
          onChange={(event) => {
            setQuestion(event.target.value);
            if (inputError) {
              setInputError(null);
            }
          }}
        />
        <button type="submit" disabled={!canSubmit}>
          Ask
        </button>
      </form>
      {inputError && (
        <p className="chat__input-error" role="alert">
          {inputError}
        </p>
      )}
    </div>
  );
}
