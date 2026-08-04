import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';
import api from '../../utils/api';
import { getSocket } from '../../hooks/useSocket';
import { debounce } from '../../utils/helpers';
import {
  Send, Paperclip, Smile, Mic, Image, Video, FileText, X,
  Camera, Clock, StopCircle, Reply, Edit3, Globe, Sparkles
} from 'lucide-react';

const EMOJI_LIST = ['😀','😂','🤣','❤️','😍','🤩','😎','🙌','👍','👎','🙏','🎉','🔥','💯','✨','😭','😱','🤔','😏','🥳','😇','🤗','😴','💪','👀','🤝','💕','🌟','⭐','💫'];

export default function MessageInput() {
  const { activeConversation, user, replyTo, editingMessage, setReplyTo, setEditingMessage } = useStore();
  const [message, setMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingInterval = useRef(null);
  const recordingTimeRef = useRef(0);
  const audioChunks = useRef([]);

  // Focus input on conversation change
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeConversation?.id]);

  // Handle editing message
  useEffect(() => {
    if (editingMessage) {
      setMessage(editingMessage.content);
      inputRef.current?.focus();
    }
  }, [editingMessage]);

  // Typing indicator
  const emitTypingStart = useCallback(
    debounce(() => {
      const socket = getSocket();
      if (socket && activeConversation) {
        socket.emit('typing_start', { conversationId: activeConversation.id });
      }
    }, 300),
    [activeConversation?.id]
  );

  const emitTypingStop = useCallback(
    debounce(() => {
      const socket = getSocket();
      if (socket && activeConversation) {
        socket.emit('typing_stop', { conversationId: activeConversation.id });
      }
    }, 1000),
    [activeConversation?.id]
  );

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    emitTypingStart();
    emitTypingStop();
  };

  const handleSend = async () => {
    if (!message.trim() && !uploading) return;
    if (!activeConversation) return;

    const content = message.trim();
    setMessage('');
    setShowEmoji(false);

    // Stop typing
    const socket = getSocket();
    if (socket) {
      socket.emit('typing_stop', { conversationId: activeConversation.id });
    }

    try {
      if (editingMessage) {
        await api.editMessage(editingMessage.id, content);
        setEditingMessage(null);
      } else if (showScheduler && scheduleDate) {
        await api.scheduleMessage({
          conversationId: activeConversation.id,
          content,
          scheduledAt: new Date(scheduleDate).getTime()
        });
        setShowScheduler(false);
        setScheduleDate('');
      } else {
        await api.sendMessage(activeConversation.id, {
          content,
          type: 'text',
          replyTo: replyTo?.id || null
        });
        setReplyTo(null);
      }
    } catch (err) {
      console.error('Failed to send:', err);
      setMessage(content);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      if (replyTo) setReplyTo(null);
      if (editingMessage) { setEditingMessage(null); setMessage(''); }
    }
  };

  // File upload handlers
  const handleFileSelect = async (e, type = 'file') => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setShowAttachMenu(false);

    try {
      for (const file of files) {
        const result = await api.uploadFile(file);
        
        let msgType = type;
        if (file.type.startsWith('image/')) msgType = 'image';
        else if (file.type.startsWith('video/')) msgType = 'video';
        else if (file.type.startsWith('audio/')) msgType = 'audio';

        await api.sendMessage(activeConversation.id, {
          content: file.name,
          type: msgType,
          mediaUrl: result.url,
          mediaSize: file.size,
          replyTo: replyTo?.id || null
        });
      }
      setReplyTo(null);
    } catch (err) {
      console.error('Upload failed:', err);
    }

    setUploading(false);
    e.target.value = '';
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunks.current = [];
      recordingTimeRef.current = 0;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        if (audioBlob.size === 0) return;

        const convId = useStore.getState().activeConversation?.id;
        if (!convId) return;

        try {
          // Upload as file instead of base64 for better reliability
          const file = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
          const result = await api.uploadFile(file);
          await api.sendMessage(convId, {
            content: 'Voice message',
            type: 'voice',
            mediaUrl: result.url,
            mediaSize: result.size || audioBlob.size,
            mediaDuration: recordingTimeRef.current
          });
        } catch (err) {
          console.error('Voice upload failed:', err);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);

      recordingInterval.current = setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime(recordingTimeRef.current);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(recordingInterval.current);
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      clearInterval(recordingInterval.current);
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  if (!activeConversation) return null;

  return (
    <div className="relative z-10 flex-shrink-0">
      {/* Reply preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 md:px-8 py-2 bg-dark-900/50 border-t border-white/5 flex items-center gap-3">
              <div className="w-1 h-10 rounded-full bg-primary-500" />
              <Reply className="w-4 h-4 text-primary-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary-400">{replyTo.sender_name}</p>
                <p className="text-xs text-dark-400 truncate">{replyTo.content}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="flex-shrink-0 text-dark-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {editingMessage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 md:px-8 py-2 bg-dark-900/50 border-t border-white/5 flex items-center gap-3">
              <div className="w-1 h-10 rounded-full bg-amber-500" />
              <Edit3 className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-400">Editing message</p>
                <p className="text-xs text-dark-400 truncate">{editingMessage.content}</p>
              </div>
              <button onClick={() => { setEditingMessage(null); setMessage(''); }} className="flex-shrink-0 text-dark-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scheduler */}
      <AnimatePresence>
        {showScheduler && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 md:px-8 py-2 bg-dark-900/50 border-t border-white/5 flex items-center gap-3">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-blue-400 font-medium">Schedule message:</span>
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="bg-dark-800 border border-white/10 rounded-lg px-3 py-1 text-xs text-white"
              />
              <button onClick={() => { setShowScheduler(false); setScheduleDate(''); }} className="text-dark-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="px-4 md:px-8 py-3 bg-dark-900/80 backdrop-blur-xl border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          {isRecording ? (
            // Recording UI
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-4"
            >
              <button onClick={cancelRecording} className="btn-icon text-red-400">
                <X className="w-5 h-5" />
              </button>
              <div className="flex-1 flex items-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-3 h-3 rounded-full bg-red-500"
                />
                <span className="text-sm text-white font-mono">
                  {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                </span>
                <div className="flex-1 flex items-center gap-[2px] h-8">
                  {Array.from({ length: 40 }, (_, i) => (
                    <motion.div
                      key={i}
                      className="w-[3px] rounded-full bg-red-400"
                      animate={{ height: [`${Math.random() * 30 + 10}%`, `${Math.random() * 100}%`] }}
                      transition={{ duration: 0.3, repeat: Infinity, repeatType: 'reverse', delay: i * 0.02 }}
                    />
                  ))}
                </div>
              </div>
              <button onClick={stopRecording} className="btn-primary !py-2.5 !px-5 !rounded-full flex items-center gap-2">
                <StopCircle className="w-4 h-4" />
                Send
              </button>
            </motion.div>
          ) : (
            // Normal input
            <div className="flex items-end gap-2">
              {/* Attachment button */}
              <div className="relative flex-shrink-0">
                <button onClick={() => setShowAttachMenu(!showAttachMenu)} className="btn-icon">
                  <Paperclip className="w-5 h-5" />
                </button>

                <AnimatePresence>
                  {showAttachMenu && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowAttachMenu(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full left-0 mb-2 w-48 bg-dark-800 rounded-xl border border-white/10 shadow-2xl z-40 overflow-hidden"
                      >
                        <button onClick={() => imageInputRef.current?.click()}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-white text-sm">
                          <Image className="w-4 h-4 text-blue-400" /> Photo
                        </button>
                        <button onClick={() => videoInputRef.current?.click()}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-white text-sm">
                          <Video className="w-4 h-4 text-purple-400" /> Video
                        </button>
                        <button onClick={() => fileInputRef.current?.click()}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-white text-sm">
                          <FileText className="w-4 h-4 text-emerald-400" /> Document
                        </button>
                        <button onClick={() => { setShowScheduler(true); setShowAttachMenu(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-white text-sm">
                          <Clock className="w-4 h-4 text-amber-400" /> Schedule Message
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Text input */}
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={message}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={editingMessage ? 'Edit your message...' : 'Type a message...'}
                  rows={1}
                  className="w-full bg-dark-800/50 border border-white/10 rounded-2xl pl-4 pr-12 py-3 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-primary-500/30 resize-none max-h-32 transition-all"
                  style={{ minHeight: '44px' }}
                  onInput={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                  }}
                />

                {/* Emoji button inside input */}
                <button
                  onClick={() => setShowEmoji(!showEmoji)}
                  className="absolute right-3 bottom-2.5 text-dark-500 hover:text-white transition-colors"
                >
                  <Smile className="w-5 h-5" />
                </button>

                {/* Emoji picker */}
                <AnimatePresence>
                  {showEmoji && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowEmoji(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full right-0 mb-2 bg-dark-800 rounded-2xl border border-white/10 shadow-2xl z-40 p-3 w-72"
                      >
                        <div className="grid grid-cols-8 gap-1">
                          {EMOJI_LIST.map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                setMessage(prev => prev + emoji);
                                inputRef.current?.focus();
                              }}
                              className="text-xl hover:bg-white/10 rounded-lg p-1.5 transition-colors hover:scale-110"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Send / Voice button */}
              <div className="flex-shrink-0">
                {message.trim() || editingMessage ? (
                  <motion.button
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    onClick={handleSend}
                    disabled={uploading}
                    className="w-11 h-11 rounded-full bg-gradient-to-r from-primary-600 to-primary-500 flex items-center justify-center text-white shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all active:scale-95"
                  >
                    {uploading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                    ) : (
                      <Send className="w-4.5 h-4.5 ml-0.5" />
                    )}
                  </motion.button>
                ) : (
                  <motion.button
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    onClick={startRecording}
                    className="w-11 h-11 rounded-full bg-dark-800/50 border border-white/10 flex items-center justify-center text-dark-400 hover:text-white hover:border-white/20 transition-all active:scale-95"
                  >
                    <Mic className="w-5 h-5" />
                  </motion.button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" className="hidden" multiple onChange={(e) => handleFileSelect(e, 'file')} />
      <input ref={imageInputRef} type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleFileSelect(e, 'image')} />
      <input ref={videoInputRef} type="file" className="hidden" accept="video/*" onChange={(e) => handleFileSelect(e, 'video')} />
    </div>
  );
}
