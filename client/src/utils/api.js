const TOKEN_KEY = 'nexus_token';

export const BACKEND_URL = '';

export function resolveUrl(url) {
  if (!url) return url;
  if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  return url;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (token) headers.set('Authorization', `Bearer ${token}`);

  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
    body,
  });

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message = data?.error || data?.message || 'Request failed';
    throw new Error(message);
  }

  return data;
}

function normalizeUser(user = {}) {
  const id = user.id || user.$id;
  return {
    ...user,
    id,
    $id: id,
    display_name: user.display_name || user.displayName || user.name || '',
    displayName: user.display_name || user.displayName || user.name || '',
    avatar: user.avatar || null,
    bio: user.bio || '',
    status: user.status || '',
    theme: user.theme || 'dark',
    language: user.language || 'en',
    is_online: user.is_online ?? user.isOnline ?? 0,
    last_seen: user.last_seen || user.lastSeen || null,
  };
}

function normalizeReaction(reaction = {}) {
  return {
    ...reaction,
    userId: reaction.userId || reaction.user_id || null,
  };
}

function normalizeMessage(message = {}) {
  const reactions = Array.isArray(message.reactions)
    ? message.reactions.map(normalizeReaction)
    : typeof message.reactions === 'string'
      ? (() => {
          try { return JSON.parse(message.reactions).map(normalizeReaction); } catch { return []; }
        })()
      : [];

  return {
    ...message,
    id: message.id || message.$id,
    conversation_id: message.conversation_id || message.conversationId || null,
    sender_id: message.sender_id || message.senderId || null,
    sender_name: message.sender_name || message.senderName || '',
    sender_avatar: message.sender_avatar || message.senderAvatar || '',
    sender_username: message.sender_username || message.senderUsername || '',
    receiver_id: message.receiver_id || message.receiverId || null,
    content: message.content || '',
    type: message.type || 'text',
    media_url: message.media_url || message.mediaUrl || null,
    media_thumbnail: message.media_thumbnail || message.mediaThumbnail || null,
    media_size: message.media_size ?? message.mediaSize ?? 0,
    media_duration: message.media_duration ?? message.mediaDuration ?? 0,
    media_dimensions: message.media_dimensions || message.mediaDimensions || null,
    reply_to: message.reply_to || message.replyTo || null,
    replyMessage: message.replyMessage ? normalizeMessage(message.replyMessage) : null,
    reactions,
    created_at: message.created_at || message.createdAt || Date.now(),
    updated_at: message.updated_at || message.updatedAt || Date.now(),
    is_deleted: message.is_deleted ?? message.isDeleted ?? 0,
    is_edited: message.is_edited ?? message.isEdited ?? 0,
    is_pinned: message.is_pinned ?? message.isPinned ?? 0,
    is_starred: message.is_starred ?? message.isStarred ?? 0,
  };
}

function normalizeConversation(conversation = {}) {
  const participants = Array.isArray(conversation.participants)
    ? conversation.participants.map(normalizeUser)
    : [];

  return {
    ...conversation,
    id: conversation.id,
    type: conversation.type || 'private',
    name: conversation.name || '',
    description: conversation.description || '',
    avatar: conversation.avatar || null,
    participants,
    unread_count: conversation.unread_count ?? conversation.unreadCount ?? 0,
    lastMessage: conversation.lastMessage ? normalizeMessage(conversation.lastMessage) : conversation.lastMessage || null,
    updated_at: conversation.updated_at || conversation.updatedAt || Date.now(),
    created_at: conversation.created_at || conversation.createdAt || Date.now(),
    role: conversation.role || 'member',
    is_muted: conversation.is_muted ?? conversation.isMuted ?? 0,
    last_read_message_id: conversation.last_read_message_id || conversation.lastReadMessageId || null,
  };
}

function normalizeBookmark(bookmark = {}) {
  return {
    ...bookmark,
    id: bookmark.id,
    tags: Array.isArray(bookmark.tags)
      ? bookmark.tags
      : (() => {
          try { return JSON.parse(bookmark.tags || '[]'); } catch { return []; }
        })(),
    sender_name: bookmark.sender_name || bookmark.senderName || '',
    conversation_name: bookmark.conversation_name || bookmark.conversationName || '',
  };
}

