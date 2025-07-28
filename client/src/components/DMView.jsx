import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../stores/authStore.jsx';
import { useSocket } from '../stores/socketStore.jsx';
import MessageInput from './MessageInput.jsx';
import './DMView.css';
import { getApiUrl } from '../config.js';

export default function DMView() {
  const { user, token } = useAuth();
  const socket = useSocket();
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
    fetchUsers();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (socket && selectedUser) {
      const handleNewDM = (message) => {
        if (
          (message.sender_id === selectedUser.id && message.receiver_id === user.id) ||
          (message.sender_id === user.id && message.receiver_id === selectedUser.id)
        ) {
          setMessages(prev => [...prev, message]);
        }
      };

      socket.on('new_dm', handleNewDM);
      
      return () => {
        socket.off('new_dm', handleNewDM);
      };
    }
  }, [socket, selectedUser, user]);

  const fetchConversations = async () => {
    try {
      const response = await fetch(getApiUrl('/api/dms'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          console.error('Authentication failed - please log in again');
          setConversations([]);
          return;
        }
        console.error('Failed to fetch conversations:', response.status);
        return;
      }
      
      const data = await response.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      setConversations([]);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(getApiUrl('/api/users'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          console.error('Authentication failed - please log in again');
          setUsers([]);
          return;
        }
        console.error('Failed to fetch users:', response.status);
        return;
      }
      
      const data = await response.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    }
  };

  const selectConversation = async (otherUser) => {
    setSelectedUser(otherUser);
    try {
      const response = await fetch(getApiUrl(`/api/dms/${otherUser.id || otherUser.other_user_id}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        console.error('Failed to fetch messages:', response.status);
        setMessages([]);
        return;
      }
      
      const data = await response.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setMessages([]);
    }
  };

  const sendMessage = async (content) => {
    if (!selectedUser) return;
    
    try {
      const response = await fetch(`/api/dms/${selectedUser.id || selectedUser.other_user_id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });
      
      if (response.ok) {
        const message = await response.json();
        setMessages(prev => [...prev, message]);
        
        // Update conversations list
        fetchConversations();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const startNewConversation = (user) => {
    setSelectedUser(user);
    setMessages([]);
    setShowUserSearch(false);
  };

  return (
    <div className="dm-view">
      <div className="dm-sidebar">
        <div className="dm-header">
          <h3>direct messages</h3>
          <button 
            className="new-dm-btn"
            onClick={() => setShowUserSearch(!showUserSearch)}
          >
            +
          </button>
        </div>
        
        {showUserSearch && (
          <div className="user-search">
            <input
              type="text"
              placeholder="search users..."
              className="user-search-input"
              autoFocus
            />
            <div className="user-list">
              {users.map(u => (
                <button
                  key={u.id}
                  className="user-item"
                  onClick={() => startNewConversation(u)}
                >
                  {u.username}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="conversation-list">
          {conversations.map(conv => (
            <button
              key={conv.other_user_id}
              className={`conversation-item ${selectedUser?.other_user_id === conv.other_user_id ? 'active' : ''}`}
              onClick={() => selectConversation(conv)}
            >
              <div className="conversation-name">{conv.other_username}</div>
              <div className="conversation-preview">{conv.last_message}</div>
            </button>
          ))}
        </div>
      </div>
      
      <div className="dm-content">
        {!selectedUser ? (
          <div className="dm-empty">
            <div className="empty-icon">💬</div>
            <div className="empty-text">select a conversation</div>
            <div className="empty-hint">or start a new one</div>
          </div>
        ) : (
          <>
            <div className="dm-chat-header">
              <h3>{selectedUser.username || selectedUser.other_username}</h3>
            </div>
            
            <div className="dm-messages">
              {messages.map(msg => (
                <div 
                  key={msg.id} 
                  className={`dm-message ${msg.sender_id === user.id ? 'sent' : 'received'}`}
                >
                  <div className="dm-message-content">
                    <div className="dm-message-author">
                      {msg.sender_id === user.id ? 'you' : msg.sender_username}
                    </div>
                    <div className="dm-message-text">{msg.content}</div>
                    <div className="dm-message-time">
                      {new Date(msg.created_at * 1000).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            <MessageInput onSend={sendMessage} placeholder="Send a message..." />
          </>
        )}
      </div>
    </div>
  );
}