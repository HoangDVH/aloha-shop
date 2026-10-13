"use client";
import { useState } from "react";
import { currentCheckoutError, type CheckoutError } from "./checkoutError";
export function useCheckoutError(inputKey: string): [string, (message: string) => void] {
  const [error, setError] = useState<CheckoutError | null>(null);
  return [currentCheckoutError(error, inputKey), message => setError({ inputKey, message })];
}