function normalizeStoryGroup(group = {}) {
  return {
    ...group,
    userId: group.userId || group.user_id,
    displayName: group.displayName || group.display_name || '',
    username: group.username || '',
    avatar: group.avatar || null,
    stories: Array.isArray(group.stories)
      ? group.stories.map((story) => ({
          ...story,
          id: story.id,
          user_id: story.user_id || story.userId,
          media_url: story.media_url || story.mediaUrl || null,
          background_color: story.background_color || story.backgroundColor || '#6366f1',
          font_style: story.font_style || story.fontStyle || 'normal',
          expires_at: story.expires_at || story.expiresAt || null,
          created_at: story.created_at || story.createdAt || Date.now(),
        }))
      : [],
  };
}

class ApiClient {
  constructor() {
    this.sessionId = getToken();
  }

  setToken(token) {
    setToken(token);
    this.sessionId = token || null;
  }

  async register(data) {
    const response = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: data.username,
        email: data.email,
        password: data.password,
        displayName: data.displayName || data.name || data.username,
      },
    });

    this.setToken(response.token);
    return { user: normalizeUser(response.user), token: response.token };
  }

  async login(data) {
    const response = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        login: data.login || data.email,
        password: data.password,
      },
    });

    this.setToken(response.token);
    return { user: normalizeUser(response.user), token: response.token };
  }

  async getMe() {
    const user = await apiRequest('/api/auth/me');
    return normalizeUser(user);
  }

  async logout() {
    this.setToken(null);
  }

  async updateProfile(data) {
    const response = await apiRequest('/api/auth/profile', {
      method: 'PUT',
      body: {
        displayName: data.displayName || data.name,
        bio: data.bio,
        status: data.status,
        avatar: data.avatar,
        phone: data.phone,
        theme: data.theme,
        language: data.language,
      },
    });

    return normalizeUser(response);
  }

  async storePublicKey(publicKey) {
    await apiRequest('/api/auth/public-key', {
      method: 'POST',
      body: { publicKey },
    });
    return { success: true };
  }

  async searchUsers(q) {
    const users = await apiRequest(`/api/users/search?q=${encodeURIComponent(q || '')}`);
    return Array.isArray(users) ? users.map(normalizeUser) : [];
  }

  async getUsers() {
    const users = await apiRequest('/api/users');
    return Array.isArray(users) ? users.map(normalizeUser) : [];
  }

  async getUser(id) {
    return normalizeUser(await apiRequest(`/api/users/${id}`));
  }

  async getUserPublicKey(id) {
    return apiRequest(`/api/users/${id}/public-key`);
  }

  async getConversations() {
    const conversations = await apiRequest('/api/messages/conversations');
    return Array.isArray(conversations) ? conversations.map(normalizeConversation) : [];
  }

  async createPrivateConversation(userId) {
    return normalizeConversation(await apiRequest('/api/messages/conversations/private', {
      method: 'POST',
      body: { userId },
    }));
  }

  async getMessages(conversationId, before) {
    const params = new URLSearchParams();
    params.set('limit', '50');
    if (before) params.set('before', before);

    const messages = await apiRequest(`/api/messages/conversations/${conversationId}/messages?${params.toString()}`);
    return Array.isArray(messages) ? messages.map(normalizeMessage) : [];
  }

  async sendMessage(conversationId, data) {
    const message = await apiRequest(`/api/messages/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: {
        content: data.content || data.fileUrl || '',
        type: data.type || 'text',
        mediaUrl: data.mediaUrl,
        mediaThumbnail: data.mediaThumbnail,
        mediaSize: data.mediaSize,
        mediaDuration: data.mediaDuration,
        mediaDimensions: data.mediaDimensions,
        replyTo: data.replyTo || null,
        encryptedContent: data.encryptedContent,
      },
    });

    return normalizeMessage(message);
  }

  async editMessage(messageId, content) {
    return normalizeMessage(await apiRequest(`/api/messages/messages/${messageId}`, {
      method: 'PUT',
      body: { content },
    }));
  }

  async deleteMessage(messageId) {
    return apiRequest(`/api/messages/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  async reactToMessage(messageId, emoji) {
    return apiRequest(`/api/messages/messages/${messageId}/react`, {
      method: 'POST',
      body: { emoji },
    });
  }

  async pinMessage(messageId) {
    return apiRequest(`/api/messages/messages/${messageId}/pin`, {
      method: 'POST',
    });
  }

  async starMessage(messageId) {
    return apiRequest(`/api/messages/messages/${messageId}/star`, {
      method: 'POST',
    });
  }

  async bookmarkMessage(messageId, tags = [], note = '') {
    return apiRequest(`/api/messages/messages/${messageId}/bookmark`, {
      method: 'POST',
      body: { tags, note },
    });
  }

  async getBookmarks() {
    const bookmarks = await apiRequest('/api/messages/bookmarks');
    return Array.isArray(bookmarks) ? bookmarks.map(normalizeBookmark) : [];
  }

  async searchMessages(q, conversationId) {
    const params = new URLSearchParams();
    params.set('q', q || '');
    if (conversationId) params.set('conversationId', conversationId);
    const messages = await apiRequest(`/api/messages/search?${params.toString()}`);
    return Array.isArray(messages) ? messages.map(normalizeMessage) : [];
  }

  async markAsRead(conversationId, messageId) {
    return apiRequest(`/api/messages/conversations/${conversationId}/read`, {
      method: 'POST',
      body: { messageId },
    });
  }

  async forwardMessage(messageId, conversationIds = []) {
    return apiRequest(`/api/messages/messages/${messageId}/forward`, {
      method: 'POST',
      body: { conversationIds },
    });
  }

  async scheduleMessage(data) {
    return apiRequest('/api/messages/scheduled', {
      method: 'POST',
      body: data,
    });
  }

  async getScheduledMessages() {
    return apiRequest('/api/messages/scheduled');
  }

  async getPinnedMessages(conversationId) {
    const messages = await apiRequest(`/api/messages/conversations/${conversationId}/pinned`);
    return Array.isArray(messages) ? messages.map(normalizeMessage) : [];
  }

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest('/api/media/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);
    return apiRequest('/api/media/avatar', {
      method: 'POST',
      body: formData,
    });
  }

  async uploadMultiple(files = []) {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return apiRequest('/api/media/upload-multiple', {
      method: 'POST',
      body: formData,
    });
  }

  async uploadBase64(data) {
    return apiRequest('/api/media/upload-base64', {
      method: 'POST',
      body: data,
    });
  }

  async getStories() {
    const stories = await apiRequest('/api/stories');
    return Array.isArray(stories) ? stories.map(normalizeStoryGroup) : [];
  }

  async createStory(data) {
    return apiRequest('/api/stories', {
      method: 'POST',
      body: data,
    });
  }

  async viewStory(storyId) {
    return apiRequest(`/api/stories/${storyId}/view`, { method: 'POST' });
  }

  async reactToStory(storyId, emoji) {
    return apiRequest(`/api/stories/${storyId}/react`, {
      method: 'POST',
      body: { emoji },
    });
  }

  async getStoryViewers(storyId) {
    return apiRequest(`/api/stories/${storyId}/viewers`);
  }

  async deleteStory(storyId) {
    return apiRequest(`/api/stories/${storyId}`, { method: 'DELETE' });
  }

  async createGroup({ name, memberIds = [], description = '', avatar = null }) {
    return normalizeConversation(await apiRequest('/api/groups', {
      method: 'POST',
      body: { name, memberIds, description, avatar },
    }));
  }

  async updateGroup(id, data) {
    return normalizeConversation(await apiRequest(`/api/groups/${id}`, {
      method: 'PUT',
      body: data,
    }));
  }

  async addGroupMembers(id, userIds = []) {
    return apiRequest(`/api/groups/${id}/members`, {
      method: 'POST',
      body: { userIds },
    });
  }

  async removeGroupMember(id, userId) {
    return apiRequest(`/api/groups/${id}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  async leaveGroup(id) {
    return apiRequest(`/api/groups/${id}/leave`, { method: 'POST' });
  }

  async createPoll(conversationId, pollData) {
    return apiRequest(`/api/groups/${conversationId}/poll`, {
      method: 'POST',
      body: pollData,
    });
  }

  async votePoll(pollId, optionId) {
    return apiRequest(`/api/groups/polls/${pollId}/vote`, {
      method: 'POST',
      body: { optionId },
    });
  }

  async createNote(conversationId, noteData) {
    return apiRequest(`/api/groups/${conversationId}/notes`, {
      method: 'POST',
      body: noteData,
    });
  }

  async getNotes(conversationId) {
    return apiRequest(`/api/groups/${conversationId}/notes`);
  }

  async updateNote(noteId, noteData) {
    return apiRequest(`/api/groups/notes/${noteId}`, {
      method: 'PUT',
      body: noteData,
    });
  }

  // Compatibility stubs for features not wired in the current backend UI path.
  async reactToMessageThread() { return {}; }
  async searchMessagesAdvanced() { return []; }
}

const api = new ApiClient();
export default api;