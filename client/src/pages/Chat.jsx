import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore';
import Sidebar from '../components/Sidebar/Sidebar';
import ChatWindow from '../components/Chat/ChatWindow';
import WelcomeScreen from '../components/Chat/WelcomeScreen';
import ProfilePanel from '../components/Profile/ProfilePanel';
import CreateGroupModal from '../components/Groups/CreateGroupModal';
import StoryViewer from '../components/Stories/StoryViewer';
import SearchModal from '../components/Search/SearchModal';
import CallScreen from '../components/Calls/CallScreen';
import BookmarksPanel from '../components/Bookmarks/BookmarksPanel';

export default function ChatPage() {
  const { 
    activeConversation, loadConversations, loadStories,
    showProfile, showCreateGroup, showStories, showSearch, 
    showBookmarks, activeCall,
    setShowCreateGroup, setShowStories, setShowSearch, setActiveCall
  } = useStore();

  useEffect(() => {
    loadConversations();
    loadStories();
  }, []);

  return (
    <div className="w-full h-[100dvh] flex overflow-hidden bg-dark-950">
      {/* Sidebar */}
      <div className={`${activeConversation ? 'hidden md:flex' : 'flex'} w-full md:w-[380px] flex-shrink-0 h-full max-w-full`}>
        <Sidebar className="w-full h-full" />
      </div>

      {/* Main content */}
      <div className={`flex-1 flex flex-col min-h-0 min-w-0 relative h-full max-w-full ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
        <AnimatePresence mode="wait">
          {activeConversation ? (
            <motion.div
              key={activeConversation.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-h-0 min-w-0"
            >
              <ChatWindow />
            </motion.div>
          ) : (
            <motion.div
              key="welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col min-h-0 min-w-0"
            >
              <WelcomeScreen />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right panels */}
        <AnimatePresence>
          {showProfile && (
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="absolute inset-y-0 right-0 z-50 w-full md:relative md:w-[380px] md:z-auto border-l border-white/5 bg-dark-900 flex-shrink-0"
            >
              <ProfilePanel />
            </motion.div>
          )}

          {showBookmarks && (
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="absolute inset-y-0 right-0 z-50 w-full md:relative md:w-[380px] md:z-auto border-l border-white/5 bg-dark-900 flex-shrink-0"
            >
              <BookmarksPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
        {showStories && <StoryViewer onClose={() => setShowStories(false)} />}
        {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
        {activeCall && <CallScreen onClose={() => setActiveCall(null)} />}
      </AnimatePresence>
    </div>
  );
}
