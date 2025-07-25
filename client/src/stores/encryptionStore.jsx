import React, { createContext, useState, useContext } from 'react';

const EncryptionContext = createContext();

export function EncryptionProvider({ children }) {
  // Store passwords per channel/DM ID
  const [passwords, setPasswords] = useState({});
  const [pendingChannelId, setPendingChannelId] = useState(null);

  const setPassword = (channelId, password) => {
    setPasswords(prev => ({
      ...prev,
      [channelId]: password
    }));
  };

  const getPassword = (channelId) => {
    return passwords[channelId];
  };

  const clearPassword = (channelId) => {
    setPasswords(prev => {
      const newPasswords = { ...prev };
      delete newPasswords[channelId];
      return newPasswords;
    });
  };

  const clearAllPasswords = () => {
    setPasswords({});
  };

  return (
    <EncryptionContext.Provider value={{
      passwords,
      getPassword,
      setPassword,
      clearPassword,
      clearAllPasswords,
      pendingChannelId,
      setPendingChannelId
    }}>
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryption() {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error('useEncryption must be used within an EncryptionProvider');
  }
  return context;
}