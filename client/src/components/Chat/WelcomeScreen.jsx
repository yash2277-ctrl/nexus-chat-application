import { motion } from 'framer-motion';
import { MessageCircle, Shield, Sparkles, Clock, BookmarkPlus, Languages } from 'lucide-react';

export default function WelcomeScreen() {
  const features = [
    { icon: Shield, label: 'End-to-End Encrypted', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { icon: Clock, label: 'Smart Scheduler', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { icon: BookmarkPlus, label: 'Message Bookmarks', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { icon: Languages, label: 'AI Translation', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center bg-dark-950 px-8 relative overflow-hidden">
      {/* Dynamic Animated Background effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3], rotate: [0, 90, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          className="absolute -top-1/4 -left-1/4 w-[50rem] h-[50rem] bg-primary-600/10 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.4, 0.2], x: [0, 100, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-1/4 -right-1/4 w-[60rem] h-[60rem] bg-purple-600/10 rounded-full blur-[100px]" 
        />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-50 mix-blend-overlay"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, type: 'spring', bounce: 0.4 }}
        className="text-center relative z-10 w-full max-w-2xl px-6 py-12 rounded-[3rem] bg-white/[0.02] border border-white/[0.05] backdrop-blur-3xl shadow-2xl"
      >
        <motion.div
          className="w-28 h-28 mx-auto mb-10 rounded-[2rem] bg-gradient-to-br from-primary-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-[0_0_80px_-15px_rgba(168,85,247,0.5)] relative group cursor-pointer"
          whileHover={{ scale: 1.05, rotate: 5 }}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="absolute inset-0 rounded-[2rem] bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          <MessageCircle className="w-14 h-14 text-white drop-shadow-md" />
        </motion.div>

        <h2 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-dark-300 mb-4 tracking-tight">Nexus Chat</h2>
        <p className="text-dark-400 text-lg mb-12 max-w-md mx-auto leading-relaxed">
          Select a conversation to start messaging, or search for someone new to connect with.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + idx * 0.1, type: 'spring', stiffness: 200 }}
              whileHover={{ scale: 1.05, y: -5 }}
              className={`${feature.bg} bg-opacity-50 border border-white/10 rounded-2xl p-5 flex flex-col items-center gap-3 backdrop-blur-md hover:shadow-lg transition-all cursor-pointer group`}
            >
              <div className={`p-3 rounded-xl bg-white/5 group-hover:scale-110 transition-transform ${feature.color}`}>
                <feature.icon className="w-6 h-6" />
              </div>
              <span className="text-xs text-dark-200 font-semibold text-center leading-tight">{feature.label}</span>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-dark-500 text-sm mt-12 flex items-center justify-center gap-2 font-medium tracking-wide pb-2"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          Your messages are end-to-end encrypted
        </motion.p>
      </motion.div>
    </div>
  );
}
