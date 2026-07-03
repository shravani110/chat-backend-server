import { z } from "zod";

export const createRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(["DIRECT", "GROUP"]).default("GROUP"),
  participantIds: z.array(z.string().uuid()).min(1).max(100),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
