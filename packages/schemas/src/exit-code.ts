import { z } from "zod";

export const EXIT_CODES = {
  success: 0,
  validation: 2,
  environment: 3,
  partial: 4,
  internal: 70,
  cancelled: 130,
} as const;

export const exitCodeSchema = z.union([
  z.literal(EXIT_CODES.success),
  z.literal(EXIT_CODES.validation),
  z.literal(EXIT_CODES.environment),
  z.literal(EXIT_CODES.partial),
  z.literal(EXIT_CODES.internal),
  z.literal(EXIT_CODES.cancelled),
]);

export type ExitCode = z.infer<typeof exitCodeSchema>;
export type ExitCodeKind = keyof typeof EXIT_CODES;
