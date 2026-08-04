import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';
import api from '../../utils/api';
import { formatTime, formatFullDate, formatFileSize, formatDuration, getInitials, getAvatarGradient } from '../../utils/helpers';
import { resolveUrl } from '../../utils/api';
import { 
  Reply, Forward, Copy, Trash2, Edit3, Pin, Star, Bookmark, MoreHorizontal,
  Check, CheckCheck, Download, Play, Pause, FileText, Smile, Image, Volume2
} from 'lucide-react';

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

export default function MessageBubble({ message, isOwn, showAvatar }) {
  const { user, setReplyTo, setEditingMessage, setForwardMessage, activeConversation } = useStore();
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const audioRef = useRef(null);
  const actionsTimeout = useRef(null);

  if (message.type === 'system') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex justify-center my-3"
      >
        <span className="px-3 py-1 rounded-full text-[11px] text-dark-500 bg-dark-800/30 border border-white/5">
          {message.content}
        </span>
      </motion.div>
    );
  }

  const handleReaction = async (emoji) => {
    try {
      await api.reactToMessage(message.id, emoji);
      setShowReactions(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setShowActions(false);
  };

  const handleDelete = async () => {
    try {
      await api.deleteMessage(message.id);
      // Optimistic update
      useStore.getState().removeMessage(message.id);
      setShowActions(false);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handlePin = async () => {
    try {
      await api.pinMessage(message.id);
      setShowActions(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStar = async () => {
    try {
      await api.starMessage(message.id);
      setShowActions(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBookmark = async () => {
    try {
      await api.bookmarkMessage(message.id);
      setShowActions(false);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const gradient = getAvatarGradient(message.sender_id);

  // Render message content based on type
  const renderContent = () => {
    switch (message.type) {
      case 'image':
        return (
          <div className="relative rounded-xl overflow-hidden w-[240px] sm:w-[320px] max-w-full">
            {!imageLoaded && (
              <div className="w-full aspect-video bg-dark-700/50 shimmer-bg rounded-xl" />
            )}
            <img
              src={resolveUrl(message.media_url)}
              alt=""
              className={`max-w-full rounded-xl cursor-pointer transition-opacity ${imageLoaded ? 'opacity-100' : 'opacity-0 absolute'}`}
              onLoad={() => setImageLoaded(true)}
              onClick={() => window.open(resolveUrl(message.media_url), '_blank')}
            />
            {message.content && (
              <p className="mt-2 text-sm whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="relative rounded-xl overflow-hidden w-[240px] sm:w-[320px] max-w-full">
            <video
              src={resolveUrl(message.media_url)}
              controls
              className="max-w-full rounded-xl"
              preload="metadata"
            />
            {message.content && (
              <p className="mt-2 text-sm whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
        );

      case 'voice':
      case 'audio':
        return (
          <div className="flex items-center gap-3 min-w-[200px]">
            <button
              onClick={toggleAudio}
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-primary-500/20 hover:bg-primary-500/30'
              } transition-colors`}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" />
              )}
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-[2px] h-8">
                {Array.from({ length: 30 }, (_, i) => (
                  <div
                    key={i}
                    className="waveform-bar"
                    style={{
                      height: `${Math.random() * 100}%`,
                      opacity: isPlaying ? 1 : 0.5
                    }}
                  />
                ))}
              </div>
              <span className="text-[10px] opacity-60">
                {formatDuration(message.media_duration)}
              </span>
            </div>
            <audio
              ref={audioRef}
              src={resolveUrl(message.media_url)}
              onEnded={() => setIsPlaying(false)}
            />
          </div>
        );

      case 'file':
        return (
          <div className={`flex items-center gap-3 p-3 rounded-xl min-w-[220px] ${
            isOwn ? 'bg-white/10' : 'bg-dark-700/50'
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isOwn ? 'bg-white/20' : 'bg-primary-500/20'
            }`}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{message.content || 'File'}</p>
              <p className="text-[10px] opacity-60">{formatFileSize(message.media_size)}</p>
            </div>
            <a
              href={resolveUrl(message.media_url)}
              download
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        );

      case 'poll':
        return <PollMessage message={message} isOwn={isOwn} />;

      default:
        return (
          <div>
            {/* Reply preview */}
            {message.replyMessage && (
              <div className={`mb-2 pl-3 border-l-2 rounded-r-lg py-1.5 px-2 text-xs ${
                isOwn ? 'border-white/30 bg-white/10' : 'border-primary-500/50 bg-primary-500/10'
              }`}>
                <p className={`font-semibold text-[11px] ${isOwn ? 'text-white/80' : 'text-primary-400'}`}>
                  {message.replyMessage.sender_name}
                </p>
                <p className="opacity-70 truncate">{message.replyMessage.content}</p>
              </div>
            )}

            {message.forwarded_from && (
              <p className="text-[10px] opacity-50 flex items-center gap-1 mb-1">
                <Forward className="w-3 h-3" /> Forwarded
              </p>
            )}

            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {message.content}
            </p>
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-2 mb-1 group ${isOwn ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => {
        clearTimeout(actionsTimeout.current);
        actionsTimeout.current = setTimeout(() => setShowActions(true), 200);
      }}
      onMouseLeave={() => {
        clearTimeout(actionsTimeout.current);
        setShowActions(false);
        setShowReactions(false);
      }}
    >
      {/* Avatar for others */}
      {!isOwn && (
        <div className="w-8 flex-shrink-0 flex flex-col justify-end">
          {showAvatar && (
            message.sender_avatar ? (
              <img src={resolveUrl(message.sender_avatar)} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-[10px] text-white font-bold`}>
                {getInitials(message.sender_name || '')}
              </div>
            )
          )}
        </div>
      )}

      <div className={`relative max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Sender name for groups */}
        {showAvatar && !isOwn && activeConversation?.type === 'group' && (
          <p className="text-[11px] font-semibold text-primary-400 mb-1 ml-1">
            {message.sender_name}
          </p>
        )}

        {/* Floating actions */}
        <AnimatePresence>
          {showActions && !message.is_deleted && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className={`absolute -top-8 ${isOwn ? 'right-0' : 'left-0'} flex items-center gap-0.5 bg-dark-800 rounded-xl border border-white/10 shadow-xl px-1 py-0.5 z-20`}
            >
              <button onClick={() => setShowReactions(!showReactions)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <Smile className="w-3.5 h-3.5 text-dark-400" />
              </button>
              <button onClick={() => { setReplyTo(message); setShowActions(false); }} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <Reply className="w-3.5 h-3.5 text-dark-400" />
              </button>
              <button onClick={() => { setForwardMessage(message); setShowActions(false); }} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <Forward className="w-3.5 h-3.5 text-dark-400" />
              </button>
              {message.type === 'text' && (
                <button onClick={handleCopy} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                  <Copy className="w-3.5 h-3.5 text-dark-400" />
                </button>
              )}
              {isOwn && message.type === 'text' && (
                <button onClick={() => { setEditingMessage(message); setShowActions(false); }} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                  <Edit3 className="w-3.5 h-3.5 text-dark-400" />
                </button>
              )}
              <button onClick={handleBookmark} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <Bookmark className="w-3.5 h-3.5 text-dark-400" />
              </button>
              <button onClick={handlePin} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <Pin className="w-3.5 h-3.5 text-dark-400" />
              </button>
              {isOwn && (
                <button onClick={handleDelete} className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick reactions popup */}
        <AnimatePresence>
          {showReactions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`absolute -top-16 ${isOwn ? 'right-0' : 'left-0'} flex items-center gap-1 bg-dark-800 rounded-2xl border border-white/10 shadow-xl px-2 py-1.5 z-30`}
            >
              {QUICK_REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="text-xl hover:scale-125 transition-transform p-1"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message bubble */}
        <div className={`relative px-3.5 py-2.5 ${
          message.is_deleted
            ? 'bg-dark-800/30 border border-white/5 rounded-2xl italic text-dark-500 text-sm'
            : isOwn ? 'message-bubble-sent' : 'message-bubble-received'
        }`}>
          {renderContent()}

          {/* Meta info */}
          <div className={`flex items-center gap-1.5 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {!!message.is_edited && !message.is_deleted && (
              <span className="text-[9px] opacity-40">edited</span>
            )}
            {!!message.is_pinned ? (
              <Pin className="w-2.5 h-2.5 opacity-40 rotate-45" />
            ) : null}
            <span className="text-[10px] opacity-40">
              {formatTime(message.created_at)}
            </span>
            {isOwn && !message.is_deleted && (
              <CheckCheck className="w-3 h-3 opacity-40" />
            )}
          </div>
        </div>

        {/* Reactions display */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(
              message.reactions.reduce((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                return acc;
              }, {})
            ).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-dark-800/50 border border-white/10 text-xs hover:bg-dark-700/50 transition-colors"
              >
                <span>{emoji}</span>
                <span className="text-[10px] text-dark-400">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Poll message component
function PollMessage({ message, isOwn }) {
  const { user } = useStore();
  const poll = message.poll;

  if (!poll) return <p className="text-sm">{message.content}</p>;

  const totalVotes = poll.options?.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0) || 0;

  const handleVote = async (optionId) => {
    try {
      await api.votePoll(poll.id, optionId);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-w-[250px]">
      <p className="text-sm font-semibold mb-3">📊 {poll.question}</p>
      <div className="space-y-2">
        {poll.options?.map((option) => {
          const votes = option.votes?.length || 0;
          const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const hasVoted = option.votes?.some(v => v.user_id === user?.id);

          return (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              className={`w-full relative rounded-xl p-2.5 text-left text-sm transition-all ${
                hasVoted
                  ? isOwn ? 'bg-white/20 border border-white/30' : 'bg-primary-500/20 border border-primary-500/30'
                  : isOwn ? 'bg-white/10 hover:bg-white/15' : 'bg-dark-700/50 hover:bg-dark-700/70'
              }`}
            >
              <div
                className={`absolute left-0 top-0 h-full rounded-xl ${isOwn ? 'bg-white/10' : 'bg-primary-500/10'}`}
                style={{ width: `${percentage}%` }}
              />
              <div className="relative flex items-center justify-between">
                <span>{option.text}</span>
                <span className="text-xs opacity-60">{percentage}%</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] opacity-50 mt-2">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
    </div>
  );
}
