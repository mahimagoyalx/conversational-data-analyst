import {
  parseQueryPlan,
  type CustomerSegment,
  type OnboardingStatus,
  type QueryPlan,
} from "../schemas/queryPlan.js";

export type PlannerErrorType = "unsupported_question";

export type PlannerResult =
  | { ok: true; plan: QueryPlan }
  | { ok: false; errorType: PlannerErrorType; message: string };

export interface QueryPlanner {
  plan(question: string): PlannerResult;
}

const UNSUPPORTED_MESSAGE =
  "I can answer onboarding and transaction analytics questions, but not this one. Try asking about onboarding volume, rejection rate, or transaction value.";

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function unsupported(message = UNSUPPORTED_MESSAGE): PlannerResult {
  return {
    ok: false,
    errorType: "unsupported_question",
    message,
  };
}

export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/\bs\.?\s*m\.?\s*e\.?\b/g, " sme ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function extractSegments(text: string): CustomerSegment[] {
  const found: Array<{ index: number; value: CustomerSegment }> = [];
  const patterns: Array<[RegExp, CustomerSegment]> = [
    [/\bretail\b/g, "Retail"],
    [/\bsme\b/g, "SME"],
    [/\bcorporate\b/g, "Corporate"],
  ];

  for (const [pattern, value] of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      found.push({ index: match.index, value });
    }
  }

  found.sort((a, b) => a.index - b.index);
  return found.map((item) => item.value);
}

function extractStatuses(text: string): OnboardingStatus[] {
  const withoutRate = text.replace(/\brejection\s+rates?\b/g, " ");
  const found: Array<{ index: number; value: OnboardingStatus }> = [];
  const patterns: Array<[RegExp, OnboardingStatus]> = [
    [/\bapproved\b/g, "Approved"],
    [/\brejected\b/g, "Rejected"],
    [/\bpending\b/g, "Pending"],
  ];

  for (const [pattern, value] of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(withoutRate);
    if (match) {
      found.push({ index: match.index, value });
    }
  }

  found.sort((a, b) => a.index - b.index);
  return found.map((item) => item.value);
}

function parseLimitToken(token: string): number | undefined {
  if (token in WORD_NUMBERS) {
    return WORD_NUMBERS[token];
  }
  if (/^\d+$/.test(token)) {
    return Number(token);
  }
  return undefined;
}

function extractTopN(text: string): number | "invalid" | undefined {
  const explicit = text.match(
    /\btop\s+(ten|nine|eight|seven|six|five|four|three|two|one|\d+)\b/,
  );
  if (explicit) {
    const value = parseLimitToken(explicit[1]);
    if (value === undefined || value < 1 || value > 10) {
      return "invalid";
    }
    return value;
  }

  if (/\btop\b/.test(text) && /\bcustomers?\b/.test(text)) {
    return 5;
  }

  return undefined;
}

function mentionsRejectionRate(text: string): boolean {
  return has(
    text,
    /\brejection\s+rates?\b|\brate\s+of\s+rejection\b|\breject(?:ed)?\s+rates?\b/,
  );
}

function mentionsTransactions(text: string): boolean {
  return has(
    text,
    /\btransactions?\b|\btxn\b|\btransaction\s+(?:value|amount|volume)\b/,
  );
}

function mentionsOnboarding(text: string): boolean {
  return has(
    text,
    /\bonboard(?:ing|ed)?\b|\bapplications?\b/,
  );
}

function mentionsAverage(text: string): boolean {
  return has(text, /\baverage\b|\bavg\b|\bmean\b/);
}

function wantsMonthly(text: string): boolean {
  return has(
    text,
    /\bmonthly\b|\bmonth\s+by\s+month\b|\beach\s+month\b|\bper\s+month\b|\bby\s+month\b|\bover\s+time\b/,
  );
}

function wantsSegmentBreakdown(text: string): boolean {
  return has(
    text,
    /\bby\s+segments?\b|\bsegment\s*wise\b|\bsegmentwise\b|\beach\s+segment\b|\bper\s+segment\b|\bacross\s+segments?\b|\bbreakdown\s+of\s+segments?\b|\bsegments?\s+breakdown\b|\bcompare\b|\bversus\b|\bvs\b|\bcompared\s+to\b/,
  );
}

function wantsBranchBreakdown(text: string): boolean {
  return has(
    text,
    /\bby\s+branch(?:es)?\b|\bbranch\s*wise\b|\bbranchwise\b|\beach\s+branch\b|\bper\s+branch\b|\bacross\s+branch(?:es)?\b|\bwhich\s+branch(?:es)?\b|\bwhat\s+branch(?:es)?\b|\bbranch(?:es)?\s+have\b|\bhighest\b.{0,60}\bbranch(?:es)?\b|\bbranch(?:es)?\b.{0,60}\bhighest\b/,
  );
}

function mentionsBranch(text: string): boolean {
  return has(text, /\bbranch(?:es)?\b/);
}

function mentionsCustomerNoun(text: string): boolean {
  return has(text, /\bcustomers?\b/);
}

function askingBranchCount(text: string): boolean {
  return has(
    text,
    /\b(?:how\s+many|number\s+of|count\s+of|total(?:\s+number\s+of)?|count(?:\s+the)?)\s+branch(?:es)?\b|\bbranch(?:es)?\s+(?:are\s+there|do\s+we\s+have|exist|in\s+total)\b/,
  );
}

