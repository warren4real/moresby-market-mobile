type RecoveryAuth = {
  updateUser: (value: { password: string }) => Promise<{ error: unknown }>;
  signOut: (value: { scope: "others" }) => Promise<{ error: unknown }>;
};
// Report completion only after the new password, remote session revocation and
// protected recovery marker are all committed. A retry need not change it again.
export async function completeRecovery(
  auth: RecoveryAuth,
  password: string,
  alreadyChanged: boolean,
  onChanged: () => void,
  finish: () => Promise<void>,
) {
  if (!alreadyChanged) {
    const changed = await auth.updateUser({ password });
    if (changed.error) throw changed.error;
    onChanged();
  }
  const revoked = await auth.signOut({ scope: "others" });
  if (revoked.error) throw revoked.error;
  await finish();
}
