import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import AuthView from './components/AuthView.jsx';
import ChatView from './components/ChatView.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import { AuthProvider, useAuth } from './stores/authStore.jsx';
import { SocketProvider } from './stores/socketStore.jsx';
import { WorkspaceProvider } from './stores/workspaceStore.jsx';
import { QuoteProvider } from './stores/quoteStore.jsx';
import { EncryptionProvider } from './stores/encryptionStore.jsx';

function AppContent() {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (token) {
      const newSocket = io('http://localhost:3034', {
        transports: ['websocket'],
        upgrade: false
      });

      newSocket.on('connect', () => {
        newSocket.emit('authenticate', token);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [token]);

  return (
    <SocketProvider socket={socket}>
      <WorkspaceProvider>
        <QuoteProvider>
          <EncryptionProvider>
            <div className="container">
              {user ? <ChatView /> : <AuthView />}
              <ThemeToggle />
            </div>
          </EncryptionProvider>
        </QuoteProvider>
      </WorkspaceProvider>
    </SocketProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}