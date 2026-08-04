import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';
import api from '../../utils/api';
import { getAvatarGradient, getInitials } from '../../utils/helpers';
import { resolveUrl } from '../../utils/api';
import { X, Search, Users, Check, Camera, ArrowRight } from 'lucide-react';

export default function CreateGroupModal({ onClose }) {
  const { user, createGroup } = useStore();
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 1) { setSearchResults([]); return; }
      try {
        const results = await api.searchUsers(searchQuery);
        setSearchResults(results.filter(u => u.id !== user?.id));
      } catch (err) { console.error(err); }
    };
    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleUser = (u) => {
    if (selectedUsers.find(s => s.id === u.id)) {
      setSelectedUsers(selectedUsers.filter(s => s.id !== u.id));
    } else {
      setSelectedUsers([...selectedUsers, u]);
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    setLoading(true);
    try {
      await createGroup(groupName, selectedUsers.map(u => u.id), groupDescription);
      onClose();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-dark-800 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col border border-white/5 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {step === 1 ? 'Add Members' : 'Group Details'}
              </h3>
              <p className="text-[10px] text-dark-500">Step {step} of 2</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-3">
          <div className="flex gap-2">
            <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-primary-500' : 'bg-dark-700'}`} />
            <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-primary-500' : 'bg-dark-700'}`} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Selected chips */}
              {selectedUsers.length > 0 && (
                <div className="px-5 pt-3 flex flex-wrap gap-2">
                  {selectedUsers.map(u => (
                    <span
                      key={u.id}
                      onClick={() => toggleUser(u)}
                      className="px-2 py-1 rounded-full bg-primary-500/15 text-primary-300 text-xs flex items-center gap-1 cursor-pointer hover:bg-primary-500/25 transition-colors"
                    >
                      {u.display_name}
                      <X className="w-3 h-3" />
                    </span>
                  ))}
                </div>
              )}

              {/* Search */}
              <div className="px-5 py-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="input-field pl-9"
                    placeholder="Search users..."
                    autoFocus
                  />
                </div>
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto px-2">
                {searchResults.map(u => {
                  const isSelected = selectedUsers.find(s => s.id === u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleUser(u)}
                      className={`w-full px-3 py-2.5 flex items-center gap-3 rounded-xl transition-all ${isSelected ? 'bg-primary-500/10' : 'hover:bg-dark-700/50'}`}
                    >
                      {u.avatar ? (
                        <img src={resolveUrl(u.avatar)} className="w-10 h-10 rounded-full object-cover" alt="" />
                      ) : (
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarGradient(u.id)} flex items-center justify-center text-white text-sm font-bold`}>
                          {getInitials(u.display_name)}
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <p className="text-sm text-white font-medium">{u.display_name}</p>
                        <p className="text-xs text-dark-500">@{u.username}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary-500 border-primary-500' : 'border-dark-600'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
                {searchQuery && searchResults.length === 0 && (
                  <p className="text-center text-dark-500 text-sm py-8">No users found</p>
                )}
                {!searchQuery && (
                  <p className="text-center text-dark-500 text-sm py-8">Search for users to add</p>
                )}
              </div>

              {/* Next button */}
              <div className="px-5 py-4 border-t border-white/5">
                <button
                  onClick={() => setStep(2)}
                  disabled={selectedUsers.length === 0}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 flex flex-col p-5 gap-4"
            >
              {/* Group avatar placeholder */}
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center text-white">
                  <Users className="w-8 h-8" />
                </div>
              </div>

              <div>
                <label className="text-xs text-dark-500 mb-1 block">Group Name *</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="input-field"
                  placeholder="e.g. Project Team"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-dark-500 mb-1 block">Description</label>
                <textarea
                  value={groupDescription}
                  onChange={e => setGroupDescription(e.target.value)}
                  className="input-field resize-none"
                  placeholder="What's this group about?"
                  rows={3}
                />
              </div>

              <div>
                <p className="text-xs text-dark-500 mb-2">
                  {selectedUsers.length} member{selectedUsers.length !== 1 ? 's' : ''} selected
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-dark-700">
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${getAvatarGradient(u.id)} flex items-center justify-center text-white text-[8px] font-bold`}>
                        {getInitials(u.display_name)}
                      </div>
                      <span className="text-xs text-dark-300">{u.display_name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 mt-auto">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">Back</button>
                <button
                  onClick={handleCreate}
                  disabled={!groupName.trim() || loading}
                  className="btn-primary flex-1 disabled:opacity-40"
                >
                  {loading ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
