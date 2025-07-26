import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './authStore.jsx';
import { useSocket } from './socketStore.jsx';
import { getApiUrl } from '../config.js';

const ServerContext = createContext();

export function ServerProvider({ children }) {
  const { token } = useAuth();
  const socket = useSocket();
  const [servers, setServers] = useState([]);
  const [currentServer, setCurrentServer] = useState(null);
  const [channels, setChannels] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messages, setMessages] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchServers();
    }
  }, [token]);

  useEffect(() => {
    if (socket && currentServer) {
      // Clear previous data when switching servers
      setChannels([]);
      setCurrentChannel(null);
      setMessages({});
      
      socket.emit('join_server', currentServer.id);
      fetchChannels(currentServer.id);
    }
  }, [socket, currentServer]);

  useEffect(() => {
    if (socket && currentChannel) {
      socket.emit('join_channel', currentChannel.id);
      fetchMessages(currentChannel.id);

      const handleNewMessage = (message) => {
        setMessages(prev => ({
          ...prev,
          [message.channel_id]: [...(prev[message.channel_id] || []), message]
        }));
      };

      socket.on('new_message', handleNewMessage);

      return () => {
        socket.off('new_message', handleNewMessage);
      };
    }
  }, [socket, currentChannel]);

  const fetchServers = async () => {
    try {
      const response = await fetch(getApiUrl('/api/servers'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to fetch servers:', error);
        return;
      }
      
      const data = await response.json();
      setServers(data);
      if (data.length > 0 && !currentServer) {
        setCurrentServer(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async (serverId) => {
    try {
      const response = await fetch(`/api/servers/${serverId}/channels`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setChannels(data);
      if (data.length > 0 && !currentChannel) {
        setCurrentChannel(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    }
  };

  const fetchMessages = async (channelId) => {
    try {
      const response = await fetch(`/api/servers/channels/${channelId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setMessages(prev => ({ ...prev, [channelId]: data }));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const createServer = async (name, description = '', visibility = 'private', encrypted = false) => {
    try {
      const response = await fetch(getApiUrl('/api/servers'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, description, visibility, encrypted })
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create server');
      }

      await fetchServers();
      return data;
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Server is not running. Please start the backend server.');
      }
      throw error;
    }
  };

  const createChannel = async (name, encrypted = false) => {
    if (!currentServer) return;

    const response = await fetch(`/api/servers/${currentServer.id}/channels`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, encrypted })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create channel');
    }

    const newChannel = await response.json();
    await fetchChannels(currentServer.id);
    return newChannel;
  };

  const sendMessage = (content, threadId = null) => {
    if (socket && currentChannel) {
      socket.emit('send_message', { content, threadId });
    }
  };

  const value = {
    servers,
    currentServer,
    setCurrentServer,
    channels,
    currentChannel,
    setCurrentChannel,
    messages,
    loading,
    createServer,
    createChannel,
    sendMessage,
    fetchServers
  };

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export function useServer() {
  const context = useContext(ServerContext);
  if (!context) {
    throw new Error('useServer must be used within ServerProvider');
  }
  return context;
}