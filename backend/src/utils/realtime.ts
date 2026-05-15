import type { Response } from "express";

export type RealtimeEvent = {
  type: string;
  [key: string]: unknown;
};

const clientsByUserId = new Map<number, Set<Response>>();

export const addSseClient = (userId: number, res: Response) => {
  const set = clientsByUserId.get(userId) ?? new Set<Response>();
  set.add(res);
  clientsByUserId.set(userId, set);
};

export const removeSseClient = (userId: number, res: Response) => {
  const set = clientsByUserId.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clientsByUserId.delete(userId);
};

export const publishToUser = (userId: number, event: RealtimeEvent) => {
  const set = clientsByUserId.get(userId);
  if (!set || set.size === 0) return;

  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      // ignore broken pipes
    }
  }
};

export const publishToUsers = (userIds: number[], event: RealtimeEvent) => {
  for (const id of userIds) publishToUser(id, event);
};
