import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import useStore from '../../store/useStore';
import api from '../../utils/api';
import { BACKEND_URL, resolveUrl } from '../../utils/api';
import { 
  getConversationName, getConversationAvatar, getOtherUser, 
  getAvatarGradient, getInitials, getLastSeen, formatTime,
  formatFullDate
} from '../../utils/helpers';
import { 
  X, Shield, Bell, BellOff, Ban, Flag, Trash2, LogOut,
  Users, Crown, Star, Edit3, Camera, UserPlus, UserMinus,
  ChevronRight, Lock, Info, Image as ImageIcon, FileText,
  Link, Phone, Mail, AtSign, MessageCircle, Check, Save
} from 'lucide-react';

// Own Profile / Settings Panel
function OwnProfilePanel() {
  const { user, setShowProfile, logout } = useStore();
  const [editMode, setEditMode] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || user?.status || '');
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const gradient = getAvatarGradient(user?.id || 'self');

  const handleSave = async () => {
    setSaving(true);
    try {
      let avatarUrl = user?.avatar;
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        const res = await fetch(`${BACKEND_URL}/api/media/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${useStore.getState().token}` },
          body: formData
        });
        const data = await res.json();
        if (data.url) avatarUrl = data.url;
      }
      await api.updateProfile({ displayName, bio, avatar: avatarUrl });
      useStore.getState().setUser({ ...user, display_name: displayName, bio, avatar: avatarUrl });
      setEditMode(false);
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
    setSaving(false);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setAvatarFile(file);
  };

  return (
    <div className="h-full flex flex-col bg-dark-900">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">My Profile</h3>
        <button onClick={() => setShowProfile(false)} className="btn-icon">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile header */}
        <div className="flex flex-col items-center py-8 px-6">
          <div className="relative mb-4 group">
            {user?.avatar || avatarFile ? (
              <img
                src={avatarFile ? URL.createObjectURL(avatarFile) : resolveUrl(user.avatar)}
                alt=""
                className="w-28 h-28 rounded-full object-cover border-4 border-dark-800"
              />
            ) : (
              <div className={`w-28 h-28 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-3xl border-4 border-dark-800`}>
                {getInitials(user?.display_name || 'U')}
              </div>
            )}
            {editMode && (
              <label className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-green-500 rounded-full border-3 border-dark-900" />
          </div>

          {editMode ? (
            <div className="w-full space-y-3">
              <div>
                <label className="text-[10px] text-dark-500 uppercase tracking-wider mb-1 block">Display Name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input-field w-full text-sm text-center"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="text-[10px] text-dark-500 uppercase tracking-wider mb-1 block">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="input-field w-full text-sm text-center resize-none"
                  rows={2}
                  placeholder="Tell people about yourself"
                  maxLength={150}
                />
                <p className="text-[10px] text-dark-600 text-right mt-0.5">{bio.length}/150</p>
              </div>
              <div className="flex gap-2 justify-center pt-1">
                <button onClick={handleSave} disabled={saving}
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => { setEditMode(false); setDisplayName(user?.display_name || ''); setBio(user?.bio || ''); setAvatarFile(null); }}
                  className="px-4 py-2 rounded-lg bg-dark-800 text-dark-300 text-xs hover:bg-dark-700 transition-all">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-1">{user?.display_name || 'User'}</h2>
              <p className="text-xs text-dark-400">@{user?.username || 'unknown'}</p>
              {(user?.bio || user?.status) && (
                <p className="text-sm text-dark-300 mt-2 text-center max-w-[250px]">{user?.bio || user?.status}</p>
              )}
              <button onClick={() => setEditMode(true)}
                className="mt-3 flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 transition-colors">
                <Edit3 className="w-3.5 h-3.5" /> Edit Profile
              </button>
            </>
          )}
        </div>

        {/* Info cards */}
        <div className="mx-4 mb-4 space-y-3">
          {/* Account info */}
          <div className="bg-dark-800/50 rounded-xl border border-white/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
              <AtSign className="w-4 h-4 text-dark-500 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-dark-500 uppercase tracking-wider">Username</p>
                <p className="text-sm text-white">@{user?.username || 'unknown'}</p>
              </div>
            </div>
            {user?.email && (
              <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                <Mail className="w-4 h-4 text-dark-500 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-dark-500 uppercase tracking-wider">Email</p>
                  <p className="text-sm text-white">{user.email}</p>
                </div>
              </div>
            )}
            <div className="px-4 py-3 flex items-center gap-3">
              <Lock className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] text-dark-500 uppercase tracking-wider">Encryption</p>
                <p className="text-xs text-emerald-400">End-to-end encrypted</p>
              </div>
              <Shield className="w-4 h-4 text-emerald-500" />
            </div>
          </div>

          {/* App info */}
          <div className="bg-dark-800/50 rounded-xl border border-white/5 p-4 text-center">
            <div className="text-2xl mb-1">💬</div>
            <p className="text-sm font-bold text-white">Nexus Chat</p>
            <p className="text-[10px] text-dark-500 mt-1">WhatsApp + Telegram combined</p>
          </div>
        </div>
      </div>

      {/* Footer - Logout */}
      <div className="p-4 border-t border-white/5 space-y-2">
        <button
          onClick={() => { logout(); setShowProfile(false); }}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 transition-all text-sm font-medium text-red-400"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  );
}

