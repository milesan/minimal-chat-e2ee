import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './authStore.jsx';
import { useSocket } from './socketStore.jsx';

const WorkspaceContext = createContext();

export function WorkspaceProvider({ children }) {
  const { token } = useAuth();
  const socket = useSocket();
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [channels, setChannels] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messages, setMessages] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchWorkspaces();
    }
  }, [token]);

  useEffect(() => {
    if (socket && currentWorkspace) {
      socket.emit('join_workspace', currentWorkspace.id);
      fetchChannels(currentWorkspace.id);
    }
  }, [socket, currentWorkspace]);

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

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch('/api/channels/workspaces', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to fetch workspaces:', error);
        return;
      }
      
      const data = await response.json();
      setWorkspaces(data);
      if (data.length > 0 && !currentWorkspace) {
        setCurrentWorkspace(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async (workspaceId) => {
    try {
      const response = await fetch(`/api/channels/workspaces/${workspaceId}/channels`, {
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
      const response = await fetch(`/api/channels/channels/${channelId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setMessages(prev => ({ ...prev, [channelId]: data }));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const createWorkspace = async (name) => {
    try {
      const response = await fetch('/api/channels/workspaces', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create workspace');
      }

      await fetchWorkspaces();
      return data;
    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Server is not running. Please start the backend server.');
      }
      throw error;
    }
  };

  const createChannel = async (name, encrypted = false) => {
    if (!currentWorkspace) return;

    const response = await fetch(`/api/channels/workspaces/${currentWorkspace.id}/channels`, {
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
    await fetchChannels(currentWorkspace.id);
    return newChannel;
  };

  const sendMessage = (content, threadId = null) => {
    if (socket && currentChannel) {
      socket.emit('send_message', { content, threadId });
    }
  };

  const value = {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    channels,
    currentChannel,
    setCurrentChannel,
    messages,
    loading,
    createWorkspace,
    createChannel,
    sendMessage
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return context;
}