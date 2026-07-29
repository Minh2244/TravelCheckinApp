import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface SocketContextValue {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextValue>({ socket: null });

export const useSocket = () => useContext(SocketContext).socket;

const resolveSocketUrl = (): string => {
  const raw =
    (import.meta.env.VITE_SOCKET_URL as string | undefined) ||
    (import.meta.env.VITE_API_URL as string | undefined) ||
    "http://localhost:3000";
  return raw.replace(/\/api\/?$/, "");
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    let activeSocket: Socket | null = null;
    
    // We get the initial token (might be null for guests)
    const token = sessionStorage.getItem("accessToken") || "";

    const initSocket = (currentToken: string) => {
      const socketUrl = resolveSocketUrl();
      const newSocket = io(socketUrl, {
        auth: { token: currentToken },
        transports: ["websocket"],
      });

      newSocket.on("session_revoked", (payload: { message?: string }) => {
        window.dispatchEvent(
          new CustomEvent("tc-session-revoked", {
            detail: {
              message:
                payload?.message || "Tài khoản đang được đăng nhập tại nơi khác.",
            },
          }),
        );
      });

      setSocket(newSocket);
      activeSocket = newSocket;
    };

    initSocket(token);

    // Polling or listening is handled by App's auth changes, 
    // but to be safe we just initialize it once when mounted.
    // If user logs out, they usually refresh or get redirected,
    // which unmounts or we can rely on standard refresh.

    return () => {
      if (activeSocket) {
        activeSocket.disconnect();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
