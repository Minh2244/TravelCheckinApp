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
  console.log(`[SSE] Client connected for user ${userId}. User active connections: ${set.size}. Total active users: ${clientsByUserId.size}`);
};

export const removeSseClient = (userId: number, res: Response) => {
  const set = clientsByUserId.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) {
    clientsByUserId.delete(userId);
  }
  console.log(`[SSE] Client disconnected for user ${userId}. Total active users: ${clientsByUserId.size}`);
};

export const publishToUser = (userId: number, event: RealtimeEvent) => {
  const set = clientsByUserId.get(userId);
  if (!set || set.size === 0) return;

  const payload = `data: ${JSON.stringify(event)}\n\n`;
  const deadResList: Response[] = [];

  for (const res of set) {
    try {
      res.write(payload);
      if (typeof (res as any).flush === "function") {
        (res as any).flush();
      }
    } catch {
      deadResList.push(res);
    }
  }

  if (deadResList.length > 0) {
    for (const deadRes of deadResList) {
      set.delete(deadRes);
    }
    if (set.size === 0) {
      clientsByUserId.delete(userId);
    }
    console.log(`[SSE] Cleaned up ${deadResList.length} dead connections for user ${userId}`);
  }
};

export const publishToUsers = (userIds: number[], event: RealtimeEvent) => {
  for (const id of userIds) {
    publishToUser(id, event);
  }
};

export const publishToAll = (event: RealtimeEvent) => {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  console.log(`[SSE] Broadcasting event to all users:`, JSON.stringify(event));

  for (const [userId, set] of clientsByUserId.entries()) {
    const deadResList: Response[] = [];
    for (const res of set) {
      try {
        res.write(payload);
        if (typeof (res as any).flush === "function") {
          (res as any).flush();
        }
      } catch {
        deadResList.push(res);
      }
    }

    if (deadResList.length > 0) {
      for (const deadRes of deadResList) {
        set.delete(deadRes);
      }
      if (set.size === 0) {
        clientsByUserId.delete(userId);
      }
      console.log(`[SSE] Cleaned up ${deadResList.length} dead connections for user ${userId} during broadcast`);
    }
  }
};
