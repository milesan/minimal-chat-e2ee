import React, { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import MessageArea from './MessageArea.jsx';
import LinksView from './LinksView.jsx';
import InboxView from './InboxView.jsx';
import DMView from './DMView.jsx';
import WorldView from './WorldView.jsx';
import { useWorkspace } from '../stores/workspaceStore.jsx';
import './ChatView.css';

export default function ChatView() {
  const { loading } = useWorkspace();
  const [view, setView] = useState('chat');

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="chat-container">
      <Sidebar view={view} setView={setView} />
      {view === 'chat' ? (
        <MessageArea />
      ) : view === 'dms' ? (
        <DMView />
      ) : view === 'inbox' ? (
        <InboxView />
      ) : view === 'links' ? (
        <LinksView />
      ) : view === 'greatest' ? (
        <LinksView isGreatest={true} />
      ) : (
        <WorldView onViewChange={setView} />
      )}
    </div>
  );
}