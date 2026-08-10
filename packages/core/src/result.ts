import type { Diagnostic } from "@fuzit/schemas";

export interface SuccessResult<Value> {
  readonly status: "success";
  readonly value: Value;
  readonly diagnostics: readonly Diagnostic[];
}

export interface PartialResult<Value> {
  readonly status: "partial";
  readonly value: Value;
  readonly diagnostics: readonly Diagnostic[];
}

export interface FailureResult {
  readonly status: "failure";
  readonly diagnostics: readonly Diagnostic[];
}

export type Result<Value> =
  SuccessResult<Value> | PartialResult<Value> | FailureResult;

export function successResult<Value>(
  value: Value,
  diagnostics: readonly Diagnostic[] = [],
): SuccessResult<Value> {
  return { status: "success", value, diagnostics: [...diagnostics] };
}

export function partialResult<Value>(
  value: Value,
  diagnostics: readonly Diagnostic[],
): PartialResult<Value> {
  return { status: "partial", value, diagnostics: [...diagnostics] };
}

export function failureResult(
  diagnostics: readonly Diagnostic[],
): FailureResult {
  return { status: "failure", diagnostics: [...diagnostics] };
}
