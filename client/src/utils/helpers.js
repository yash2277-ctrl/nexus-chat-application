// Format timestamp to readable time
export function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (isYesterday) return 'Yesterday';
  
  if (diff < 604800000) { // 7 days
    return date.toLocaleDateString([], { weekday: 'short' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Format full date
export function formatFullDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleDateString([], { 
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// Format message date separator
export function formatDateSeparator(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// Format file size
export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

// Format duration in seconds
export function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Get initials from name
export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// Get gradient for avatar based on id
export function getAvatarGradient(id) {
  const gradients = [
    'from-violet-500 to-purple-500',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-orange-500 to-amber-500',
    'from-pink-500 to-rose-500',
    'from-indigo-500 to-blue-500',
    'from-fuchsia-500 to-pink-500',
    'from-cyan-500 to-blue-500',
  ];
  const index = id ? id.charCodeAt(0) % gradients.length : 0;
  return gradients[index];
}

// Get last seen text
export function getLastSeen(lastSeen, isOnline) {
  if (isOnline) return 'online';
  if (!lastSeen) return 'offline';
  
  const diff = Date.now() - lastSeen;
  if (diff < 60000) return 'last seen just now';
  if (diff < 3600000) return `last seen ${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `last seen ${Math.floor(diff / 3600000)}h ago`;
  return `last seen ${new Date(lastSeen).toLocaleDateString()}`;
}

// Truncate text
export function truncate(text, length = 40) {
  if (!text) return '';
  return text.length > length ? text.slice(0, length) + '...' : text;
}

// Get conversation display name
export function getConversationName(conversation, currentUserId) {
  if (conversation.type === 'group' || conversation.type === 'channel') {
    return conversation.name || 'Group';
  }
  
  const otherUser = conversation.participants?.find(p => p.id !== currentUserId);
  return otherUser?.display_name || otherUser?.username || 'Unknown';
}

// Get conversation avatar
export function getConversationAvatar(conversation, currentUserId) {
  if (conversation.type === 'group') return conversation.avatar;
  const otherUser = conversation.participants?.find(p => p.id !== currentUserId);
  return otherUser?.avatar;
}

// Get other user in private conversation
export function getOtherUser(conversation, currentUserId) {
  if (!conversation?.participants) return null;
  return conversation.participants.find(p => p.id !== currentUserId);
}

// Debounce function
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Check if URL is an image
export function isImageUrl(url) {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(url);
}

// Check if URL is a video
export function isVideoUrl(url) {
  return /\.(mp4|webm|ogg|mov|avi)$/i.test(url);
}

// Play notification sound
export function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    // Silent fail
  }
}

// Generate random color
export function randomColor() {
  const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'];
  return colors[Math.floor(Math.random() * colors.length)];
}
