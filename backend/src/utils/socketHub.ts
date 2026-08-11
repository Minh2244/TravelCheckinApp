import type { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { getActiveSessionId } from "./session";
import { pool } from "../config/database";

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
    let userRole: string | undefined;
    
    let authPromise = Promise.resolve();

    const rawToken = String(socket.handshake.auth?.token || "");
    if (rawToken) {
      authPromise = (async () => {
        try {
          const decoded = jwt.verify(
            rawToken,
            process.env.JWT_SECRET || "your-secret-key",
          ) as SocketAuthPayload;
          
          userId = Number(decoded.userId);
          sessionId = String(decoded.sessionId || "");
          userRole = String(decoded.role || "");
          
          if (Number.isFinite(userId) && sessionId) {
            const activeSessionId = await getActiveSessionId(userId);
            if (activeSessionId === sessionId) {
              // Gán data TRƯỚC để có thể dùng khi so sánh
              socket.data.userId = userId;
              socket.data.sessionId = sessionId;

              const existingSockets = socketsByUserId.get(userId) ?? new Set<Socket>();
              // Chỉ revoke các socket có sessionId KHÁC
              if (existingSockets.size > 0) {
                for (const existing of Array.from(existingSockets)) {
                  if (existing.data?.sessionId && existing.data.sessionId !== sessionId) {
                    console.log(`[socketHub] Revoking old socket ${existing.id} (session ${String(existing.data.sessionId)}) for user ${userId}`);
                    revokeSocket(existing, "Tài khoản đang được đăng nhập tại nơi khác.");
                    existingSockets.delete(existing);
                  }
                }
              }

              existingSockets.add(socket);
              socketsByUserId.set(userId, existingSockets);
              console.log(`[socketHub] User ${userId} authenticated successfully via handshake token. Socket ID: ${socket.id}`);
            } else {
              // Token hop le nhung session da bi revoke
              userId = undefined;
              userRole = undefined;
            }
          }
        } catch {
          // invalid token, just don't authenticate them
          userId = undefined;
          userRole = undefined;
        }
      })();
    }

    const canManageLocation = async (locationId: number): Promise<boolean> => {
      await authPromise;
      if (!userId || !Number.isFinite(locationId)) return false;
      const [rows] = await pool.query(
        `SELECT 1
         FROM locations l
         WHERE l.location_id = ?
           AND (
             (l.owner_id = ? AND ? = 'owner')
             OR EXISTS (
               SELECT 1 FROM employee_locations el
               WHERE el.location_id = l.location_id
                 AND el.employee_id = ?
                 AND el.status = 'active'
             )
           )
         LIMIT 1`,
        [locationId, userId, userRole, userId],
      );
      return Array.isArray(rows) && rows.length > 0;
    };

    socket.on("join_location_room", async (payload: { locationId: number; customerId?: number }) => {
      await authPromise;
      if (!userId) return;
      const locationId = Number(payload?.locationId);
      const requestedCustomerId = Number(payload?.customerId || userId);
      if (!Number.isFinite(locationId) || !Number.isFinite(requestedCustomerId)) return;
      const merchant = await canManageLocation(locationId);
      const targetCustomerId = merchant ? requestedCustomerId : userId;
      const room = `location_${locationId}_customer_${targetCustomerId}`;
      void socket.join(room);
    });

    socket.on("join_location_owner_room", async (payload: { locationId: number }) => {
      await authPromise;
      if (!userId) return;
      const locationId = Number(payload?.locationId);
      if (!Number.isFinite(locationId) || !(await canManageLocation(locationId))) {
        socket.emit("room_join_denied", { locationId });
        return;
      }
      const room = `location_${locationId}_owners`;
      void socket.join(room);
    });

    socket.on("join_location_public", async (payload: { locationId: number }) => {
      await authPromise;
      const { locationId } = payload;
      const room = `location_${locationId}_public`;
      void socket.join(room);
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
  message = "Tài khoản đang được đăng nhập tại nơi khác.",
) => {
  const sockets = socketsByUserId.get(userId);
  if (!sockets) return;

  for (const socket of sockets) {
    if (exceptSessionId && socket.data?.sessionId === exceptSessionId) {
      continue;
    }
    revokeSocket(socket, message);
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

export const emitToAll = (event: string, data: Record<string, unknown>) => {
  console.log(`[socketHub] emitToAll called for event=${event}`);
  if (!globalIo) {
    console.log(`[socketHub] globalIo not initialized`);
    return;
  }
  try {
    globalIo.emit(event, data);
  } catch (err) {
    console.error(`[socketHub] Error in emitToAll:`, err);
  }
};
