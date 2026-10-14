/** Unknown viewers see neither targeted group until the server resolves their identity. */
export function voucherMatchesBuyer(target: string | undefined, viewer: { newBuyer?: boolean } | null | undefined): boolean {
  if (target === "new_web") return viewer?.newBuyer === true;
  if (target === "returning_web") return viewer?.newBuyer === false;
  return true;
}
