// Blood-request lifecycle. All status changes go through `canTransition` so the
// flow is predictable:  DRAFT → OPEN → MATCHING → DONOR_CONTACTED → DONOR_ACCEPTED → FULFILLED → CLOSED
// plus CANCELLED / EXPIRED from any active state.

export const REQUEST_STATUSES = [
  "DRAFT",
  "OPEN",
  "MATCHING",
  "DONOR_CONTACTED",
  "DONOR_ACCEPTED",
  "FULFILLED",
  "CLOSED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type RequestStatusCode = (typeof REQUEST_STATUSES)[number];

export const ACTIVE_STATUSES: RequestStatusCode[] = ["OPEN", "MATCHING", "DONOR_CONTACTED", "DONOR_ACCEPTED"];
export const TERMINAL_STATUSES: RequestStatusCode[] = ["CLOSED", "CANCELLED", "EXPIRED"];

const TRANSITIONS: Record<RequestStatusCode, RequestStatusCode[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["MATCHING", "DONOR_CONTACTED", "DONOR_ACCEPTED", "FULFILLED", "CANCELLED", "EXPIRED"],
  MATCHING: ["DONOR_CONTACTED", "DONOR_ACCEPTED", "FULFILLED", "CANCELLED", "EXPIRED"],
  DONOR_CONTACTED: ["MATCHING", "DONOR_ACCEPTED", "FULFILLED", "CANCELLED", "EXPIRED"],
  DONOR_ACCEPTED: ["DONOR_CONTACTED", "FULFILLED", "CANCELLED", "EXPIRED"],
  FULFILLED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
  EXPIRED: ["OPEN"], // requester may re-open an expired request with a new needed date
};

export function canTransition(from: RequestStatusCode, to: RequestStatusCode) {
  return TRANSITIONS[from].includes(to);
}

export function isActive(status: string) {
  return (ACTIVE_STATUSES as string[]).includes(status);
}

export function isTerminal(status: string) {
  return (TERMINAL_STATUSES as string[]).includes(status);
}

/** Progress index for the status stepper UI. */
export const STEPPER: RequestStatusCode[] = ["OPEN", "MATCHING", "DONOR_CONTACTED", "DONOR_ACCEPTED", "FULFILLED", "CLOSED"];
