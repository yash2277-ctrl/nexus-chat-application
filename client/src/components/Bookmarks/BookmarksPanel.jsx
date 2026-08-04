import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';
import api from '../../utils/api';
import { formatTime, formatFullDate, getAvatarGradient, getInitials } from '../../utils/helpers';
import { resolveUrl } from '../../utils/api';
import { X, Bookmark, MessageSquare, Trash2, ExternalLink } from 'lucide-react';

export default function BookmarksPanel() {
  const { user, setShowBookmarks, setActiveConversation } = useStore();
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    try {
      const data = await api.getBookmarks();
      setBookmarks(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const removeBookmark = async (messageId) => {
    try {
      await api.toggleBookmark(messageId);
      setBookmarks(bookmarks.filter(b => b.message_id !== messageId));
    } catch (err) { console.error(err); }
  };

  const goToMessage = (bookmark) => {
    if (bookmark.conversation_id) {
      setActiveConversation({ id: bookmark.conversation_id });
    }
    setShowBookmarks(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-primary-400" />
          <h3 className="text-sm font-semibold text-white">Bookmarks</h3>
          {bookmarks.length > 0 && (
            <span className="text-[10px] text-dark-500 bg-dark-700 px-2 py-0.5 rounded-full">
              {bookmarks.length}
            </span>
          )}
        </div>
        <button onClick={() => setShowBookmarks(false)} className="btn-icon">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-dark-500 gap-3 px-6">
            <div className="w-16 h-16 rounded-full bg-dark-700 flex items-center justify-center">
              <Bookmark className="w-7 h-7 opacity-50" />
            </div>
            <p className="text-sm text-center">No bookmarked messages yet</p>
            <p className="text-xs text-center text-dark-600">Long press on a message and tap the bookmark icon to save it here</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            <AnimatePresence>
              {bookmarks.map((bookmark, i) => (
                <motion.div
                  key={bookmark.message_id || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-card p-3 group"
                >
                  {/* Sender info */}
                  <div className="flex items-center gap-2 mb-2">
                    {bookmark.sender_avatar ? (
                      <img src={resolveUrl(bookmark.sender_avatar)} className="w-6 h-6 rounded-full object-cover" alt="" />
                    ) : (
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarGradient(bookmark.sender_id)} flex items-center justify-center text-white text-[8px] font-bold`}>
                        {getInitials(bookmark.sender_name || '')}
                      </div>
                    )}
                    <span className="text-xs font-medium text-dark-300">{bookmark.sender_name}</span>
                    <span className="text-[10px] text-dark-500 ml-auto">{formatTime(bookmark.created_at)}</span>
                  </div>

                  {/* Message content */}
                  <p className="text-sm text-dark-200 mb-2 line-clamp-3">{bookmark.content}</p>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => goToMessage(bookmark)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-dark-600 text-xs text-dark-400 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Go to chat
                    </button>
                    <button
                      onClick={() => removeBookmark(bookmark.message_id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-red-500/10 text-xs text-dark-400 hover:text-red-400 transition-colors ml-auto"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
