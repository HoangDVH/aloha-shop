/** Kết quả thất bại của một bước tạo đơn: route trả thẳng `status` + `body`. */
export type StepFail = { ok: false; status: number; body: Record<string, unknown> };

/** Type guard: tsconfig không bật strictNullChecks nên không thu hẹp được theo `ok`. */
export function isStepFail(r: { ok: boolean }): r is StepFail {
  return r.ok === false;
}
