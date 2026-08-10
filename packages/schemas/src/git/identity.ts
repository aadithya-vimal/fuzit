import { z } from "zod";

export const gitIdentitySchema = z.strictObject({
  schemaVersion: z.literal(1),
  available: z.boolean(),
  root: z.string().nullable(),
  head: z
    .string()
    .regex(/^[a-f0-9]{40,64}$/)
    .nullable(),
  branch: z.string().nullable(),
  detached: z.boolean(),
  dirty: z.boolean(),
  remotes: z.array(
    z.strictObject({
      name: z.string().min(1),
      url: z.string().min(1),
    }),
  ),
});

export type GitIdentity = z.infer<typeof gitIdentitySchema>;
