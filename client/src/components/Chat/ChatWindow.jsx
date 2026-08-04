import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';
import ChatHeader from './ChatHeader';
import MessageInput from './MessageInput';
import MessageBubble from './MessageBubble';
import { formatDateSeparator } from '../../utils/helpers';
import { ChevronDown, ArrowDown, Image, Paintbrush, X } from 'lucide-react';

const WALLPAPERS = [
  null, // default dark
  'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
  'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #21262d 100%)',
  'linear-gradient(180deg, #1a1c2e 0%, #0d0f1a 100%)',
  'linear-gradient(135deg, #0c0c1d 0%, #1a0a2e 50%, #0c0c1d 100%)',
  'linear-gradient(135deg, #071a1a 0%, #0a2a2a 50%, #071a1a 100%)',
  'linear-gradient(135deg, #1a0a0a 0%, #2a1515 50%, #1a0a0a 100%)',
];

export default function ChatWindow() {
  const { activeConversation, messages, user, loadMoreMessages, typingUsers } = useStore();
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [wallpaper, setWallpaper] = useState(() => {
    try { return localStorage.getItem('nexus_wallpaper') || null; } catch { return null; }
  });
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState('');
  const prevMessagesLengthRef = useRef(0);
  const isNearBottomRef = useRef(true);

  // Auto-scroll to bottom on new messages if near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom('smooth');
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  // Scroll to bottom on conversation change
  useEffect(() => {
    scrollToBottom('instant');
  }, [activeConversation?.id]);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distFromBottom = scrollHeight - scrollTop - clientHeight;
    isNearBottomRef.current = distFromBottom < 120;
    setShowScrollBtn(distFromBottom > 300);

    // Load more when scrolled to top
    if (scrollTop < 50 && !loadingMore) {
      setLoadingMore(true);
      const prevHeight = scrollHeight;
      loadMoreMessages().then((hasMore) => {
        if (hasMore) {
          requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight - prevHeight;
          });
        }
      }).finally(() => setLoadingMore(false));
    }
  }, [loadMoreMessages, loadingMore]);

  const setWallpaperAndSave = (wp) => {
    setWallpaper(wp);
    try {
      if (wp) localStorage.setItem('nexus_wallpaper', wp);
      else localStorage.removeItem('nexus_wallpaper');
    } catch {}
  };

  const handleCustomWallpaper = () => {
    if (customWallpaperUrl.trim()) {
      setWallpaperAndSave(`url(${customWallpaperUrl.trim()})`);
      setCustomWallpaperUrl('');
      setShowWallpaperPicker(false);
    }
  };

  const handleWallpaperImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setWallpaperAndSave(`url(${ev.target.result})`);
      setShowWallpaperPicker(false);
    };
    reader.readAsDataURL(file);
  };

  // Group messages by date
  const groupedMessages = [];
  let lastDate = null;
  messages.forEach((msg) => {
    const msgDate = new Date(msg.created_at).toDateString();
    if (msgDate !== lastDate) {
      groupedMessages.push({ type: 'date', date: msg.created_at, key: `date-${msg.created_at}` });
      lastDate = msgDate;
    }
    groupedMessages.push({ type: 'message', message: msg, key: msg.id });
  });

  const typing = typingUsers[activeConversation?.id];
  const isTyping = typing && typing.length > 0;

  const wallpaperStyle = {};
  if (wallpaper) {
    if (wallpaper.startsWith('url(')) {
      wallpaperStyle.backgroundImage = wallpaper;
      wallpaperStyle.backgroundSize = 'cover';
      wallpaperStyle.backgroundPosition = 'center';
    } else {
      wallpaperStyle.background = wallpaper;
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 relative">
      <ChatHeader />

      {/* Wallpaper toggle button */}
      <button
        onClick={() => setShowWallpaperPicker(!showWallpaperPicker)}
        className="absolute top-[72px] right-4 z-20 w-8 h-8 rounded-full bg-dark-800/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-700/80 transition-all"
        title="Change wallpaper"
      >
        <Paintbrush className="w-3.5 h-3.5" />
      </button>

      {/* Wallpaper picker */}
      <AnimatePresence>
        {showWallpaperPicker && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-[108px] right-4 z-30 bg-dark-800 rounded-xl border border-white/10 shadow-2xl p-3 w-64"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white">Chat Wallpaper</span>
              <button onClick={() => setShowWallpaperPicker(false)} className="text-dark-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {WALLPAPERS.map((wp, i) => (
                <button
                  key={i}
                  onClick={() => { setWallpaperAndSave(wp); setShowWallpaperPicker(false); }}
                  className={`w-12 h-12 rounded-lg border-2 transition-all ${
                    wallpaper === wp ? 'border-primary-500 scale-105' : 'border-white/10 hover:border-white/30'
                  }`}
                  style={wp ? { background: wp } : { background: '#0a0a0f' }}
                >
                  {!wp && <span className="text-[8px] text-dark-400">Default</span>}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <label className="flex-1">
                <input type="file" accept="image/*" className="hidden" onChange={handleWallpaperImageUpload} />
                <div className="cursor-pointer flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-dark-700/50 border border-white/10 text-dark-400 hover:text-white hover:border-white/20 transition-all text-xs">
                  <Image className="w-3 h-3" /> Upload
                </div>
              </label>
              {wallpaper && (
                <button
                  onClick={() => { setWallpaperAndSave(null); setShowWallpaperPicker(false); }}
                  className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-xs"
                >
                  Reset
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0 px-4 md:px-8 py-4 scroll-smooth relative"
        style={wallpaperStyle}
      >
        {/* Loading more indicator */}
        {loadingMore && (
          <div className="flex justify-center py-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-5 h-5 rounded-full border-2 border-primary-500/30 border-t-primary-500"
            />
          </div>
        )}

        <div className="max-w-4xl mx-auto space-y-1">
          {/* E2E encryption notice */}
          {activeConversation?.type === 'private' && messages.length > 0 && (
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-800/40 backdrop-blur-sm border border-white/5">
                <span className="text-[11px] text-dark-500">🔒 Messages are end-to-end encrypted</span>
              </div>
            </div>
          )}

          {groupedMessages.map((item, idx) => {
            if (item.type === 'date') {
              return (
                <div key={item.key} className="flex justify-center my-4">
                  <span className="px-4 py-1.5 rounded-full text-[11px] text-dark-400 bg-dark-800/60 backdrop-blur-sm border border-white/5 font-medium">
                    {formatDateSeparator(item.date)}
                  </span>
                </div>
              );
            }

            const msg = item.message;
            const isOwn = msg.sender_id === user?.id;
            const prevMsg = idx > 0 && groupedMessages[idx - 1].type === 'message' ? groupedMessages[idx - 1].message : null;
            const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id;

            return (
              <MessageBubble
                key={item.key}
                message={msg}
                isOwn={isOwn}
                showAvatar={showAvatar}
              />
            );
          })}

          {/* Typing indicator */}
          <AnimatePresence>
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex items-center gap-2 ml-10 mb-2"
              >
                <div className="bg-dark-800/80 backdrop-blur-sm border border-white/5 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="type-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => scrollToBottom('smooth')}
            className="absolute bottom-24 right-6 w-10 h-10 rounded-full bg-dark-800 border border-white/10 shadow-xl flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-700 transition-all z-20"
          >
            <ArrowDown className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      <MessageInput />
    </div>
  );
}
