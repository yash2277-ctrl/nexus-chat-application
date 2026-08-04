// Shared WebRTC call state - module-level variables accessible by both
// CallScreen component and useSocket handlers
let peerConnection = null;
let localStream = null;
let screenStream = null;
let pendingCandidates = [];
let remoteDescSet = false;

export function setPeerConnection(pc) {
  peerConnection = pc;
  remoteDescSet = false;
}

export function getPeerConnection() {
  return peerConnection;
}

export function setLocalStream(stream) {
  localStream = stream;
}

export function getLocalStream() {
  return localStream;
}

export function setScreenStream(stream) {
  screenStream = stream;
}

export function getScreenStream() {
  return screenStream;
}

// ICE candidate buffering - critical for WebRTC reliability
export function addPendingCandidate(candidate) {
  pendingCandidates.push(candidate);
}

export function isRemoteDescSet() {
  return remoteDescSet;
}

export function markRemoteDescSet() {
  remoteDescSet = true;
}

// Flush all buffered ICE candidates to the peer connection
export async function flushPendingCandidates() {
  const pc = peerConnection;
  if (!pc || !remoteDescSet) return;
  
  const candidates = [...pendingCandidates];
  pendingCandidates = [];
  
  for (const candidate of candidates) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('Flushed buffered ICE candidate');
    } catch (err) {
      console.warn('Failed to add buffered ICE candidate:', err);
    }
  }
}

export function cleanupCall() {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;
  }
  if (peerConnection) {
    try { peerConnection.close(); } catch {}
    peerConnection = null;
  }
  pendingCandidates = [];
  remoteDescSet = false;
}
