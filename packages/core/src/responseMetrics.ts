/**
 * Manager response metrics (from the manager_response_stats view). Only shown with at least
 * MIN_CONVERSATIONS conversations in the last 90 days, so one slow reply can't define a manager
 * and individual renters can't be identified.
 */
export const RESPONSE_MIN_CONVERSATIONS = 5;

export interface ResponseStats {
  managerId: string;
  conversations: number;
  replyRatePct: number | null;
  medianReplyHours: number | null;
}

export function responseStatsFromRow(r: { manager_id: string; conversations: number | string; reply_rate_pct: number | string | null; median_reply_hours: number | string | null }): ResponseStats {
  const num = (v: number | string | null) => (v === null || v === undefined ? null : Number(v));
  return { managerId: r.manager_id, conversations: Number(r.conversations), replyRatePct: num(r.reply_rate_pct), medianReplyHours: num(r.median_reply_hours) };
}

export function formatResponseStats(s: ResponseStats | null): { show: boolean; headline: string; detail: string } {
  if (!s || s.conversations < RESPONSE_MIN_CONVERSATIONS) {
    return { show: false, headline: "Not enough messages yet", detail: `Shown after ${RESPONSE_MIN_CONVERSATIONS} conversations in 90 days.` };
  }
  const h = s.medianReplyHours;
  const time = h === null ? "no replies yet" : h < 1 ? "usually within an hour" : h < 24 ? `usually within ${Math.ceil(h)} hours` : `usually within ${Math.ceil(h / 24)} days`;
  const rate = s.replyRatePct === null ? "" : `Replies to ${Math.round(s.replyRatePct)}% of messages`;
  return { show: true, headline: rate ? `${rate} · ${time}` : time, detail: `Based on ${s.conversations} conversations in the last 90 days.` };
}
