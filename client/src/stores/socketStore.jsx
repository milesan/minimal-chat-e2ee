import React, { createContext, useContext } from 'react';

const SocketContext = createContext();

export function SocketProvider({ socket, children }) {
  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const socket = useContext(SocketContext);
  if (!socket) {
    console.warn('Socket not connected');
  }
  return socket;
}