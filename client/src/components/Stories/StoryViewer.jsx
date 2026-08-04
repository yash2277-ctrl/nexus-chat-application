import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';
import api from '../../utils/api';
import { getAvatarGradient, getInitials, formatTime } from '../../utils/helpers';
import { resolveUrl } from '../../utils/api';
import { X, ChevronLeft, ChevronRight, Plus, Image, Send, Eye, Trash2 } from 'lucide-react';

export default function StoryViewer({ onClose }) {
  const { user, stories, fetchStories } = useStore();
  const [viewMode, setViewMode] = useState('list');
  const [currentUserIdx, setCurrentUserIdx] = useState(0);
  const [currentStoryIdx, setCurrentStoryIdx] = useState(0);
  const [creating, setCreating] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [storyFile, setStoryFile] = useState(null);
  const [storyPreview, setStoryPreview] = useState(null);
  const [bgColor, setBgColor] = useState('#6366f1');
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);
  const progressRef = useRef(0);
  const currentUserIdxRef = useRef(0);
  const currentStoryIdxRef = useRef(0);

  const BG_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];

  useEffect(() => { fetchStories(); }, []);

  const storyUsers = stories || [];

  useEffect(() => {
    currentUserIdxRef.current = currentUserIdx;
    currentStoryIdxRef.current = currentStoryIdx;
  }, [currentUserIdx, currentStoryIdx]);

  const goToNext = useCallback(() => {
    const users = useStore.getState().stories || [];
    const uIdx = currentUserIdxRef.current;
    const sIdx = currentStoryIdxRef.current;
    const curU = users[uIdx];
    if (timerRef.current) clearInterval(timerRef.current);
    if (curU && sIdx < curU.stories.length - 1) {
      setCurrentStoryIdx(sIdx + 1);
    } else if (uIdx < users.length - 1) {
      setCurrentUserIdx(uIdx + 1);
      setCurrentStoryIdx(0);
    } else {
      setViewMode('list');
    }
  }, []);

  const goToPrev = useCallback(() => {
    const users = useStore.getState().stories || [];
    const uIdx = currentUserIdxRef.current;
    const sIdx = currentStoryIdxRef.current;
    if (timerRef.current) clearInterval(timerRef.current);
    if (sIdx > 0) {
      setCurrentStoryIdx(sIdx - 1);
    } else if (uIdx > 0) {
      const prevUser = users[uIdx - 1];
      setCurrentUserIdx(uIdx - 1);
      setCurrentStoryIdx((prevUser?.stories?.length || 1) - 1);
    }
  }, []);

  useEffect(() => {
    if (viewMode !== 'view' || isPaused) return;
    const currentUser = storyUsers[currentUserIdx];
    const currentStory = currentUser?.stories?.[currentStoryIdx];
    if (!currentStory) return;
    api.viewStory(currentStory.id).catch(() => {});
    progressRef.current = 0;
    setProgress(0);
    const duration = 6000;
    const interval = 50;
    timerRef.current = setInterval(() => {
      progressRef.current += interval;
      setProgress((progressRef.current / duration) * 100);
      if (progressRef.current >= duration) goToNext();
    }, interval);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [viewMode, currentUserIdx, currentStoryIdx, isPaused]);

  const viewUserStories = (idx) => {
    setCurrentUserIdx(idx);
    setCurrentStoryIdx(0);
    setViewMode('view');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStoryFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setStoryPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleCreateStory = async () => {
    if (!storyText.trim() && !storyFile) return;
    try {
      let mediaUrl = null;
      let mediaType = 'text';
      if (storyFile) {
        const result = await api.uploadFile(storyFile);
        mediaUrl = result.url;
        mediaType = storyFile.type.startsWith('video') ? 'video' : 'image';
      }
      await api.createStory({ content: storyText, mediaUrl, type: mediaType, backgroundColor: bgColor });
      await fetchStories();
      setCreating(false);
      setStoryText('');
      setStoryFile(null);
      setStoryPreview(null);
    } catch (err) { console.error(err); }
  };

  const handleDeleteStory = async (storyId) => {
    try {
      await api.deleteStory(storyId);
      await fetchStories();
      setViewMode('list');
    } catch (err) { console.error(err); }
  };

  const handleReact = async (emoji) => {
    const cu = storyUsers[currentUserIdx];
    const cs = cu?.stories?.[currentStoryIdx];
    if (!cs) return;
    try { await api.reactToStory(cs.id, emoji); } catch (err) { console.error(err); }
  };

  const currentUser = storyUsers[currentUserIdx];
  const currentStory = currentUser?.stories?.[currentStoryIdx];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="relative w-full max-w-lg h-[90vh] max-h-[750px] flex flex-col" onClick={(e) => e.stopPropagation()}>

        <AnimatePresence mode="wait">
          {viewMode === 'list' && !creating && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-dark-800 rounded-2xl w-full h-full flex flex-col border border-white/5 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Stories</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCreating(true)} className="btn-primary text-xs flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> New Story
                  </button>
                  <button onClick={onClose} className="btn-icon"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {storyUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-dark-500 gap-3">
                    <div className="w-16 h-16 rounded-full bg-dark-700 flex items-center justify-center">
                      <Image className="w-7 h-7" />
                    </div>
                    <p className="text-sm">No stories yet</p>
                    <button onClick={() => setCreating(true)} className="btn-primary text-xs">Share your first story</button>
                  </div>
                ) : (
                  storyUsers.map((su, idx) => (
                    <button key={su.userId} onClick={() => viewUserStories(idx)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-dark-700/50 transition-all">
                      <div className={`relative p-0.5 rounded-full ${su.hasUnviewed ? 'bg-gradient-to-tr from-primary-500 to-pink-500' : 'bg-dark-600'}`}>
                        <div className="bg-dark-800 rounded-full p-0.5">
                          {su.avatar ? (
                            <img src={resolveUrl(su.avatar)} className="w-12 h-12 rounded-full object-cover" alt="" />
                          ) : (
                            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarGradient(su.userId)} flex items-center justify-center text-white text-sm font-bold`}>
                              {getInitials(su.displayName)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold text-white">{su.userId === user?.id ? 'My Story' : su.displayName}</p>
                        <p className="text-xs text-dark-500">{su.stories?.length} {su.stories?.length === 1 ? 'story' : 'stories'} · {formatTime(su.stories?.[su.stories.length - 1]?.created_at)}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-dark-500" />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {creating && (
            <motion.div key="create" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}
              className="bg-dark-800 rounded-2xl w-full h-full flex flex-col border border-white/5 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
                <button onClick={() => { setCreating(false); setStoryPreview(null); setStoryFile(null); }} className="btn-icon"><ChevronLeft className="w-4 h-4" /></button>
                <h3 className="text-sm font-semibold text-white">Create Story</h3>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
                {storyPreview ? (
                  <div className="w-full max-w-xs aspect-[9/16] rounded-2xl overflow-hidden relative">
                    <img src={storyPreview} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => { setStoryFile(null); setStoryPreview(null); }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-full max-w-xs aspect-[9/16] rounded-2xl overflow-hidden relative flex flex-col items-center justify-center cursor-pointer"
                    style={{ backgroundColor: bgColor }} onClick={() => !storyText && fileInputRef.current?.click()}>
                    {storyText ? (
                      <p className="text-xl font-bold text-white text-center px-6 drop-shadow-lg">{storyText}</p>
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-white/60">
                        <Image className="w-10 h-10" />
                        <p className="text-sm">Tap to add photo/video</p>
                      </div>
                    )}
                  </div>
                )}
                {!storyPreview && (
                  <div className="flex gap-2">
                    {BG_COLORS.map(c => (
                      <button key={c} onClick={() => setBgColor(c)}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${bgColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
                <div className="w-full max-w-xs">
                  <textarea value={storyText} onChange={(e) => setStoryText(e.target.value)}
                    placeholder={storyPreview ? "Add a caption..." : "Type your story text..."} className="input-field resize-none w-full" rows={2} />
                </div>
              </div>
              <div className="px-5 py-4 border-t border-white/5">
                <button onClick={handleCreateStory} disabled={!storyText.trim() && !storyFile}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40">
                  <Send className="w-4 h-4" /> Share Story
                </button>
              </div>
            </motion.div>
          )}

          {viewMode === 'view' && currentStory && (
            <motion.div key={`view-${currentUserIdx}-${currentStoryIdx}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="w-full h-full flex flex-col rounded-2xl overflow-hidden relative bg-black"
              onMouseDown={() => setIsPaused(true)} onMouseUp={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)} onTouchEnd={() => setIsPaused(false)}>
              <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
                {currentUser?.stories?.map((s, i) => (
                  <div key={s.id} className="flex-1 h-0.5 rounded-full bg-white/20 overflow-hidden">
                    <div className="h-full bg-white rounded-full transition-all duration-75"
                      style={{ width: i < currentStoryIdx ? '100%' : i === currentStoryIdx ? `${progress}%` : '0%' }} />
                  </div>
                ))}
              </div>
              <div className="absolute top-5 left-0 right-0 z-20 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {currentUser?.avatar ? (
                    <img src={resolveUrl(currentUser.avatar)} className="w-9 h-9 rounded-full object-cover border-2 border-white/30" alt="" />
                  ) : (
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarGradient(currentUser?.userId)} flex items-center justify-center text-white text-xs font-bold border-2 border-white/30`}>
                      {getInitials(currentUser?.displayName)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white drop-shadow-lg">{currentUser?.userId === user?.id ? 'My Story' : currentUser?.displayName}</p>
                    <p className="text-[10px] text-white/70 drop-shadow">{formatTime(currentStory?.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {currentUser?.userId === user?.id && (
                    <button onClick={() => handleDeleteStory(currentStory.id)} className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center">
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  )}
                  <button onClick={() => setViewMode('list')} className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center">
                {currentStory?.media_url ? (
                  currentStory.media_type === 'video' ? (
                    <video src={resolveUrl(currentStory.media_url)} className="w-full h-full object-contain" autoPlay muted />
                  ) : (
                    <img src={resolveUrl(currentStory.media_url)} className="w-full h-full object-contain" alt="" />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-8" style={{ background: currentStory?.background_color || '#6366f1' }}>
                    <p className="text-2xl font-bold text-white text-center drop-shadow-lg leading-relaxed">{currentStory?.content}</p>
                  </div>
                )}
                {currentStory?.content && currentStory?.media_url && (
                  <div className="absolute bottom-24 left-0 right-0 px-6">
                    <p className="text-white text-center text-sm drop-shadow-lg bg-black/40 backdrop-blur-sm rounded-xl px-4 py-2">{currentStory.content}</p>
                  </div>
                )}
              </div>
              <div className="absolute inset-0 flex z-10">
                <button onClick={goToPrev} className="w-1/3 h-full" />
                <div className="w-1/3" />
                <button onClick={goToNext} className="w-1/3 h-full" />
              </div>
              {currentUser?.userId === user?.id && (
                <div className="absolute bottom-20 left-0 right-0 z-20 flex justify-center">
                  <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
                    <Eye className="w-3.5 h-3.5 text-white/70" />
                    <span className="text-xs text-white/70">{currentStory?.views_count || 0} views</span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-2">
                {['❤️', '😂', '😮', '😢', '🔥', '👏'].map(emoji => (
                  <button key={emoji} onClick={() => handleReact(emoji)}
                    className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-lg hover:scale-125 transition-transform active:scale-95">
                    {emoji}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