export default function ProfilePanel() {
  const { activeConversation, user, setShowProfile, onlineUsers, loadConversations } = useStore();
  const [activeTab, setActiveTab] = useState('info');
  const [members, setMembers] = useState([]);
  const [sharedMedia, setSharedMedia] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [editingGroup, setEditingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');

  // Show own profile when no conversation is active
  if (!activeConversation) return <OwnProfilePanel />;

  const isGroup = activeConversation.type === 'group';
  const name = getConversationName(activeConversation, user?.id);
  const avatar = getConversationAvatar(activeConversation, user?.id);
  const otherUser = getOtherUser(activeConversation, user?.id);
  const gradient = getAvatarGradient(activeConversation.id);

  const isAdmin = activeConversation.participants?.find(
    p => p.id === user?.id && (p.role === 'admin' || p.created_by === user?.id)
  );

  useEffect(() => {
    if (isGroup && activeConversation.participants) {
      setMembers(activeConversation.participants);
      setGroupName(activeConversation.name || '');
      setGroupDesc(activeConversation.description || '');
    }
  }, [activeConversation]);

  // Load shared media
  useEffect(() => {
    if (activeConversation) {
      const msgs = useStore.getState().messages
        .filter(m => ['image', 'video', 'file'].includes(m.type) && m.media_url)
        .slice(-20);
      setSharedMedia(msgs);
    }
  }, [activeConversation?.id]);

  const handleSearchUsers = async (q) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const results = await api.searchUsers(q);
      const memberIds = new Set(members.map(m => m.id));
      setSearchResults(results.filter(u => !memberIds.has(u.id)));
    } catch (err) { console.error(err); }
  };

  const handleAddMember = async (userId) => {
    try {
      await api.addGroupMembers(activeConversation.id, [userId]);
      await loadConversations();
      setShowAddMember(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) { console.error(err); }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      await api.removeGroupMember(activeConversation.id, memberId);
      await loadConversations();
    } catch (err) { console.error(err); }
  };

  const handleLeaveGroup = async () => {
    try {
      await api.leaveGroup(activeConversation.id);
      useStore.getState().setActiveConversation(null);
      setShowProfile(false);
      await loadConversations();
    } catch (err) { console.error(err); }
  };

  const handleUpdateGroup = async () => {
    try {
      await api.updateGroup(activeConversation.id, { name: groupName, description: groupDesc });
      useStore.getState().updateConversation(activeConversation.id, { name: groupName, description: groupDesc });
      setEditingGroup(false);
    } catch (err) { console.error(err); }
  };

  const onlineStatus = otherUser ? onlineUsers[otherUser.id] : null;
  const isOnline = otherUser?.is_online || onlineStatus?.isOnline;

  return (
    <div className="h-full flex flex-col bg-dark-900">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">{isGroup ? 'Group Info' : 'Contact Info'}</h3>
        <button onClick={() => setShowProfile(false)} className="btn-icon">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile header */}
        <div className="flex flex-col items-center py-8 px-6">
          <div className="relative mb-4">
            {avatar ? (
              <img src={resolveUrl(avatar)} alt="" className="w-24 h-24 rounded-full object-cover border-4 border-dark-800" />
            ) : (
              <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-2xl border-4 border-dark-800`}>
                {isGroup ? <Users className="w-10 h-10" /> : getInitials(name)}
              </div>
            )}
            {!isGroup && isOnline && (
              <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full border-3 border-dark-900" />
            )}
          </div>

          {editingGroup ? (
            <div className="w-full space-y-2">
              <input value={groupName} onChange={(e) => setGroupName(e.target.value)}
                className="input-field text-center text-sm" placeholder="Group name" />
              <textarea value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)}
                className="input-field text-center text-xs resize-none" rows={2} placeholder="Description" />
              <div className="flex gap-2 justify-center">
                <button onClick={handleUpdateGroup} className="btn-primary text-xs">Save</button>
                <button onClick={() => setEditingGroup(false)} className="btn-icon text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                {name}
                {isGroup && isAdmin && (
                  <button onClick={() => setEditingGroup(true)} className="text-dark-500 hover:text-white">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </h2>
              {!isGroup && otherUser && (
                <p className="text-xs text-dark-400 flex items-center gap-1.5">
                  {isOnline ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> online</>
                  ) : (
                    getLastSeen(otherUser.last_seen || onlineStatus?.lastSeen, false)
                  )}
                </p>
              )}
              {isGroup && (
                <p className="text-xs text-dark-400 mt-0.5">
                  {activeConversation.participants?.length || 0} members
                </p>
              )}
            </>
          )}
        </div>

        {/* Info section for private chats */}
        {!isGroup && otherUser && (
          <div className="mx-4 mb-4 bg-dark-800/50 rounded-xl border border-white/5 overflow-hidden">
            {/* Bio/About */}
            {(otherUser.bio || otherUser.status) && (
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1">About</p>
                <p className="text-sm text-white">{otherUser.bio || otherUser.status || 'Hey there! I am using Nexus Chat'}</p>
              </div>
            )}

            {/* Username */}
            {otherUser.username && (
              <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                <AtSign className="w-4 h-4 text-dark-500 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-dark-500 uppercase tracking-wider">Username</p>
                  <p className="text-sm text-white">@{otherUser.username}</p>
                </div>
              </div>
            )}

            {/* Phone */}
            {otherUser.phone && (
              <div className="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                <Phone className="w-4 h-4 text-dark-500 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-dark-500 uppercase tracking-wider">Phone</p>
                  <p className="text-sm text-white">{otherUser.phone}</p>
                </div>
              </div>
            )}

            {/* E2E encryption */}
            <div className="px-4 py-3 flex items-center gap-3">
              <Lock className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] text-dark-500 uppercase tracking-wider">Encryption</p>
                <p className="text-xs text-emerald-400">End-to-end encrypted</p>
              </div>
              <Shield className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
        )}

        {/* Group description */}
        {isGroup && activeConversation.description && (
          <div className="mx-4 mb-4 bg-dark-800/50 rounded-xl border border-white/5 p-4">
            <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-dark-300">{activeConversation.description}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-white/5 mx-4 mb-3">
          {[
            { id: 'info', label: isGroup ? 'Members' : 'Media' },
            { id: 'media', label: isGroup ? 'Media' : 'Files' },
            { id: 'links', label: 'Links' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 text-xs font-medium transition-all border-b-2 ${
                activeTab === tab.id 
                  ? 'text-primary-400 border-primary-500' 
                  : 'text-dark-500 border-transparent hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-4 pb-4">
          {/* Members tab (group) or Media tab (private) */}
          {activeTab === 'info' && isGroup && (
            <div className="space-y-1">
              {isAdmin && (
                <button
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-dark-800/50 transition-all text-primary-400"
                >
                  <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Add Member</span>
                </button>
              )}

              {showAddMember && (
                <div className="mb-3 space-y-2">
                  <input
                    value={searchQuery}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    placeholder="Search users..."
                    className="input-field w-full text-sm"
                  />
                  {searchResults.map(u => (
                    <button key={u.id} onClick={() => handleAddMember(u.id)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-dark-800/50 transition-all">
                      {u.avatar ? (
                        <img src={resolveUrl(u.avatar)} className="w-8 h-8 rounded-full object-cover" alt="" />
                      ) : (
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarGradient(u.id)} flex items-center justify-center text-white text-xs font-bold`}>
                          {getInitials(u.display_name)}
                        </div>
                      )}
                      <div className="text-left">
                        <p className="text-xs font-medium text-white">{u.display_name}</p>
                        <p className="text-[10px] text-dark-500">@{u.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {(members.length > 0 ? members : activeConversation.participants || []).map(member => (
                <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-dark-800/30 transition-all group">
                  {member.avatar ? (
                    <img src={resolveUrl(member.avatar)} className="w-10 h-10 rounded-full object-cover" alt="" />
                  ) : (
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarGradient(member.id)} flex items-center justify-center text-white text-xs font-bold`}>
                      {getInitials(member.display_name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white flex items-center gap-1.5">
                      {member.display_name}
                      {member.id === user?.id && <span className="text-[10px] text-dark-500">(You)</span>}
                      {member.role === 'admin' && <Crown className="w-3 h-3 text-amber-400" />}
                    </p>
                    <p className="text-[11px] text-dark-500 truncate">
                      {member.bio || member.status || (member.is_online ? 'online' : getLastSeen(member.last_seen, false))}
                    </p>
                  </div>
                  {isAdmin && member.id !== user?.id && (
                    <button onClick={() => handleRemoveMember(member.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-all">
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {((activeTab === 'info' && !isGroup) || (activeTab === 'media')) && (
            <div>
              {sharedMedia.filter(m => m.type === 'image' || m.type === 'video').length > 0 ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {sharedMedia.filter(m => m.type === 'image' || m.type === 'video').map(m => (
                    <div key={m.id} className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(resolveUrl(m.media_url), '_blank')}>
                      {m.type === 'video' ? (
                        <video src={resolveUrl(m.media_url)} className="w-full h-full object-cover" preload="metadata" />
                      ) : (
                        <img src={resolveUrl(m.media_url)} className="w-full h-full object-cover" alt="" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-dark-500">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No shared media yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'links' && (
            <div className="text-center py-8 text-dark-500">
              <Link className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No shared links yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-white/5 space-y-2">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-dark-800/50 transition-all text-sm text-dark-300"
        >
          {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {isMuted ? 'Unmute' : 'Mute'} Notifications
        </button>

        {isGroup ? (
          <button
            onClick={handleLeaveGroup}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-red-500/10 transition-all text-sm text-red-400"
          >
            <LogOut className="w-4 h-4" /> Leave Group
          </button>
        ) : (
          <button
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-red-500/10 transition-all text-sm text-red-400"
          >
            <Ban className="w-4 h-4" /> Block User
          </button>
        )}
      </div>
    </div>
  );
}
