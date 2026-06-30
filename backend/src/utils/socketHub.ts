import type { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { getActiveSessionId } from "./session";

interface SocketAuthPayload {
  userId?: number;
  role?: string;
  sessionId?: string;
}

const socketsByUserId = new Map<number, Set<Socket>>();

let globalIo: Server | null = null;

const revokeSocket = (socket: Socket, message: string) => {
  socket.emit("session_revoked", { message });
  socket.disconnect(true);
};

export const initSocketHub = (io: Server) => {
  globalIo = io;
  io.on("connection", async (socket) => {
    let userId: number | undefined;
    let sessionId: string | undefined;
    
    const rawToken = String(socket.handshake.auth?.token || "");
    if (rawToken) {
      try {
        const decoded = jwt.verify(
          rawToken,
          process.env.JWT_SECRET || "your-secret-key",
        ) as SocketAuthPayload;
        
        userId = Number(decoded.userId);
        sessionId = String(decoded.sessionId || "");
        
        if (Number.isFinite(userId) && sessionId) {
          const activeSessionId = await getActiveSessionId(userId);
          if (activeSessionId === sessionId) {
            const existingSockets = socketsByUserId.get(userId) ?? new Set<Socket>();
            if (existingSockets.size > 0) {
              for (const existing of Array.from(existingSockets)) {
                if (existing.data?.sessionId !== sessionId) {
                  revokeSocket(existing, "Tài khoản đang được đăng nhập tại nơi khác.");
                  existingSockets.delete(existing);
                }
              }
            }

            socket.data.userId = userId;
            socket.data.sessionId = sessionId;
            existingSockets.add(socket);
            socketsByUserId.set(userId, existingSockets);
            console.log(`[socketHub] User ${userId} authenticated successfully via handshake token. Socket ID: ${socket.id}`);
          } else {
            console.log(`[socketHub] User ${userId} auth failed: activeSessionId (${activeSessionId}) != token sessionId (${sessionId})`);
          }
        } else {
           console.log(`[socketHub] Invalid token payload: userId=${userId}, sessionId=${sessionId}`);
        }
      } catch {
        // invalid token, just don't authenticate them
      }
    }

    socket.on("join_location_room", (payload: { locationId: number; customerId?: number }) => {
      if (!userId) return;
      const { locationId, customerId } = payload;
      const targetCustomerId = customerId || userId;
      const room = `location_${locationId}_customer_${targetCustomerId}`;
      void socket.join(room);
      console.log(`Socket ${socket.id} (user ${userId}) joined private room ${room}`);
    });

    socket.on("join_location_owner_room", (payload: { locationId: number }) => {
      if (!userId) return;
      const { locationId } = payload;
      const room = `location_${locationId}_owners`;
      void socket.join(room);
      console.log(`Socket ${socket.id} (owner ${userId}) joined owners room ${room}`);
    });

    socket.on("join_location_public", (payload: { locationId: number }) => {
      const { locationId } = payload;
      const room = `location_${locationId}_public`;
      void socket.join(room);
      console.log(`Socket ${socket.id} (public) joined public room ${room}`);
    });

    socket.on("disconnect", () => {
      if (userId) {
        const set = socketsByUserId.get(userId);
        if (set) {
          set.delete(socket);
          if (set.size === 0) {
            socketsByUserId.delete(userId);
          }
        }
      }
    });
  });
};

export const emitSessionRevoked = (
  userId: number,
  exceptSessionId?: string,
) => {
  const sockets = socketsByUserId.get(userId);
  if (!sockets) return;

  for (const socket of sockets) {
    if (exceptSessionId && socket.data?.sessionId === exceptSessionId) {
      continue;
    }
    revokeSocket(socket, "Tài khoản đang được đăng nhập tại nơi khác.");
  }
};

export const publishToLocationPublic = (locationId: number, eventData: any) => {
  if (!globalIo) return;
  const room = `location_${locationId}_public`;
  globalIo.to(room).emit("public_status_changed", eventData);
};

export const emitToUser = (userId: number, event: string, data: Record<string, unknown>) => {
  console.log(`[socketHub] emitToUser called for userId=${userId}, event=${event}`);
  const sockets = socketsByUserId.get(userId);
  if (!sockets || sockets.size === 0) {
    console.log(`[socketHub] No active sockets for userId=${userId}`);
    return;
  }
  for (const socket of sockets) {
    try {
      console.log(`[socketHub] Emitting ${event} to socket ${socket.id}`);
      socket.emit(event, data);
    } catch (err) {
      console.error(`[socketHub] Error emitting to socket ${socket.id}:`, err);
    }
  }
};
