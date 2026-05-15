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
      for (const existing of existingSockets) {
        revokeSocket(existing, "Tai khoan dang duoc dang nhap tai noi khac");
      }
      existingSockets.clear();
    }

    socket.data.userId = userId;
    socket.data.sessionId = sessionId;
    existingSockets.add(socket);
    socketsByUserId.set(userId, existingSockets);

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
    revokeSocket(socket, "Tai khoan dang duoc dang nhap tai noi khac");
  }
};
