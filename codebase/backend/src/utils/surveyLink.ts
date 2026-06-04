import { config } from "../config.js";

export type SurveyLinkContext = {
  triggerRef?: string | null;
  userGroup?: string | null;
  dispatchedAt?: string | null;
};

function baseSurveyPath(token: string): string {
  const path = `${config.publicSurveyBaseUrl}/${token}`;
  if (!config.publicOrigin) {
    return path;
  }
  return `${config.publicOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Public survey URL with optional encoded context (ref, role, ts) for autofill on the fill page. */
export function buildSurveyLink(token: string, ctx?: SurveyLinkContext): string {
  let url = baseSurveyPath(token);
  const params = new URLSearchParams();
  if (ctx?.triggerRef) params.set("ref", ctx.triggerRef);
  if (ctx?.userGroup) params.set("role", ctx.userGroup);
  if (ctx?.dispatchedAt) params.set("ts", ctx.dispatchedAt);
  const qs = params.toString();
  if (qs) {
    url += `${url.includes("?") ? "&" : "?"}${qs}`;
  }
  return url;
}

/** @deprecated use buildSurveyLink */
export function surveyLinkForToken(token: string, ctx?: SurveyLinkContext): string {
  return buildSurveyLink(token, ctx);
}
