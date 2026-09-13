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

    const initSocket = (currentToken: string) => {
      if (activeSocket) {
        activeSocket.disconnect();
      }

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

    // Initialize the socket once on mount
    const initialToken = sessionStorage.getItem("accessToken") || "";
    initSocket(initialToken);

    // Listen for manual auth changes (e.g., successful login without refresh)
    const handleAuthChange = () => {
      const newToken = sessionStorage.getItem("accessToken") || "";
      initSocket(newToken);
    };

    window.addEventListener("tc-auth-changed", handleAuthChange);

    return () => {
      window.removeEventListener("tc-auth-changed", handleAuthChange);
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
