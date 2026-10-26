import { getSupabaseClient } from "../services/supabase";
export type ReportKind = "listing" | "conversation";
export type ModerationAction = "reviewed" | "dismissed" | "removed_listing";
export type QueueReport = {
  id: string;
  reason: string;
  details: string;
  status: string;
  created_at: string;
  target_label: string;
  reporter_name: string | null;
};
export type ModerationReport = {
  report: {
    id: string;
    reason: string;
    details: string;
    status: string;
    created_at: string;
  };
  listing: {
    id: string;
    title: string;
    description: string;
    price: number;
    status: string;
    image_path: string;
    moderation_removed: boolean;
    seller_name: string | null;
  };
  history: {
    action: string;
    note: string;
    created_at: string;
    moderator_name: string | null;
  }[];
};
export type ReviewMessage = {
  id: string;
  sequence: number;
  sender_name: string | null;
  body: string;
  created_at: string;
};
async function call<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const result = await getSupabaseClient().rpc(name, args);
  if (result.error) throw result.error;
  return result.data as T;
}
export const fetchModerationQueue = (
  kind: ReportKind,
  status: string,
  page: number,
) =>
  call<QueueReport[]>("moderation_queue", {
    p_kind: kind,
    p_status: status,
    p_offset: page * 20,
  });
export const fetchModerationReport = (kind: ReportKind, id: string) =>
  call<ModerationReport>("moderation_report", { p_kind: kind, p_report: id });
export function reviewConversation(
  report: string,
  reason: string,
  before: number | null = null,
) {
  if (!reason.trim() || reason.trim().length > 300)
    throw Error("Enter a review reason of 1–300 characters.");
  return call<ReviewMessage[]>("moderation_conversation", {
    p_report: report,
    p_reason: reason.trim(),
    p_before: before,
  });
}
export function decideReport(
  kind: ReportKind,
  report: string,
  action: ModerationAction,
  note: string,
  expected: string,
) {
  if (!note.trim() || note.trim().length > 1000)
    throw Error("Enter a decision reason of 1–1000 characters.");
  return call<{ status: string; listing_removed: boolean }>(
    "moderation_decide",
    {
      p_kind: kind,
      p_report: report,
      p_action: action,
      p_note: note.trim(),
      p_expected: expected,
    },
  );
}
export function moderationError(error: unknown) {
  return (error as { code?: string })?.code === "42501"
    ? "Moderator access is unavailable. Close this screen and sign in again."
    : (error as { code?: string })?.code === "40001"
      ? "This report changed or was already decided. Refresh the report before continuing."
      : "The request could not finish. Check your connection, refresh and retry.";
}
