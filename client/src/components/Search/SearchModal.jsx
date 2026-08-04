import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';
import api from '../../utils/api';
import { formatTime, formatDateSeparator, getAvatarGradient, getInitials, truncate } from '../../utils/helpers';
import { resolveUrl } from '../../utils/api';
import { X, Search as SearchIcon, MessageSquare, ArrowRight } from 'lucide-react';

export default function SearchModal({ onClose }) {
  const { setActiveConversation } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const search = async () => {
      if (query.length < 2) { setResults([]); return; }
      setLoading(true);
      try {
        const data = await api.searchMessages(query);
        setResults(data);
      } catch (err) { console.error(err); }
      setLoading(false);
    };
    const timer = setTimeout(search, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const highlightMatch = (text, q) => {
    if (!q || !text) return text;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-primary-500/30 text-primary-300 rounded px-0.5">{part}</mark> : part
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[10vh]"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        className="bg-dark-800 rounded-2xl w-full max-w-lg border border-white/5 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="p-4 border-b border-white/5">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-dark-700 border border-white/5 rounded-xl py-3 pl-11 pr-10 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
              placeholder="Search messages..."
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-dark-500 hover:text-dark-300" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <div className="p-2">
              <p className="px-3 py-2 text-xs text-dark-500">{results.length} result{results.length !== 1 ? 's' : ''}</p>
              {results.map((msg, i) => (
                <motion.button
                  key={msg.id || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => {
                    if (msg.conversation_id) {
                      setActiveConversation({ id: msg.conversation_id });
                    }
                    onClose();
                  }}
                  className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-dark-700/50 transition-all text-left"
                >
                  {msg.sender_avatar ? (
                    <img src={resolveUrl(msg.sender_avatar)} className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="" />
                  ) : (
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarGradient(msg.sender_id)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                      {getInitials(msg.sender_name || '')}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white truncate">{msg.sender_name}</p>
                      <span className="text-[10px] text-dark-500 flex-shrink-0">{formatTime(msg.created_at)}</span>
                    </div>
                    <p className="text-sm text-dark-300 mt-0.5 line-clamp-2">
                      {highlightMatch(msg.content, query)}
                    </p>
                    {msg.conversation_name && (
                      <p className="text-[10px] text-dark-500 mt-1 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        in {msg.conversation_name}
                      </p>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <div className="flex flex-col items-center justify-center py-12 text-dark-500">
              <SearchIcon className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No messages found</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-dark-500">
              <SearchIcon className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Type to search messages</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
