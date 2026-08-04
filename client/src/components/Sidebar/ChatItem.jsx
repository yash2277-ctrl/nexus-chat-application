import { motion } from 'framer-motion';
import useStore from '../../store/useStore';
import { getConversationName, getConversationAvatar, getOtherUser, formatTime, truncate, getAvatarGradient, getInitials } from '../../utils/helpers';
import { resolveUrl } from '../../utils/api';
import { Check, CheckCheck, Image, Video, Mic, FileText, Pin, Users } from 'lucide-react';

export default function ChatItem({ conversation, isActive, onClick }) {
  const { user, typingUsers } = useStore();
  const name = getConversationName(conversation, user?.id);
  const avatar = getConversationAvatar(conversation, user?.id);
  const otherUser = getOtherUser(conversation, user?.id);
  const isOnline = otherUser?.is_online;
  const lastMsg = conversation.lastMessage;
  const unread = conversation.unread_count || 0;
  const isTyping = typingUsers[conversation.id]?.length > 0;
  const gradient = getAvatarGradient(conversation.id);

  const getMessagePreview = () => {
    if (!lastMsg) return '';
    if (lastMsg.is_deleted) return '🚫 Message deleted';
    
    const prefix = lastMsg.sender_id === user?.id ? 'You: ' : 
      conversation.type !== 'private' ? `${lastMsg.sender_name}: ` : '';
    
    switch (lastMsg.type) {
      case 'image': return `${prefix}📷 Photo`;
      case 'video': return `${prefix}🎬 Video`;
      case 'audio': case 'voice': return `${prefix}🎤 Voice message`;
      case 'file': return `${prefix}📎 File`;
      case 'poll': return `${prefix}📊 Poll`;
      case 'sticker': return `${prefix}🎨 Sticker`;
      case 'system': return lastMsg.content;
      default: return `${prefix}${truncate(lastMsg.content, 35)}`;
    }
  };

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.015, x: 2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`w-full sidebar-item group relative overflow-hidden ${isActive ? 'sidebar-item-active' : ''}`}
    >
      {isActive && (
        <motion.div 
          layoutId="activeChatBg"
          className="absolute inset-0 bg-primary-600/15 border-l-[3px] border-primary-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
      {/* Avatar */}
      <div className="relative flex-shrink-0 z-10">
        {avatar ? (
          <img src={resolveUrl(avatar)} alt="" className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-sm`}>
            {conversation.type === 'group' ? (
              <Users className="w-5 h-5" />
            ) : (
              getInitials(name)
            )}
          </div>
        )}
        {conversation.type === 'private' && !!isOnline && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-dark-900" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left z-10 pl-2">
        <div className="flex items-center justify-between mb-1">
          <h3 className={`text-[15px] font-bold tracking-tight truncate ${isActive ? 'text-white' : 'text-dark-100 group-hover:text-white transition-colors duration-300'}`}>
            {name}
          </h3>
          <span className={`text-[11px] flex-shrink-0 ml-2 tracking-wide ${unread > 0 ? 'text-primary-400 font-bold' : 'text-dark-500'}`}>
            {lastMsg ? formatTime(lastMsg.created_at) : ''}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {isTyping ? (
              <span className="text-primary-400 text-xs font-medium flex items-center gap-1">
                <span className="type-indicator">
                  <span></span><span></span><span></span>
                </span>
                typing...
              </span>
            ) : (
              <p className={`text-xs truncate ${unread > 0 ? 'text-dark-300 font-medium' : 'text-dark-500'}`}>
                {getMessagePreview()}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
            {conversation.is_pinned ? (
              <Pin className="w-3 h-3 text-dark-500 rotate-45" />
            ) : null}
            {lastMsg?.sender_id === user?.id && !lastMsg?.is_deleted && (
              <CheckCheck className={`w-3.5 h-3.5 ${false ? 'text-blue-400' : 'text-dark-500'}`} />
            )}
            {unread > 0 && (
              <div className="min-w-[20px] h-5 flex items-center justify-center bg-primary-500 text-white text-[10px] font-bold rounded-full px-1.5 shadow-lg shadow-primary-500/30">
                {unread > 99 ? '99+' : unread}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  );
}
