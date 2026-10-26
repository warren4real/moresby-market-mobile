type Store = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};
const KEY = "marketples-pending-recovery-v1";
// This protected marker restores the password-reset screen after an app restart;
// it grants no authorization. Supabase still validates the authenticated session.
export function recoveryState(store: Store) {
  return {
    begin: (userId: string) =>
      store.setItem(
        KEY,
        JSON.stringify({ userId, expires: Date.now() + 3600000 }),
      ),
    clear: () => store.removeItem(KEY),
    pending: async (userId?: string) => {
      const raw = await store.getItem(KEY);
      if (!raw) return false;
      const value = JSON.parse(raw);
      return (
        !!userId &&
        value.userId === userId &&
        Number.isFinite(value.expires) &&
        value.expires > Date.now()
      );
    },
  };
}
