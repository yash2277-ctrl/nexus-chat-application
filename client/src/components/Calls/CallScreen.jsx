import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store/useStore';
import { getSocket } from '../../hooks/useSocket';
import { BACKEND_URL, resolveUrl } from '../../utils/api';
import {
  setPeerConnection, getPeerConnection,
  setLocalStream, getLocalStream,
  setScreenStream, getScreenStream,
  cleanupCall,
  markRemoteDescSet, flushPendingCandidates
} from '../../utils/callManager';
import { getAvatarGradient, getInitials, formatDuration } from '../../utils/helpers';
import {
  Phone, PhoneOff, Video, VideoOff, Mic, MicOff,
  Monitor, MonitorOff, X, Volume2, VolumeX
} from 'lucide-react';

const DEFAULT_ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Free TURN servers for NAT traversal in production
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
};

// Fetch ICE config from server (allows dynamic TURN credentials)
async function fetchIceServers() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/ice-servers`);
    if (res.ok) {
      const data = await res.json();
      return { iceServers: data.iceServers, iceCandidatePoolSize: 10 };
    }
  } catch (err) {
    console.warn('Failed to fetch ICE servers, using defaults:', err.message);
  }
  return DEFAULT_ICE_SERVERS;
}

export default function CallScreen({ onClose }) {
  const activeCall = useStore(s => s.activeCall);
  const user = useStore(s => s.user);
  const setActiveCall = useStore(s => s.setActiveCall);

  const [callState, setCallState] = useState('initializing');
  const [callError, setCallError] = useState(null);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const callStateRef = useRef('initializing');
  const mountedRef = useRef(true);
  const initDoneRef = useRef(false);
  const iceConfigRef = useRef(DEFAULT_ICE_SERVERS);

  // Derive call info from activeCall (use refs to avoid stale closures)
  const activeCallRef = useRef(activeCall);
  activeCallRef.current = activeCall;

  const isVideo = activeCall?.callType === 'video';
  const isIncoming = activeCall?.type === 'incoming';
  const targetName = isIncoming ? activeCall?.callerName : activeCall?.targetName;
  const targetAvatar = isIncoming ? activeCall?.callerAvatar : activeCall?.targetAvatar;
  const targetId = isIncoming ? activeCall?.callerId : activeCall?.targetUserId;
  const gradient = getAvatarGradient(targetId || 'default');

  const safeSetState = useCallback((state) => {
    if (mountedRef.current) {
      callStateRef.current = state;
      setCallState(state);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      cleanupCall();
    };
  }, []);

  // Use ref for endCall to avoid stale closures in createPC
  const endCallRef = useRef(null);

  // Create peer connection with proper event handlers
  const createPC = useCallback(() => {
    // Clean up any existing PC
    const oldPc = getPeerConnection();
    if (oldPc) { try { oldPc.close(); } catch {} }

    const pc = new RTCPeerConnection(iceConfigRef.current);
    setPeerConnection(pc);

    const call = activeCallRef.current;
    const tgt = call?.type === 'incoming' ? call?.callerId : call?.targetUserId;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        console.log('📞 Sending ICE candidate to', tgt);
        socket?.emit('ice_candidate', {
          targetUserId: tgt,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('📞 Remote track received:', event.track.kind);
      const [remoteStream] = event.streams;
      if (!remoteStream) return;

      // For video calls, show remote video
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      // Also set audio element for voice calls
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('📞 ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        if (callStateRef.current !== 'connected') {
          safeSetState('connected');
          // Start duration timer (only once)
          if (!durationIntervalRef.current) {
            durationIntervalRef.current = setInterval(() => {
              if (mountedRef.current) setDuration(d => d + 1);
            }, 1000);
          }
        }
      }
      if (pc.iceConnectionState === 'failed') {
        console.error('📞 ICE connection failed');
        endCallRef.current?.();
      }
      if (pc.iceConnectionState === 'disconnected') {
        // Give it a few seconds to reconnect
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') {
            endCallRef.current?.();
          }
        }, 5000);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('📞 Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        if (callStateRef.current !== 'connected') {
          safeSetState('connected');
          if (!durationIntervalRef.current) {
            durationIntervalRef.current = setInterval(() => {
              if (mountedRef.current) setDuration(d => d + 1);
            }, 1000);
          }
        }
      }
    };

    return pc;
  }, [safeSetState]);

  // Get media stream
  const getMedia = useCallback(async (video) => {
    // Check if we're in a secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      throw new Error('Calls require a secure connection (HTTPS). Please access the app via HTTPS.');
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Your browser does not support media devices. Please use a modern browser with HTTPS.');
    }

    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    setLocalStream(stream);
    if (localVideoRef.current && video) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  }, []);

  // Initiate outgoing call
  const initiateCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call || call.type === 'incoming') return;

    try {
      safeSetState('ringing');
      // Fetch ICE config (includes TURN servers) from server
      iceConfigRef.current = await fetchIceServers();
      const video = call.callType === 'video';
      const stream = await getMedia(video);
      const pc = createPC();

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: video,
      });
      await pc.setLocalDescription(offer);

      const socket = getSocket();
      socket?.emit('call_initiate', {
        targetUserId: call.targetUserId,
        conversationId: call.conversationId,
        callType: call.callType,
        offer: { type: offer.type, sdp: offer.sdp },
      });

      console.log('Call initiated, offer sent');
    } catch (err) {
      console.error('Failed to initiate call:', err);
      setCallError(err.message || 'Failed to start call');
      safeSetState('ended');
      setTimeout(() => { endCall(); }, 3000);
    }
  }, [createPC, getMedia, safeSetState]);

  // Answer incoming call
  const answerCall = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call?.offer) return;

    try {
      safeSetState('connecting');
      // Fetch ICE config (includes TURN servers) from server
      iceConfigRef.current = await fetchIceServers();
      const video = call.callType === 'video';
      const stream = await getMedia(video);
      const pc = createPC();

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(call.offer));
      // Mark remote description as set and flush any buffered ICE candidates
      markRemoteDescSet();
      await flushPendingCandidates();
      console.log('📞 Remote description set (offer), flushed pending candidates');

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const socket = getSocket();
      socket?.emit('call_answer', {
        targetUserId: call.callerId,
        answer: { type: answer.type, sdp: answer.sdp },
      });

      console.log('📞 Call answered, answer sent');
      // Don't set connected here - let ICE handler do it
    } catch (err) {
      console.error('Failed to answer:', err);
      setCallError(err.message || 'Failed to answer call');
      rejectCall();
    }
  }, [createPC, getMedia, safeSetState]);

  // Reject incoming call
  const rejectCall = useCallback(() => {
    const call = activeCallRef.current;
    const socket = getSocket();
    const tgt = call?.type === 'incoming' ? call?.callerId : call?.targetUserId;
    socket?.emit('call_reject', {
      targetUserId: tgt,
      conversationId: call?.conversationId,
    });
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    cleanupCall();
    safeSetState('ended');
    setTimeout(() => {
      if (mountedRef.current) { setActiveCall(null); onClose?.(); }
    }, 1000);
  }, [safeSetState, setActiveCall, onClose]);

  // End call
  const endCall = useCallback(() => {
    const call = activeCallRef.current;
    const socket = getSocket();
    const tgt = call?.type === 'incoming' ? call?.callerId : call?.targetUserId;
    socket?.emit('call_end', {
      targetUserId: tgt,
      conversationId: call?.conversationId,
    });
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    cleanupCall();
    safeSetState('ended');
    setTimeout(() => {
      if (mountedRef.current) { setActiveCall(null); onClose?.(); }
    }, 1500);
  }, [safeSetState, setActiveCall, onClose]);

  // Keep endCallRef in sync
  endCallRef.current = endCall;

  // Initialize call on mount
  useEffect(() => {
    if (!activeCall) {
      initDoneRef.current = false;
      return;
    }
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    if (activeCall.type === 'incoming') {
      safeSetState('ringing');
    } else {
      initiateCall();
    }
  }, [activeCall, initiateCall, safeSetState]);

  // Toggle mute
  const toggleMute = () => {
    const stream = getLocalStream();
    if (stream) {
      stream.getAudioTracks().forEach(t => { t.enabled = isMuted; });
      setIsMuted(!isMuted);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    const stream = getLocalStream();
    if (stream) {
      stream.getVideoTracks().forEach(t => { t.enabled = isVideoOff; });
      setIsVideoOff(!isVideoOff);
    }
  };

  // Toggle screen share
  const toggleScreenShare = async () => {
    const pc = getPeerConnection();
    if (!pc) return;

    if (isScreenSharing) {
      const ss = getScreenStream();
      if (ss) ss.getTracks().forEach(t => t.stop());
      setScreenStream(null);
      const stream = getLocalStream();
      const videoTrack = stream?.getVideoTracks()[0];
      if (videoTrack) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(videoTrack);
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(screen);
        const screenTrack = screen.getVideoTracks()[0];
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(screenTrack);
        screenTrack.onended = () => toggleScreenShare();
        setIsScreenSharing(true);
      } catch (err) {
        console.error('Screen share failed:', err);
      }
    }
  };

  // Ringtone effect
  useEffect(() => {
    if (callState !== 'ringing') return;
    let audioCtx;
    let ringInterval;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playTone = () => {
        if (!mountedRef.current) return;
        try {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.frequency.value = isIncoming ? 440 : 480;
          gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.8);
        } catch {}
      };
      playTone();
      ringInterval = setInterval(playTone, 2500);
    } catch {}
    return () => {
      if (ringInterval) clearInterval(ringInterval);
      if (audioCtx) audioCtx.close().catch(() => {});
    };
  }, [callState, isIncoming]);

  // Handle external call end (when other side hangs up)
  useEffect(() => {
    if (!activeCall && callState !== 'ended' && callState !== 'initializing') {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      cleanupCall();
      safeSetState('ended');
      setTimeout(() => { onClose?.(); }, 1000);
    }
  }, [activeCall, callState, safeSetState, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-dark-950/95 backdrop-blur-xl flex flex-col items-center justify-center"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute inset-0 bg-gradient-to-b ${gradient} opacity-10`} />
        <div className="absolute inset-0 bg-dark-950/80" />
      </div>

      {/* Hidden audio element for voice calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Video streams */}
      {isVideo && (
        <div className="absolute inset-0 z-0">
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover bg-dark-900" />
          <div className="absolute bottom-32 right-6 w-32 h-44 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 z-10 bg-dark-900">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {isVideoOff && (
              <div className="absolute inset-0 bg-dark-900 flex items-center justify-center">
                <VideoOff className="w-6 h-6 text-dark-500" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Call info */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 gap-6">
        {(!isVideo || callState !== 'connected') && (
          <motion.div
            animate={callState === 'ringing' || callState === 'connecting' ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            className="relative"
          >
            {(callState === 'ringing' || callState === 'connecting') && (
              <>
                <motion.div animate={{ scale: [1, 2.5], opacity: [0.3, 0] }} transition={{ duration: 2, repeat: Infinity }}
                  className={`absolute inset-0 rounded-full bg-gradient-to-br ${gradient} opacity-20`} />
                <motion.div animate={{ scale: [1, 2], opacity: [0.2, 0] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                  className={`absolute inset-0 rounded-full bg-gradient-to-br ${gradient} opacity-20`} />
              </>
            )}
            {targetAvatar ? (
              <img src={resolveUrl(targetAvatar)} alt="" className="w-32 h-32 rounded-full object-cover border-4 border-white/10 shadow-2xl relative z-10" />
            ) : (
              <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-4xl font-bold border-4 border-white/10 shadow-2xl relative z-10`}>
                {getInitials(targetName || 'Unknown')}
              </div>
            )}
          </motion.div>
        )}

        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-1">{targetName || 'Unknown'}</h2>
          <p className="text-sm text-dark-400">
            {callState === 'initializing' && 'Starting...'}
            {callState === 'ringing' && (isIncoming ? 'Incoming call...' : 'Ringing...')}
            {callState === 'connecting' && 'Connecting...'}
            {callState === 'connected' && formatDuration(duration)}
            {callState === 'ended' && !callError && 'Call ended'}
          </p>
          {callError && (
            <p className="text-xs text-red-400 mt-1 bg-red-900/30 rounded px-3 py-1.5 max-w-xs mx-auto">
              {callError}
            </p>
          )}
          <p className="text-xs text-dark-500 mt-1 flex items-center justify-center gap-1.5">
            {isVideo ? <><Video className="w-3 h-3" /> Video Call</> : <><Phone className="w-3 h-3" /> Voice Call</>}
            {isScreenSharing && ' · Screen sharing'}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-10 pb-12">
        {/* Incoming: Answer / Reject */}
        {isIncoming && callState === 'ringing' && (
          <div className="flex items-center gap-12">
            <div className="flex flex-col items-center gap-2">
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={rejectCall}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 text-white">
                <PhoneOff className="w-7 h-7" />
              </motion.button>
              <span className="text-xs text-dark-400">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                onClick={answerCall}
                className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30 text-white">
                {isVideo ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
              </motion.button>
              <span className="text-xs text-dark-400">Accept</span>
            </div>
          </div>
        )}

        {/* Outgoing ringing / connecting / connected */}
        {(callState === 'connected' || callState === 'connecting' || (callState === 'ringing' && !isIncoming)) && (
          <div className="flex items-center gap-4">
            <motion.button whileTap={{ scale: 0.9 }} onClick={toggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-white text-dark-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </motion.button>

            {isVideo && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={toggleVideo}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-white text-dark-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </motion.button>
            )}

            {isVideo && callState === 'connected' && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={toggleScreenShare}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isScreenSharing ? 'bg-primary-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
              </motion.button>
            )}

            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setIsSpeakerOff(!isSpeakerOff)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isSpeakerOff ? 'bg-white text-dark-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>
              {isSpeakerOff ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </motion.button>

            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={endCall}
              className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 text-white ml-2">
              <PhoneOff className="w-6 h-6" />
            </motion.button>
          </div>
        )}

        {callState === 'ended' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <p className="text-dark-400 text-sm mb-4">
              {duration > 0 ? `Call duration: ${formatDuration(duration)}` : 'Call ended'}
            </p>
          </motion.div>
        )}
      </div>

      {/* Close button */}
      <button onClick={() => { cleanupCall(); if (durationIntervalRef.current) clearInterval(durationIntervalRef.current); setActiveCall(null); onClose?.(); }}
        className="absolute top-6 right-6 z-20 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all">
        <X className="w-5 h-5" />
      </button>
    </motion.div>
  );
}
