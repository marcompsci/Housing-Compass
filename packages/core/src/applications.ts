/** Application tracking: allowed status moves, suggested next steps, and what needs attention. */

export const APPLICATION_STATUSES = ["interested", "applied", "lottery_entered", "waitlisted", "interview", "offered", "leased", "declined", "withdrawn"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  interested: "Interested",
  applied: "Applied",
  lottery_entered: "In lottery",
  waitlisted: "Waitlisted",
  interview: "Interview / showing",
  offered: "Offered",
  leased: "Lease signed",
  declined: "Not selected",
  withdrawn: "Withdrawn",
};

const MOVES: Record<ApplicationStatus, ApplicationStatus[]> = {
  interested: ["applied", "lottery_entered", "waitlisted", "interview", "withdrawn"],
  applied: ["interview", "lottery_entered", "waitlisted", "offered", "declined", "withdrawn"],
  lottery_entered: ["waitlisted", "interview", "offered", "declined", "withdrawn"],
  waitlisted: ["interview", "offered", "declined", "withdrawn"],
  interview: ["offered", "declined", "withdrawn", "waitlisted"],
  offered: ["leased", "withdrawn", "declined"],
  leased: [],
  declined: ["interested"],
  withdrawn: ["interested"],
};

export function canMove(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return MOVES[from].includes(to);
}

export function nextMoves(from: ApplicationStatus): ApplicationStatus[] {
  return MOVES[from];
}

/** Plain-language next step for each stage. Safety reminders are built in where money changes hands. */
export const NEXT_STEP: Record<ApplicationStatus, string> = {
  interested: "Confirm eligibility and the deadline, then gather documents (ID, proof of income).",
  applied: "Save your confirmation number. Check email and phone (including spam) for follow-ups.",
  lottery_entered: "Note the lottery date. Results usually come by email or the official portal.",
  waitlisted: "Keep your contact info current with the property. Ask how often the waitlist moves.",
  interview: "Tour in person or by live video before paying anything. Bring documents.",
  offered: "Read the whole lease. Pay only through the property's official channel — never wire, crypto or gift cards.",
  leased: "Get a signed copy of the lease and receipts for every payment.",
  declined: "Ask whether you can join a waitlist or apply to another unit.",
  withdrawn: "",
};

export interface TrackedApplication {
  id: string;
  listingId: string | null;
  title: string;
  status: ApplicationStatus;
  deadline: string | null;
  nextActionAt: string | null;
  notes: string;
  history: Array<{ status: ApplicationStatus; at: string }>;
  updatedAt: string;
}

export function moveApplication(a: TrackedApplication, to: ApplicationStatus, now: Date): TrackedApplication {
  if (!canMove(a.status, to)) throw new Error(`Can't move from ${STATUS_LABEL[a.status]} to ${STATUS_LABEL[to]}`);
  const at = now.toISOString();
  return { ...a, status: to, history: [...a.history, { status: to, at }], updatedAt: at };
}

export type Attention = "deadline_soon" | "deadline_passed" | "follow_up_due" | "stale" | null;

/** What deserves a nudge: deadlines, follow-ups, and applications untouched for 3+ weeks. */
export function attention(a: TrackedApplication, now: Date): Attention {
  const active = !["leased", "declined", "withdrawn"].includes(a.status);
  if (!active) return null;
  const t = now.getTime();
  if (a.status === "interested" && a.deadline) {
    const d = new Date(a.deadline).getTime();
    if (d < t) return "deadline_passed";
    if (d - t < 3 * 86_400_000) return "deadline_soon";
  }
  if (a.nextActionAt && new Date(a.nextActionAt).getTime() <= t) return "follow_up_due";
  if (t - new Date(a.updatedAt).getTime() > 21 * 86_400_000) return "stale";
  return null;
}

export function sortApplications(xs: TrackedApplication[], now: Date): TrackedApplication[] {
  const rank: Record<NonNullable<Attention> | "none", number> = { deadline_passed: 1, deadline_soon: 0, follow_up_due: 2, stale: 3, none: 4 };
  const done = (a: TrackedApplication) => ["leased", "declined", "withdrawn"].includes(a.status);
  return [...xs].sort((a, b) => Number(done(a)) - Number(done(b)) || rank[attention(a, now) ?? "none"] - rank[attention(b, now) ?? "none"] || b.updatedAt.localeCompare(a.updatedAt));
}
