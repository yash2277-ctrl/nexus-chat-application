import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';
import api from '../../utils/api';
import { resolveUrl } from '../../utils/api';
import ChatItem from './ChatItem';
import { getConversationName, getOtherUser } from '../../utils/helpers';
import { 
  Search, Plus, Users, Settings, LogOut, MessageCircle, 
  Bookmark, Clock, CircleDot, X, UserPlus, Hash
} from 'lucide-react';

export default function Sidebar() {
  const {
    conversations, user, activeConversation,
    setActiveConversation, setShowCreateGroup, setShowStories,
    setShowSearch, setShowBookmarks, setShowProfile,
    startPrivateChat, logout, stories
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timer = setTimeout(async () => {
        setIsSearching(true);
        try {
          const users = await api.searchUsers(searchQuery);
          setSearchResults(users);
        } catch (err) {
          console.error(err);
        }
        setIsSearching(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleUserClick = async (targetUser) => {
    await startPrivateChat(targetUser.id);
    setSearchQuery('');
    setSearchResults([]);
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const name = getConversationName(conv, user?.id);
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const hasUnviewedStories = stories.some(s => s.hasUnviewed && s.userId !== user?.id);

  return (
    <div className="w-full h-full flex flex-col bg-dark-900 border-r border-white/5 flex-shrink-0">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowProfile(true)}
            className="relative group"
          >
            {user?.avatar ? (
              <img src={resolveUrl(user.avatar)} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-primary-500/30" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                {user?.display_name?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-dark-900" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Chats</h1>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => setShowStories(true)} className="btn-icon relative">
            <CircleDot className="w-5 h-5" />
            {hasUnviewedStories && (
              <div className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full" />
            )}
          </button>
          <button onClick={() => setShowSearch(true)} className="btn-icon">
            <Search className="w-5 h-5" />
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="btn-icon">
              <Plus className="w-5 h-5" />
            </button>
            <AnimatePresence>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    className="absolute right-0 top-full mt-1 w-56 bg-dark-800 rounded-xl border border-white/10 shadow-2xl z-40 overflow-hidden"
                  >
                    <button
                      onClick={() => { setShowCreateGroup(true); setShowMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-white text-sm transition-colors"
                    >
                      <Users className="w-4 h-4 text-primary-400" />
                      New Group
                    </button>
                    <button
                      onClick={() => { setShowBookmarks(true); setShowMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-white text-sm transition-colors"
                    >
                      <Bookmark className="w-4 h-4 text-amber-400" />
                      Bookmarks
                    </button>
                    <button
                      onClick={() => { setShowProfile(true); setShowMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-white text-sm transition-colors"
                    >
                      <Settings className="w-4 h-4 text-dark-400" />
                      Settings
                    </button>
                    <div className="border-t border-white/5" />
                    <button
                      onClick={() => { logout(); setShowMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 text-red-400 text-sm transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
          <input
            type="text"
            placeholder="Search chats or users..."
            className="w-full bg-dark-800/50 border border-white/5 rounded-xl pl-10 pr-8 py-2.5 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500/30 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-1 flex gap-1 overflow-x-auto no-scrollbar">
        {['chats', 'groups', 'status', 'all'].map(tab => (
          <button
            key={tab}
            onClick={() => tab === 'status' ? setShowStories(true) : setActiveTab(tab)}
            className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
              tab === 'status'
                ? 'text-green-400 hover:bg-green-500/10 border border-green-500/20 bg-green-500/5'
                : activeTab === tab
                  ? 'bg-primary-500/15 text-primary-400 border border-primary-500/20'
                  : 'text-dark-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab === 'status' ? '📢 Status' : tab}
            {tab === 'status' && hasUnviewedStories && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-dark-900" />
            )}
          </button>
        ))}
      </div>

      {/* User search results */}
      <AnimatePresence>
        {searchResults.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-white/5 overflow-hidden"
          >
            <div className="px-4 py-2">
              <p className="text-xs text-dark-500 font-medium mb-2 flex items-center gap-1">
                <UserPlus className="w-3 h-3" /> Users found
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {searchResults.map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleUserClick(u)}
                    className="w-full sidebar-item"
                  >
                    {u.avatar ? (
                      <img src={resolveUrl(u.avatar)} className="w-9 h-9 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                        {u.display_name?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <p className="text-sm text-white font-medium">{u.display_name}</p>
                      <p className="text-xs text-dark-500">@{u.username}</p>
                    </div>
                    {u.is_online ? (
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 min-h-0">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-dark-800/50 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-dark-600" />
            </div>
            <p className="text-dark-500 text-sm">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </p>
            <p className="text-dark-600 text-xs mt-1">
              Search for users to start chatting
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredConversations
              .filter(conv => {
                if (activeTab === 'chats') return conv.type === 'private';
                if (activeTab === 'groups') return conv.type === 'group' || conv.type === 'channel';
                return true;
              })
              .map(conv => (
                <ChatItem
                  key={conv.id}
                  conversation={conv}
                  isActive={activeConversation?.id === conv.id}
                  onClick={() => setActiveConversation(conv)}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
