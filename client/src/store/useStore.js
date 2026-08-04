import { create } from 'zustand';
import api from '../utils/api';

export const useStore = create((set, get) => ({
  // Auth state
  user: null,
  token: localStorage.getItem('nexus_token'),
  isAuthenticated: !!localStorage.getItem('nexus_token'),
  isLoading: true,

  // Chat state
  conversations: [],
  activeConversation: null,
  messages: [],
  typingUsers: {},
  onlineUsers: {},

  // UI state
  showSidebar: true,
  showProfile: false,
  showCreateGroup: false,
  showStories: false,
  showSearch: false,
  showScheduler: false,
  showBookmarks: false,
  showNotes: false,
  activeCall: null,
  replyTo: null,
  editingMessage: null,
  forwardMessage: null,

  // Stories
  stories: [],

  // Initialize auth
  initAuth: async () => {
    const token = localStorage.getItem('nexus_token');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    try {
      const user = await api.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      localStorage.removeItem('nexus_token');
      set({ isLoading: false, isAuthenticated: false, user: null });
    }
  },

  // Auth actions
  login: async (data) => {
    const res = await api.login(data);
    set({ user: res.user, token: res.token, isAuthenticated: true });
    return res;
  },

  register: async (data) => {
    const res = await api.register(data);
    set({ user: res.user, token: res.token, isAuthenticated: true });
    return res;
  },

  logout: () => {
    api.setToken(null);
    localStorage.removeItem('nexus_token');
    set({ user: null, token: null, isAuthenticated: false, conversations: [], messages: [], activeConversation: null });
  },

  updateProfile: async (data) => {
    const user = await api.updateProfile(data);
    set({ user: { ...get().user, ...user } });
  },

  // Conversation actions
  loadConversations: async () => {
    try {
      const conversations = await api.getConversations();
      set({ conversations });
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  },

  setActiveConversation: async (conversation) => {
    set({ activeConversation: conversation, messages: [], replyTo: null, editingMessage: null });
    if (conversation) {
      try {
        const messages = await api.getMessages(conversation.id);
        set({ messages });
        // Mark as read
        if (messages.length > 0) {
          api.markAsRead(conversation.id, messages[messages.length - 1].id).catch(() => {});
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    }
  },

  startPrivateChat: async (userId) => {
    try {
      const conv = await api.createPrivateConversation(userId);
      const { conversations } = get();
      const exists = conversations.find(c => c.id === conv.id);
      if (!exists) {
        set({ conversations: [conv, ...conversations] });
      }
      set({ activeConversation: conv });
      const messages = await api.getMessages(conv.id);
      set({ messages });
      return conv;
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  },

  // Message actions
  addMessage: (message) => {
    const { messages, activeConversation, conversations, user } = get();
    
    if (activeConversation && message.conversation_id === activeConversation.id) {
      const exists = messages.find(m => m.id === message.id);
      if (!exists) {
        set({ messages: [...messages, message] });
      }
      // Mark as read if not own message
      if (message.sender_id !== (user?.id || user?.$id)) {
        api.markAsRead(activeConversation.id, message.id).catch(() => {});
      }
    }

    // Update conversation list
    const updatedConvs = conversations.map(c => {
      if (c.id === message.conversation_id) {
        return {
          ...c,
          lastMessage: message,
          updated_at: message.created_at,
          unread_count: (activeConversation?.id === c.id) ? 0 : (c.unread_count || 0) + 1
        };
      }
      return c;
    }).sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));

    set({ conversations: updatedConvs });
  },

  updateMessage: (updatedMsg) => {
    const { messages } = get();
    set({ messages: messages.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m) });
  },

  removeMessage: (messageId) => {
    const { messages } = get();
    set({ messages: messages.map(m => m.id === messageId ? { ...m, is_deleted: 1, content: 'This message was deleted' } : m) });
  },

  updateReactions: (messageId, reactions) => {
    const { messages } = get();
    set({ messages: messages.map(m => m.id === messageId ? { ...m, reactions } : m) });
  },

  loadMoreMessages: async () => {
    const { activeConversation, messages } = get();
    if (!activeConversation || messages.length === 0) return false;

    const oldest = messages[0];
    const older = await api.getMessages(activeConversation.id, oldest.created_at);
    if (older.length === 0) return false;

    set({ messages: [...older, ...messages] });
    return true;
  },

  // Typing indicators
  setTyping: (conversationId, userId, isTyping) => {
    const { typingUsers } = get();
    const convTyping = new Set(typingUsers[conversationId] || []);
    if (isTyping) convTyping.add(userId);
    else convTyping.delete(userId);
    set({ typingUsers: { ...typingUsers, [conversationId]: Array.from(convTyping) } });
  },

  // Online status
  setUserOnline: (userId, isOnline, lastSeen) => {
    const { onlineUsers, conversations } = get();
    set({ 
      onlineUsers: { ...onlineUsers, [userId]: { isOnline, lastSeen: lastSeen || Date.now() } },
      conversations: conversations.map(c => ({
        ...c,
        participants: c.participants?.map(p => p.id === userId ? { ...p, is_online: isOnline ? 1 : 0, last_seen: lastSeen || Date.now() } : p)
      }))
    });
  },

  // UI actions
  setShowSidebar: (show) => set({ showSidebar: show }),
  setShowProfile: (show) => set({ showProfile: show }),
  setShowCreateGroup: (show) => set({ showCreateGroup: show }),
  setShowStories: (show) => set({ showStories: show }),
  setShowSearch: (show) => set({ showSearch: show }),
  setShowScheduler: (show) => set({ showScheduler: show }),
  setShowBookmarks: (show) => set({ showBookmarks: show }),
  setShowNotes: (show) => set({ showNotes: show }),
  setReplyTo: (msg) => set({ replyTo: msg }),
  setEditingMessage: (msg) => set({ editingMessage: msg }),
  setForwardMessage: (msg) => set({ forwardMessage: msg }),
  setActiveCall: (call) => set({ activeCall: call }),

  // Add new conversation from socket
  addConversation: (conv) => {
    const { conversations } = get();
    const exists = conversations.find(c => c.id === conv.id);
    if (!exists) {
      set({ conversations: [conv, ...conversations] });
    }
  },

  // Update conversation
  updateConversation: (convId, data) => {
    const { conversations, activeConversation } = get();
    set({
      conversations: conversations.map(c => c.id === convId ? { ...c, ...data } : c),
      activeConversation: activeConversation?.id === convId ? { ...activeConversation, ...data } : activeConversation
    });
  },

  // Stories
  loadStories: async () => {
    try {
      const stories = await api.getStories();
      set({ stories });
    } catch (err) {
      console.error('Failed to load stories:', err);
    }
  },

  fetchStories: async () => {
    try {
      const stories = await api.getStories();
      set({ stories });
    } catch (err) {
      console.error('Failed to load stories:', err);
    }
  },

  // Groups
  createGroup: async (name, memberIds, description) => {
    try {
      const group = await api.createGroup({ name, memberIds, description });
      const { conversations } = get();
      set({ conversations: [group, ...conversations], showCreateGroup: false });
      return group;
    } catch (err) {
      console.error('Failed to create group:', err);
      throw err;
    }
  }
}));

export default useStore;
