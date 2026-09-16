export type VisualizationType = "kpi" | "table" | "bar" | "line";

export type Visualization = {
  type: VisualizationType;
  title: string;
};

export type AnalyticsColumn = {
  key: string;
  label: string;
};

export type AnalyticsRow = {
  label?: string;
  value: number | null;
};

export type AnalyticsResult = {
  answer: string;
  visualization: Visualization;
  columns: AnalyticsColumn[];
  rows: AnalyticsRow[];
};

export type ChatSuccess = {
  success: true;
  data: AnalyticsResult;
};

export type ChatFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type ChatResponse = ChatSuccess | ChatFailure;

export class ChatApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ChatApiError";
    this.code = code;
  }
}

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  result?: AnalyticsResult;
  errorCode?: string;
};
