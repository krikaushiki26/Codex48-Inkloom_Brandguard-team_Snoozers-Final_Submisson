import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const frontendUrl = Deno.env.get("FRONTEND_URL")?.replace(/\/$/, "");

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const localOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

type AppRole = "writer" | "manager" | "reviewer" | "admin";
type Profile = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  is_active: boolean;
  created_at: string;
};
type Rule = {
  id: number;
  title: string;
  description: string;
  rule_type: string;
  approved_source: string;
  version: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
};
type Flag = {
  rule_id: number | null;
  rule_title: string;
  rule_type: string;
  issue_type: string;
  category: string;
  severity: "high" | "medium" | "low";
  message: string;
  reason: string;
  matched_text: string;
  suggested_fix: string;
  suggestion: string;
  approved_source: string;
  source: string;
  confidence: number;
  needs_human_review: boolean;
};

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = localOrigins.has(origin) || origin === frontendUrl;
  return {
    "Access-Control-Allow-Origin": allowed ? origin : frontendUrl ?? "null",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Vary": "Origin",
  };
}

function json(request: Request, body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function failure(request: Request, detail: string, status = 400) {
  return json(request, { detail }, status);
}

function clientForToken(accessToken?: string): SupabaseClient {
  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

async function authenticated(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return { error: "Authentication required" } as const;
  }

  const client = clientForToken(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Invalid or expired token" } as const;
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, name, email, role, is_active, created_at")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    return { error: "Invalid or inactive user" } as const;
  }

  return { client, user: data.user, profile: profile as Profile } as const;
}

function roleError(profile: Profile, roles: AppRole[]) {
  return roles.includes(profile.role)
    ? undefined
    : "You do not have permission to perform this action";
}

async function readJson(request: Request) {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

function text(value: unknown, maximum: number, field: string, minimum = 1) {
  if (typeof value !== "string") {
    throw new Error(`${field} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < minimum || trimmed.length > maximum) {
    throw new Error(`${field} must be between ${minimum} and ${maximum} characters.`);
  }
  return trimmed;
}

function parseId(value: string | undefined) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

const claimPattern = /(?<!\w)(?:guarantee(?:s|d)?|proven|100%|cure(?:s|d)?|best|number one|no risk|risk-free|always|never)(?!\w)/gi;

function createFlag(
  rule: Rule,
  issueType: string,
  severity: Flag["severity"],
  message: string,
  suggestedFix: string,
  needsHumanReview: boolean,
  matchedText = "",
  confidence = 1,
): Flag {
  return {
    rule_id: rule.id,
    rule_title: rule.title,
    rule_type: rule.rule_type,
    issue_type: issueType,
    category: issueType,
    severity,
    message,
    reason: message,
    matched_text: matchedText,
    suggested_fix: suggestedFix,
    suggestion: suggestedFix,
    approved_source: rule.approved_source,
    source: rule.approved_source,
    confidence,
    needs_human_review: needsHumanReview,
  };
}

function checkContent(content: string, rules: Rule[]) {
  const flags: Flag[] = [];

  for (const rule of rules) {
    const ruleType = rule.rule_type.toLowerCase();
    if (ruleType === "forbidden_phrase") {
      const matcher = new RegExp(rule.description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      if (matcher.test(content)) {
        flags.push(createFlag(
          rule,
          "brand_conflict",
          "high",
          `The forbidden phrase '${rule.description}' appears in the content.`,
          `Review and replace '${rule.description}' with approved brand wording.`,
          false,
          rule.description,
        ));
      }
    } else if (ruleType === "required_phrase") {
      const matcher = new RegExp(rule.description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      if (!matcher.test(content)) {
        flags.push(createFlag(
          rule,
          "missing_requirement",
          "medium",
          `The required phrase '${rule.description}' is missing.`,
          `Consider including '${rule.description}' where appropriate.`,
          false,
        ));
      }
    } else if (ruleType === "claim") {
      const matches = [...content.matchAll(claimPattern)].map((match) => match[0]);
      if (matches.length) {
        const matchedText = [...new Set(matches.map((match) => match.toLowerCase()))].join(", ");
        flags.push(createFlag(
          rule,
          "unsupported_claim",
          "high",
          `Potentially absolute or factual claims need evidence: ${matchedText}`,
          "Verify each claim using an approved source before publishing.",
          true,
          matchedText,
          0.85,
        ));
      }
    } else if (ruleType === "tone") {
      flags.push(createFlag(
        rule,
        "tone_review",
        "low",
        `Human review is needed for the brand tone: ${rule.title}.`,
        rule.description || "Compare the content with the approved brand voice.",
        true,
      ));
    } else {
      flags.push(createFlag(
        rule,
        "manual_review",
        "low",
        rule.description || `Review the content against: ${rule.title}.`,
        "Compare the content with the approved guideline.",
        true,
      ));
    }
  }

  const deductions = { high: 25, medium: 12, low: 5 };
  const score = Math.round(Math.max(0, Math.min(100, 100 - flags.reduce(
    (total, flag) => total + deductions[flag.severity] * flag.confidence,
    0,
  ))));

  return {
    status: flags.length ? "needs_review" : "no_issues_detected",
    score,
    total_flags: flags.length,
    flags,
    checked_text: content,
    ai_enabled: false,
    note: "Rule-based checks are preliminary. Factual claims, context and subjective brand judgments may require human review. No content is automatically approved or published.",
  };
}

async function fetchAll<T>(client: SupabaseClient, table: string, columns: string) {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data as T[]));
    if (!data || data.length < pageSize) return rows;
  }
}

function riskLevel(risk: number) {
  if (risk < 25) return "Low";
  if (risk < 50) return "Moderate";
  if (risk < 75) return "High";
  return "Critical";
}

function severityCounts(records: Array<{ flags: unknown }>) {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const record of records) {
    if (!Array.isArray(record.flags)) continue;
    for (const flag of record.flags) {
      const severity = String((flag as Record<string, unknown>).severity ?? "").toLowerCase();
      if (severity in counts) counts[severity as keyof typeof counts] += 1;
    }
  }
  return counts;
}

function csvCell(value: unknown) {
  const valueString = String(value ?? "");
  return /[",\r\n]/.test(valueString) ? `"${valueString.replaceAll('"', '""')}"` : valueString;
}

async function handle(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }

  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  if (segments[0] === "api") segments.shift();
  const path = `/${segments.join("/")}`;

  if (request.method === "GET" && path === "/") {
    return json(request, { message: "Welcome to Inkloom BrandGuard API", version: "3.0.0" });
  }
  if (request.method === "GET" && path === "/health") {
    return json(request, { status: "healthy" });
  }

  if (request.method === "POST" && path === "/auth/register") {
    const body = await readJson(request);
    if (!body) return failure(request, "Invalid JSON request body.");
    try {
      const name = text(body.name, 100, "Name");
      const email = text(body.email, 255, "Email").toLowerCase();
      const password = text(body.password, 128, "Password", 8);
      const { data, error } = await clientForToken().auth.signUp({ email, password, options: { data: { name } } });
      if (error || !data.user) return failure(request, error?.message ?? "Could not create account.", 400);
      return json(request, { id: data.user.id, name, email, role: "writer" }, 201);
    } catch (error) {
      return failure(request, error instanceof Error ? error.message : "Could not create account.");
    }
  }

  if (request.method === "POST" && path === "/auth/login") {
    const body = await readJson(request);
    if (!body) return failure(request, "Invalid JSON request body.");
    try {
      const email = text(body.email, 255, "Email").toLowerCase();
      const password = text(body.password, 128, "Password");
      const loginClient = clientForToken();
      const { data, error } = await loginClient.auth.signInWithPassword({ email, password });
      if (error || !data.session || !data.user) return failure(request, "Incorrect email or password.", 401);
      const sessionClient = clientForToken(data.session.access_token);
      const { data: profile, error: profileError } = await sessionClient
        .from("profiles")
        .select("id, name, email, role, is_active, created_at")
        .eq("id", data.user.id)
        .single();
      if (profileError || !profile?.is_active) return failure(request, "Invalid or inactive user", 401);
      return json(request, {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        token_type: "bearer",
        user: profile,
      });
    } catch (error) {
      return failure(request, error instanceof Error ? error.message : "Could not sign in.");
    }
  }

  const auth = await authenticated(request);
  if ("error" in auth) return failure(request, auth.error ?? "Authentication required", 401);
  const { client, user, profile } = auth;

  if (request.method === "GET" && path === "/auth/me") {
    return json(request, profile);
  }

  if (request.method === "GET" && path === "/rules") {
    const { data, error } = await client.from("brand_rules")
      .select("id, title, description, rule_type, approved_source, version, is_active, created_by, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    return error ? failure(request, error.message, 500) : json(request, data);
  }

  if (request.method === "POST" && path === "/rules") {
    const denied = roleError(profile, ["manager", "admin"]);
    if (denied) return failure(request, denied, 403);
    const body = await readJson(request);
    if (!body) return failure(request, "Invalid JSON request body.");
    try {
      const rule = {
        title: text(body.title, 200, "Title"),
        description: text(body.description, 50000, "Description"),
        rule_type: text(body.rule_type, 30, "Rule type").toLowerCase(),
        approved_source: text(body.approved_source, 50000, "Approved source"),
        created_by: user.id,
      };
      const { data, error } = await client.from("brand_rules").insert(rule)
        .select("id, title, description, rule_type, approved_source, version, is_active, created_by, created_at").single();
      return error ? failure(request, error.message, 400) : json(request, data, 201);
    } catch (error) {
      return failure(request, error instanceof Error ? error.message : "Could not create rule.");
    }
  }

  const ruleId = path.match(/^\/rules\/(\d+)$/)?.[1];
  if (ruleId && request.method === "PATCH") {
    const denied = roleError(profile, ["manager", "admin"]);
    if (denied) return failure(request, denied, 403);
    const body = await readJson(request);
    if (!body) return failure(request, "Invalid JSON request body.");
    try {
      const updates: Record<string, unknown> = {};
      if (body.title !== undefined) updates.title = text(body.title, 200, "Title");
      if (body.description !== undefined) updates.description = text(body.description, 50000, "Description");
      if (body.rule_type !== undefined) updates.rule_type = text(body.rule_type, 30, "Rule type").toLowerCase();
      if (body.approved_source !== undefined) updates.approved_source = text(body.approved_source, 50000, "Approved source");
      if (body.is_active !== undefined) {
        if (typeof body.is_active !== "boolean") throw new Error("is_active must be a boolean.");
        updates.is_active = body.is_active;
      }
      if (!Object.keys(updates).length) throw new Error("Provide at least one field to update.");
      const { data, error } = await client.from("brand_rules").update(updates).eq("id", Number(ruleId))
        .select("id, title, description, rule_type, approved_source, version, is_active, created_by, created_at").single();
      return error ? failure(request, error.code === "PGRST116" ? "Rule not found." : error.message, error.code === "PGRST116" ? 404 : 400) : json(request, data);
    } catch (error) {
      return failure(request, error instanceof Error ? error.message : "Could not update rule.");
    }
  }

  if (ruleId && request.method === "DELETE") {
    const denied = roleError(profile, ["manager", "admin"]);
    if (denied) return failure(request, denied, 403);
    const { error } = await client.from("brand_rules").delete().eq("id", Number(ruleId));
    return error ? failure(request, error.message, 400) : new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method === "POST" && path === "/content/check") {
    const body = await readJson(request);
    if (!body) return failure(request, "Invalid JSON request body.");
    try {
      const content = text(body.content, 50000, "Content");
      const { data: rules, error } = await client.from("brand_rules")
        .select("id, title, description, rule_type, approved_source, version, is_active, created_by, created_at")
        .eq("is_active", true);
      if (error) return failure(request, error.message, 500);
      const result = checkContent(content, (rules ?? []) as Rule[]);
      const { data: record, error: recordError } = await serviceClient.from("content_check_results").insert({
        checked_by: user.id,
        compliance_score: result.score,
        total_flags: result.total_flags,
        flags: result.flags,
        ai_enabled: result.ai_enabled,
      }).select("id").single();
      if (recordError) return failure(request, "The content check completed, but its analytics record could not be saved.", 500);
      return json(request, { ...result, check_id: record.id });
    } catch (error) {
      return failure(request, error instanceof Error ? error.message : "Could not check content.");
    }
  }

  if (request.method === "POST" && path === "/reviews") {
    const body = await readJson(request);
    if (!body) return failure(request, "Invalid JSON request body.");
    try {
      const content = text(body.content, 50000, "Content");
      const { data, error } = await client.from("content_reviews").insert({
        submitted_by: user.id, content, status: "pending",
      }).select("id, status, created_at").single();
      return error ? failure(request, error.message, 400) : json(request, data, 201);
    } catch (error) {
      return failure(request, error instanceof Error ? error.message : "Could not submit review.");
    }
  }

  if (request.method === "GET" && path === "/reviews/mine") {
    const { data, error } = await client.from("content_reviews")
      .select("id, content, status, reviewer_comment, reviewer_id, created_at, reviewed_at")
      .eq("submitted_by", user.id)
      .order("created_at", { ascending: false });
    return error ? failure(request, error.message, 500) : json(request, data);
  }

  if (request.method === "GET" && path === "/reviews/pending") {
    const denied = roleError(profile, ["reviewer", "manager", "admin"]);
    if (denied) return failure(request, denied, 403);
    const { data, error } = await client.from("content_reviews")
      .select("id, content, status, submitted_by, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    return error ? failure(request, error.message, 500) : json(request, data);
  }

  const decisionReviewId = path.match(/^\/reviews\/(\d+)\/decision$/)?.[1];
  if (decisionReviewId && request.method === "POST") {
    const denied = roleError(profile, ["reviewer", "manager", "admin"]);
    if (denied) return failure(request, denied, 403);
    const body = await readJson(request);
    if (!body) return failure(request, "Invalid JSON request body.");
    const decision = body.decision;
    if (!["approved", "changes_requested", "rejected"].includes(String(decision))) {
      return failure(request, "Decision must be approved, changes_requested, or rejected.");
    }
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    if ((decision === "changes_requested" || decision === "rejected") && !comment) {
      return failure(request, "Please provide a comment explaining this decision.");
    }
    const { data, error } = await serviceClient.from("content_reviews").update({
      status: decision,
      reviewer_id: user.id,
      reviewer_comment: comment || null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", Number(decisionReviewId)).eq("status", "pending").neq("submitted_by", user.id)
      .select("id, status, reviewer_comment, reviewer_id, reviewed_at").maybeSingle();
    if (error) return failure(request, error.message, 400);
    return data ? json(request, data) : failure(request, "Review not found, already processed, or self-review is not allowed.");
  }

  if (request.method === "GET" && path === "/admin/users") {
    const denied = roleError(profile, ["admin"]);
    if (denied) return failure(request, denied, 403);
    const users = await fetchAll<Profile>(client, "profiles", "id, name, email, role, is_active, created_at");
    return json(request, users.sort((left, right) => right.created_at.localeCompare(left.created_at)));
  }

  const roleUserId = path.match(/^\/admin\/users\/([^/]+)\/role$/)?.[1];
  if (roleUserId && request.method === "PATCH") {
    const denied = roleError(profile, ["admin"]);
    if (denied) return failure(request, denied, 403);
    const body = await readJson(request);
    const role = body?.role;
    if (!["writer", "manager", "reviewer"].includes(String(role))) {
      return failure(request, "Role must be writer, manager, or reviewer.");
    }
    const { data: target, error: targetError } = await client.from("profiles")
      .select("id, name, email, role").eq("id", roleUserId).maybeSingle();
    if (targetError) return failure(request, targetError.message, 400);
    if (!target) return failure(request, "User not found", 404);
    if (target.role === "admin") return failure(request, "An admin account's role cannot be changed here.");
    const { data, error } = await client.from("profiles").update({ role }).eq("id", roleUserId)
      .select("id, name, email, role").single();
    return error ? failure(request, error.message, 400) : json(request, data);
  }

  if (path.startsWith("/analytics/")) {
    const denied = roleError(profile, ["manager", "admin"]);
    if (denied) return failure(request, denied, 403);
    try {
      const checks = await fetchAll<{ id: number; checked_by: string; compliance_score: number; total_flags: number; flags: unknown; ai_enabled: boolean; created_at: string }>(
        client, "content_check_results", "id, checked_by, compliance_score, total_flags, flags, ai_enabled, created_at",
      );
      const reviews = await fetchAll<{ status: string }>(client, "content_reviews", "status");

      if (request.method === "GET" && path === "/analytics/summary") {
        const severity = severityCounts(checks);
        const average = checks.length ? checks.reduce((sum, check) => sum + check.compliance_score, 0) / checks.length : null;
        const averageCompliance = average === null ? null : Math.round(average * 100) / 100;
        const averageRisk = averageCompliance === null ? null : Math.round((100 - averageCompliance) * 100) / 100;
        const reviewCounts = { pending: 0, approved: 0, changes_requested: 0, rejected: 0 };
        for (const review of reviews) if (review.status in reviewCounts) reviewCounts[review.status as keyof typeof reviewCounts] += 1;
        const processed = reviewCounts.approved + reviewCounts.rejected + reviewCounts.changes_requested;
        return json(request, {
          total_checks: checks.length,
          average_compliance_score: averageCompliance,
          average_risk_score: averageRisk,
          risk_level: averageRisk === null ? "Not available" : riskLevel(averageRisk),
          high_severity_flags: severity.high,
          medium_severity_flags: severity.medium,
          low_severity_flags: severity.low,
          ai_enabled_checks: checks.filter((check) => check.ai_enabled).length,
          total_reviews: reviews.length,
          processed_reviews: processed,
          approval_rate: processed ? Math.round((reviewCounts.approved / processed) * 10000) / 100 : 0,
          rejection_rate: processed ? Math.round((reviewCounts.rejected / processed) * 10000) / 100 : 0,
          changes_requested: reviewCounts.changes_requested,
          reviews: reviewCounts,
        });
      }

      if (request.method === "GET" && path === "/analytics/trends") {
        const byMonth = new Map<string, number[]>();
        for (const check of checks) {
          const month = check.created_at.slice(0, 7);
          byMonth.set(month, [...(byMonth.get(month) ?? []), check.compliance_score]);
        }
        return json(request, [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, scores]) => {
          const average = Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100;
          const risk = Math.round((100 - average) * 100) / 100;
          return { month, checks: scores.length, average_score: average, average_risk_score: risk, risk_level: riskLevel(risk) };
        }));
      }

      if (request.method === "GET" && path === "/analytics/violations") {
        const counts = new Map<string, number>();
        for (const check of checks) {
          if (!Array.isArray(check.flags)) continue;
          for (const flag of check.flags) {
            const issue = String((flag as Record<string, unknown>).issue_type ?? "unknown").trim().toLowerCase();
            counts.set(issue, (counts.get(issue) ?? 0) + 1);
          }
        }
        return json(request, [...counts.entries()].sort(([, a], [, b]) => b - a).slice(0, 10)
          .map(([issue_type, count]) => ({ issue_type, count })));
      }

      if (request.method === "GET" && path === "/analytics/report.csv") {
        const header = ["Check ID", "User ID", "Compliance Score", "Risk Score", "Risk Level", "Total Flags", "High Severity", "Medium Severity", "Low Severity", "AI Enabled", "Checked At"];
        const lines = [header.join(",")];
        for (const check of checks.sort((left, right) => right.created_at.localeCompare(left.created_at))) {
          const severity = severityCounts([check]);
          const risk = 100 - check.compliance_score;
          lines.push([
            check.id, check.checked_by, check.compliance_score, risk, riskLevel(risk), check.total_flags,
            severity.high, severity.medium, severity.low, check.ai_enabled, check.created_at,
          ].map(csvCell).join(","));
        }
        return new Response(lines.join("\r\n"), {
          headers: {
            ...corsHeaders(request),
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="inkloom_brandguard_analytics_${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.csv"`,
          },
        });
      }
    } catch (error) {
      return failure(request, error instanceof Error ? error.message : "Could not load analytics.", 500);
    }
  }

  return failure(request, "Not found", 404);
}

Deno.serve((request) => handle(request).catch((error) => {
  console.error(error);
  return failure(request, "An unexpected server error.", 500);
}));