function askingCustomerCount(text: string): boolean {
  return (
    mentionsCustomerNoun(text) &&
    has(
      text,
      /\bhow\s+many\b|\bnumber\s+of\b|\bcount\s+of\b|\btotal\s+number\b|\bcustomers?\s+(?:are\s+there|do\s+we\s+have|in\s+total)\b/,
    )
  );
}

function wantsCustomerBreakdown(text: string): boolean {
  return has(
    text,
    /\bby\s+customers?\b|\bper\s+customer\b|\beach\s+customer\b|\bcustomer\s*wise\b/,
  );
}

function filtersFrom(
  segments: CustomerSegment[],
  statuses: OnboardingStatus[],
): QueryPlan["filters"] | undefined {
  const filters: NonNullable<QueryPlan["filters"]> = {};
  if (segments.length > 0) {
    filters.segments = segments;
  }
  if (statuses.length > 0) {
    filters.statuses = statuses;
  }
  return Object.keys(filters).length > 0 ? filters : undefined;
}

function interpret(text: string): unknown | null {
  const segments = extractSegments(text);
  const statuses = extractStatuses(text);
  const topN = extractTopN(text);
  const rejectionRate = mentionsRejectionRate(text);
  const transactional = mentionsTransactions(text);
  const onboarding = mentionsOnboarding(text);
  const onboardingIntent = onboarding || statuses.length > 0;

  const unknownDimension = /\bby\s+(?!segment|segments|branch|branches|customer|customers|month|transaction|transactions|value|amount)[a-z]+\b/.test(
    text,
  );
  if (unknownDimension) {
    return null;
  }

  if (topN === "invalid") {
    return null;
  }

  if (rejectionRate) {
    const plan: Record<string, unknown> = {
      dataset: "onboarding",
      metric: "rejection_rate",
    };
    if (wantsBranchBreakdown(text) || mentionsBranch(text)) {
      plan.groupBy = ["branch"];
    } else if (wantsSegmentBreakdown(text) || segments.length > 1) {
      plan.groupBy = ["segment"];
    }
    return plan;
  }

  if (transactional && !onboarding) {
    if (mentionsAverage(text)) {
      return {
        dataset: "transactions",
        metric: "average",
      };
    }

    if (topN !== undefined || wantsCustomerBreakdown(text) || /\btop\b/.test(text)) {
      const plan: Record<string, unknown> = {
        dataset: "transactions",
        metric: "sum",
        groupBy: ["customer"],
      };
      if (topN !== undefined) {
        plan.limit = topN;
      } else if (/\btop\b/.test(text)) {
        plan.limit = 5;
      }
      return plan;
    }

    if (
      has(text, /\bhow\s+many\b|\bcount\b|\bnumber\s+of\b/) &&
      !has(text, /\bvalue\b|\bamount\b|\btotal\b|\bsum\b|\bvolume\b/)
    ) {
      return null;
    }

    return {
      dataset: "transactions",
      metric: "sum",
    };
  }

  if (onboardingIntent && !transactional && !mentionsAverage(text)) {
    const plan: Record<string, unknown> = {
      dataset: "onboarding",
      metric: "count",
    };

    if (wantsSegmentBreakdown(text) || segments.length > 1) {
      plan.groupBy = ["segment"];
    } else if (wantsBranchBreakdown(text)) {
      plan.groupBy = ["branch"];
    }

    if (wantsMonthly(text)) {
      plan.dateGroupBy = "month";
    }

    const filters = filtersFrom(segments, statuses);
    if (filters) {
      plan.filters = filters;
    }

    return plan;
  }

  if (askingBranchCount(text) && !onboardingIntent) {
    if (wantsBranchBreakdown(text) || wantsSegmentBreakdown(text) || segments.length > 0) {
      return null;
    }
    return {
      dataset: "branches",
      metric: "count",
    };
  }

  const customerInventory =
    askingCustomerCount(text) ||
    (mentionsCustomerNoun(text) &&
      (wantsSegmentBreakdown(text) || wantsBranchBreakdown(text)));

  if (customerInventory && !onboardingIntent && !transactional) {
    const plan: Record<string, unknown> = {
      dataset: "customers",
      metric: "count",
    };
    if (wantsSegmentBreakdown(text) || segments.length > 1) {
      plan.groupBy = ["segment"];
    } else if (wantsBranchBreakdown(text)) {
      plan.groupBy = ["branch"];
    }
    const filters = filtersFrom(segments, []);
    if (filters) {
      plan.filters = filters;
    }
    return plan;
  }

  if (
    !transactional &&
    !mentionsAverage(text) &&
    (wantsSegmentBreakdown(text) || segments.length > 0) &&
    !mentionsCustomerNoun(text) &&
    !askingBranchCount(text)
  ) {
    const plan: Record<string, unknown> = {
      dataset: "onboarding",
      metric: "count",
    };
    if (wantsSegmentBreakdown(text) || segments.length > 1) {
      plan.groupBy = ["segment"];
    }
    const filters = filtersFrom(segments, []);
    if (filters) {
      plan.filters = filters;
    }
    return plan;
  }

  return null;
}

export class MockQueryPlanner implements QueryPlanner {
  plan(question: string): PlannerResult {
    const normalized = normalizeQuestion(question);
    if (!normalized) {
      return unsupported("Please ask a question about onboarding or transactions.");
    }

    const draft = interpret(normalized);
    if (!draft) {
      return unsupported();
    }

    try {
      const plan = parseQueryPlan(draft);
      return { ok: true, plan };
    } catch {
      return unsupported();
    }
  }
}
