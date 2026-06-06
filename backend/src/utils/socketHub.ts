import type { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { getActiveSessionId } from "./session";

interface SocketAuthPayload {
  userId?: number;
  role?: string;
  sessionId?: string;
}

const socketsByUserId = new Map<number, Set<Socket>>();

const revokeSocket = (socket: Socket, message: string) => {
  socket.emit("session_revoked", { message });
  socket.disconnect(true);
};

export const initSocketHub = (io: Server) => {
  io.on("connection", async (socket) => {
    const rawToken = String(socket.handshake.auth?.token || "");
    if (!rawToken) {
      revokeSocket(socket, "Thieu token xac thuc");
      return;
    }

    let decoded: SocketAuthPayload;
    try {
      decoded = jwt.verify(
        rawToken,
        process.env.JWT_SECRET || "your-secret-key",
      ) as SocketAuthPayload;
    } catch {
      revokeSocket(socket, "Token khong hop le");
      return;
    }

    const userId = Number(decoded.userId);
    const sessionId = String(decoded.sessionId || "");
    if (!Number.isFinite(userId) || !sessionId) {
      revokeSocket(socket, "Token khong hop le");
      return;
    }

    const activeSessionId = await getActiveSessionId(userId);
    if (!activeSessionId || activeSessionId !== sessionId) {
      revokeSocket(socket, "Phien dang nhap da het hieu luc");
      return;
    }

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

    socket.on("join_location_room", (payload: { locationId: number; customerId?: number }) => {
      const { locationId, customerId } = payload;
      const targetCustomerId = customerId || userId;
      const room = `location_${locationId}_customer_${targetCustomerId}`;
      void socket.join(room);
      console.log(`Socket ${socket.id} (user ${userId}) joined private room ${room}`);
    });

    socket.on("join_location_owner_room", (payload: { locationId: number }) => {
      const { locationId } = payload;
      const room = `location_${locationId}_owners`;
      void socket.join(room);
      console.log(`Socket ${socket.id} (owner ${userId}) joined owners room ${room}`);
    });

    socket.on("disconnect", () => {
      const set = socketsByUserId.get(userId);
      if (!set) return;
      set.delete(socket);
      if (set.size === 0) {
        socketsByUserId.delete(userId);
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
