export type CheckoutError = { inputKey: string; message: string };
export function currentCheckoutError(error: CheckoutError | null, inputKey: string): string {
  return error?.inputKey === inputKey ? error.message : "";
}
