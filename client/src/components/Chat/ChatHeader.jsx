import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';
import { getConversationName, getConversationAvatar, getOtherUser, getLastSeen, getAvatarGradient, getInitials } from '../../utils/helpers';
import { resolveUrl } from '../../utils/api';
import { Phone, Video, Search, MoreVertical, Pin, Users, ArrowLeft, Shield, Info } from 'lucide-react';
import { getSocket } from '../../hooks/useSocket';

export default function ChatHeader() {
  const { activeConversation, user, typingUsers, setActiveConversation, setShowProfile } = useStore();
  const [showMenu, setShowMenu] = useState(false);

  if (!activeConversation) return null;

  const name = getConversationName(activeConversation, user?.id);
  const avatar = getConversationAvatar(activeConversation, user?.id);
  const otherUser = getOtherUser(activeConversation, user?.id);
  const isGroup = activeConversation.type === 'group';
  const gradient = getAvatarGradient(activeConversation.id);

  const typing = typingUsers[activeConversation.id];
  const isTyping = typing && typing.length > 0;

  const getSubtitle = () => {
    if (isTyping) {
      return (
        <span className="text-primary-400 flex items-center gap-1">
          <span className="type-indicator"><span></span><span></span><span></span></span>
          typing...
        </span>
      );
    }
    if (isGroup) {
      const count = activeConversation.participants?.length || 0;
      return `${count} member${count !== 1 ? 's' : ''}`;
    }
    if (otherUser) {
      return getLastSeen(otherUser.last_seen, otherUser.is_online);
    }
    return '';
  };

  const handleCall = (type) => {
    if (!otherUser) return;
    const socket = getSocket();
    if (socket) {
      useStore.getState().setActiveCall({
        type: 'outgoing',
        callType: type,
        targetUserId: otherUser.id,
        targetName: otherUser.display_name,
        targetAvatar: otherUser.avatar,
        conversationId: activeConversation.id
      });
    }
  };

  return (
    <div className="h-16 px-4 flex items-center justify-between flex-shrink-0 bg-dark-900/80 backdrop-blur-xl border-b border-white/5 z-30 relative">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveConversation(null)}
          className="btn-icon md:hidden"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <button className="flex items-center gap-3 cursor-pointer" onClick={() => setShowProfile(true)}>
          <div className="relative">
            {avatar ? (
              <img src={resolveUrl(avatar)} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-sm`}>
                {isGroup ? <Users className="w-5 h-5" /> : getInitials(name)}
              </div>
            )}
            {!isGroup && !!otherUser?.is_online && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-dark-900" />
            )}
          </div>

          <div className="text-left">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              {name}
              {!isGroup && (
                <Shield className="w-3 h-3 text-emerald-400" title="E2E Encrypted" />
              )}
            </h3>
            <p className="text-[11px] text-dark-400">
              {getSubtitle()}
            </p>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-1">
        {!isGroup && (
          <>
            <button onClick={() => handleCall('voice')} className="btn-icon">
              <Phone className="w-4.5 h-4.5" />
            </button>
            <button onClick={() => handleCall('video')} className="btn-icon">
              <Video className="w-4.5 h-4.5" />
            </button>
          </>
        )}
        
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="btn-icon">
            <MoreVertical className="w-4.5 h-4.5" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 w-52 bg-dark-800 rounded-xl border border-white/10 shadow-2xl z-50 overflow-hidden"
                >
                  <button onClick={() => { setShowProfile(true); setShowMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 text-white text-sm">
                    <Info className="w-4 h-4 text-dark-400" /> View Info
                  </button>
                  <button onClick={() => setShowMenu(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 text-white text-sm">
                    <Pin className="w-4 h-4 text-dark-400" /> Pinned Messages
                  </button>
                  <button onClick={() => setShowMenu(false)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 text-white text-sm">
                    <Search className="w-4 h-4 text-dark-400" /> Search in Chat
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
