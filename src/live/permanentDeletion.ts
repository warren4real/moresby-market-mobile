import { getSupabaseClient } from "../services/supabase";
export const deletionConfirmation =
  "Permanently delete this removed listing? Its content and photos will be deleted and it cannot be restored. Existing chats remain with a Listing deleted label. If the listing has reports, a private evidence copy and its reported photo remain available to authorized moderators. Previously issued photo links or downloaded copies may persist. This does not delete your account.";
export async function deleteListingPermanently(id: string) {
  const result = await getSupabaseClient().functions.invoke("delete-listing", {
    body: { id, confirmation: "DELETE" },
  });
  if (result.error) {
    let message =
      "Deletion was not confirmed. Refresh My listings and retry Delete permanently or Finish deletion cleanup.";
    try {
      message = (await result.error.context?.json())?.error || message;
    } catch {}
    throw Error(message);
  }
  if (result.data?.deleted !== true || result.data?.id !== id)
    throw Error("The server did not confirm deletion. Refresh and retry.");
  return result.data as {
    id: string;
    deleted: true;
    retained_evidence: boolean;
  };
}
