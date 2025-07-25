import db from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

const voiceRooms = new Map();

export const handleVoiceEvents = (io, socket) => {
  socket.on('join_voice', ({ channelId }) => {
    if (!socket.userId) return;

    const roomKey = `voice:${channelId}`;
    
    if (!voiceRooms.has(roomKey)) {
      voiceRooms.set(roomKey, new Set());
    }

    const participants = voiceRooms.get(roomKey);
    participants.add(socket.userId);

    socket.join(roomKey);

    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(socket.userId);
    
    const participantList = Array.from(participants).map(userId => {
      const participant = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
      return participant;
    }).filter(p => p && p.id !== socket.userId);

    socket.emit('voice_participants', { participants: participantList });

    socket.to(roomKey).emit('user_joined_voice', { user });

    const sessionId = uuidv4();
    socket.voiceSessionId = sessionId;
    
    db.prepare('INSERT INTO voice_sessions (id, channel_id) VALUES (?, ?)').run(sessionId, channelId);
    db.prepare('INSERT INTO voice_participants (session_id, user_id) VALUES (?, ?)').run(sessionId, socket.userId);
  });

  socket.on('leave_voice', ({ channelId }) => {
    if (!socket.userId) return;

    const roomKey = `voice:${channelId}`;
    const participants = voiceRooms.get(roomKey);

    if (participants) {
      participants.delete(socket.userId);
      if (participants.size === 0) {
        voiceRooms.delete(roomKey);
      }
    }

    socket.leave(roomKey);
    socket.to(roomKey).emit('user_left_voice', { userId: socket.userId });

    if (socket.voiceSessionId) {
      db.prepare('UPDATE voice_participants SET left_at = unixepoch() WHERE session_id = ? AND user_id = ? AND left_at IS NULL').run(socket.voiceSessionId, socket.userId);
      
      const activeParticipants = db.prepare('SELECT COUNT(*) as count FROM voice_participants WHERE session_id = ? AND left_at IS NULL').get(socket.voiceSessionId);
      if (activeParticipants.count === 0) {
        db.prepare('UPDATE voice_sessions SET ended_at = unixepoch() WHERE id = ?').run(socket.voiceSessionId);
      }
    }
  });

  socket.on('voice_offer', ({ channelId, targetUserId, offer }) => {
    io.to(`user:${targetUserId}`).emit('voice_offer', {
      channelId,
      userId: socket.userId,
      offer
    });
  });

  socket.on('voice_answer', ({ channelId, targetUserId, answer }) => {
    io.to(`user:${targetUserId}`).emit('voice_answer', {
      channelId,
      userId: socket.userId,
      answer
    });
  });

  socket.on('voice_ice_candidate', ({ channelId, targetUserId, candidate }) => {
    io.to(`user:${targetUserId}`).emit('voice_ice_candidate', {
      channelId,
      userId: socket.userId,
      candidate
    });
  });
};