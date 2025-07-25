import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../stores/socketStore.jsx';
import { useAuth } from '../stores/authStore.jsx';
import './VoiceCall.css';

export default function VoiceCall({ channelId, onClose }) {
  const socket = useSocket();
  const { user } = useAuth();
  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const remoteStreamsRef = useRef({});

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    initializeVoiceCall();

    return () => {
      cleanupVoiceCall();
    };
  }, []);

  const initializeVoiceCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      if (socket) {
        socket.emit('join_voice', { channelId });

        socket.on('voice_participants', handleVoiceParticipants);
        socket.on('voice_offer', handleVoiceOffer);
        socket.on('voice_answer', handleVoiceAnswer);
        socket.on('voice_ice_candidate', handleIceCandidate);
        socket.on('user_joined_voice', handleUserJoinedVoice);
        socket.on('user_left_voice', handleUserLeftVoice);
      }

      setIsConnecting(false);
    } catch (error) {
      console.error('Failed to access microphone:', error);
      onClose();
    }
  };

  const cleanupVoiceCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());

    if (socket) {
      socket.emit('leave_voice', { channelId });
      socket.off('voice_participants');
      socket.off('voice_offer');
      socket.off('voice_answer');
      socket.off('voice_ice_candidate');
      socket.off('user_joined_voice');
      socket.off('user_left_voice');
    }
  };

  const handleVoiceParticipants = (data) => {
    setParticipants(data.participants);
    data.participants.forEach(participant => {
      if (participant.id !== user.id) {
        createPeerConnection(participant.id);
      }
    });
  };

  const createPeerConnection = async (userId) => {
    const pc = new RTCPeerConnection(iceServers);
    peerConnectionsRef.current[userId] = pc;

    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('voice_ice_candidate', {
          channelId,
          targetUserId: userId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      remoteStreamsRef.current[userId] = event.streams[0];
      updateAudioElements();
    };

    if (userId < user.id) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('voice_offer', {
        channelId,
        targetUserId: userId,
        offer
      });
    }
  };

  const handleVoiceOffer = async (data) => {
    const pc = new RTCPeerConnection(iceServers);
    peerConnectionsRef.current[data.userId] = pc;

    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('voice_ice_candidate', {
          channelId,
          targetUserId: data.userId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      remoteStreamsRef.current[data.userId] = event.streams[0];
      updateAudioElements();
    };

    await pc.setRemoteDescription(data.offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('voice_answer', {
      channelId,
      targetUserId: data.userId,
      answer
    });
  };

  const handleVoiceAnswer = async (data) => {
    const pc = peerConnectionsRef.current[data.userId];
    if (pc) {
      await pc.setRemoteDescription(data.answer);
    }
  };

  const handleIceCandidate = async (data) => {
    const pc = peerConnectionsRef.current[data.userId];
    if (pc) {
      await pc.addIceCandidate(data.candidate);
    }
  };

  const handleUserJoinedVoice = (data) => {
    setParticipants(prev => [...prev, data.user]);
    createPeerConnection(data.user.id);
  };

  const handleUserLeftVoice = (data) => {
    setParticipants(prev => prev.filter(p => p.id !== data.userId));
    if (peerConnectionsRef.current[data.userId]) {
      peerConnectionsRef.current[data.userId].close();
      delete peerConnectionsRef.current[data.userId];
    }
    delete remoteStreamsRef.current[data.userId];
    updateAudioElements();
  };

  const updateAudioElements = () => {
    // Audio elements will be created dynamically
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  return (
    <div className="voice-call">
      <div className="voice-header">
        <h3>Voice Call</h3>
        <button className="close-voice-btn" onClick={onClose}>×</button>
      </div>

      {isConnecting ? (
        <div className="voice-connecting">Connecting...</div>
      ) : (
        <>
          <div className="voice-participants">
            <h4>Participants ({participants.length + 1})</h4>
            <div className="participant-list">
              <div className="participant">
                <div className="participant-avatar">
                  {user.username[0].toUpperCase()}
                </div>
                <span className="participant-name">{user.username} (You)</span>
                {isMuted && <span className="muted-indicator">🔇</span>}
              </div>
              {participants.map(participant => (
                <div key={participant.id} className="participant">
                  <div className="participant-avatar">
                    {participant.username[0].toUpperCase()}
                  </div>
                  <span className="participant-name">{participant.username}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="voice-controls">
            <button 
              className={`voice-control-btn ${isMuted ? 'muted' : ''}`}
              onClick={toggleMute}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>
            <button className="voice-control-btn leave" onClick={onClose}>
              Leave Call
            </button>
          </div>
        </>
      )}

      <div id="remote-audio-container" style={{ display: 'none' }}>
        {Object.entries(remoteStreamsRef.current).map(([userId, stream]) => (
          <audio
            key={userId}
            autoPlay
            ref={el => {
              if (el && stream) {
                el.srcObject = stream;
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}