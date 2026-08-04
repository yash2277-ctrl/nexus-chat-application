import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import useStore from '../store/useStore';
import api from '../utils/api';
import { playNotificationSound } from '../utils/helpers';
import {
  getPeerConnection,
  markRemoteDescSet,
  flushPendingCandidates,
  addPendingCandidate,
  cleanupCall,
} from '../utils/callManager';

const TOKEN_KEY = 'nexus_token';

let socket = null;

const mockSocket = {
  emit: () => {},
  disconnect: () => {},
  connected: false,
};

export function getSocket() {
  return socket || mockSocket;
}

function normalizeMessage(message = {}) {
  return {
    ...message,
    id: message.id || message.$id,
    conversation_id: message.conversation_id || message.conversationId || null,
    sender_id: message.sender_id || message.senderId || null,
    receiver_id: message.receiver_id || message.receiverId || null,
    content: message.content || '',
    created_at: message.created_at || message.createdAt || Date.now(),
    updated_at: message.updated_at || message.updatedAt || Date.now(),
    reactions: Array.isArray(message.reactions) ? message.reactions : [],
  };
}

export function useSocket() {
  const unsubscribeRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const { 
    user,
    isAuthenticated,
    addMessage,
    updateMessage,
    removeMessage,
    updateConversation,
    addConversation,
    setTyping,
    setUserOnline,
    updateReactions,
    setActiveCall,
  } = useStore();

  const disconnectSocket = useCallback(() => {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!isAuthenticated || !user?.id) {
      disconnectSocket();
      return mockSocket;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      disconnectSocket();
      return mockSocket;
    }

    if (socket?.connected) return socket;

    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }

    socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('Connected to local socket server');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from local socket server');
    });

    socket.on('new_message', (payload) => {
      const message = normalizeMessage(payload);
      const currentUserId = user?.id || user?.$id;
      const isParticipant =
        message.sender_id === currentUserId ||
        message.receiver_id === currentUserId ||
        message.conversation_id === useStore.getState().activeConversation?.id;

      if (!isParticipant) return;
      addMessage(message);
      if (message.sender_id !== currentUserId) {
        playNotificationSound();
      }
    });

    socket.on('message_edited', (payload) => {
      updateMessage(normalizeMessage(payload));
    });

    socket.on('message_deleted', ({ messageId }) => {
      if (messageId) removeMessage(messageId);
    });

    socket.on('message_reaction', ({ messageId, reactions }) => {
      if (messageId) updateReactions(messageId, reactions || []);
    });

    socket.on('message_pinned', ({ messageId, isPinned }) => {
      if (messageId) updateMessage({ id: messageId, is_pinned: isPinned ? 1 : 0 });
    });

    socket.on('message_deleted', ({ messageId }) => {
      if (messageId) removeMessage(messageId);
    });

    socket.on('conversation_updated', ({ conversationId, lastMessage }) => {
      updateConversation(conversationId, { lastMessage: normalizeMessage(lastMessage) });
    });

    socket.on('new_conversation', (conversation) => {
      addConversation(conversation);
    });

    socket.on('group_updated', (conversation) => {
      if (conversation?.id) updateConversation(conversation.id, conversation);
    });

    socket.on('members_updated', ({ conversationId, participants }) => {
      updateConversation(conversationId, { participants });
    });

    socket.on('member_removed', ({ conversationId }) => {
      const conv = useStore.getState().conversations.find((item) => item.id === conversationId);
      if (conv) updateConversation(conversationId, conv);
    });

    socket.on('member_left', ({ conversationId }) => {
      const conv = useStore.getState().conversations.find((item) => item.id === conversationId);
      if (conv) updateConversation(conversationId, conv);
    });

    socket.on('removed_from_group', ({ conversationId }) => {
      const state = useStore.getState();
      const conversations = state.conversations.filter((item) => item.id !== conversationId);
      state.setActiveConversation?.(state.activeConversation?.id === conversationId ? null : state.activeConversation);
      useStore.setState({ conversations });
    });

    socket.on('user_online', ({ userId, isOnline, lastSeen }) => {
      setUserOnline(userId, isOnline, lastSeen);
    });

    socket.on('typing_indicator', ({ conversationId, userId: typingUserId, isTyping }) => {
      setTyping(conversationId, typingUserId, isTyping);
    });

    socket.on('messages_read', ({ conversationId, userId: readerId }) => {
      const state = useStore.getState();
      const conversation = state.conversations.find((item) => item.id === conversationId);
      if (conversation) updateConversation(conversationId, conversation);
      if (readerId) setUserOnline(readerId, true, Date.now());
    });

    socket.on('online_statuses', (statuses) => {
      Object.entries(statuses || {}).forEach(([userId, isOnline]) => {
        setUserOnline(userId, isOnline, Date.now());
      });
    });

    socket.on('incoming_call', (payload) => {
      setActiveCall({
        type: 'incoming',
        callType: payload.callType,
        callerId: payload.callerId,
        callerName: payload.callerName,
        callerAvatar: payload.callerAvatar,
        conversationId: payload.conversationId,
        offer: payload.offer,
      });
    });

    socket.on('call_answered', async ({ answer }) => {
      try {
        const pc = getPeerConnection();
        if (!pc || !answer) return;
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        markRemoteDescSet();
        await flushPendingCandidates();
      } catch (err) {
        console.error('Failed to apply call answer:', err);
      }
    });

    socket.on('call_rejected', () => {
      cleanupCall();
      setActiveCall(null);
    });

    socket.on('call_ended', () => {
      cleanupCall();
      setActiveCall(null);
    });

    socket.on('ice_candidate', async ({ candidate }) => {
      try {
        const pc = getPeerConnection();
        if (!pc || !candidate) return;
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          addPendingCandidate(candidate);
        }
      } catch (err) {
        console.warn('Failed to add ICE candidate:', err);
      }
    });

    socket.on('screen_share_started', () => {});
    socket.on('screen_share_stopped', () => {});
    socket.on('note_content_update', () => {});
    socket.on('new_story', () => {
      api.getStories().then((stories) => useStore.setState({ stories })).catch(() => {});
    });
    socket.on('story_reaction', () => {});

    return socket;
  }, [addConversation, addMessage, disconnectSocket, isAuthenticated, setActiveCall, setTyping, setUserOnline, updateConversation, updateMessage, updateReactions, removeMessage, user?.id, user?.$id]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      disconnectSocket();
    };
  }, [connect, disconnectSocket]);

  useEffect(() => {
    if (!socket || !user?.id) return;
    socket.auth = { token: localStorage.getItem(TOKEN_KEY) };
    if (!socket.connected) socket.connect();
  }, [user?.id]);

  return getSocket();
}

export default useSocket;
