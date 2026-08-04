# Nexus Chat - Next-Gen Encrypted Messaging Platform

A full-featured end-to-end encrypted messaging application that combines the best of WhatsApp and Telegram with additional unique features.

## Features

### Core Messaging
- End-to-end encrypted messages
- Real-time messaging with WebSocket
- Text, image, video, audio, and file sharing
- Voice messages with waveform visualization
- Message reactions with emoji
- Reply, forward, and pin messages
- Message editing and deletion
- Read receipts and typing indicators
- Message search with filters

### Groups & Channels
- Group chats with admin controls
- Broadcast channels
- Polls and voting
- Shared media gallery

### Calls
- Voice calls (WebRTC)
- Video calls with screen sharing
- Group calls

### Stories/Status
- 24-hour disappearing stories
- Text, image, and video stories
- Story reactions

### Unique Features (Beyond WhatsApp/Telegram)
1. **Smart Message Scheduler** - Schedule messages with timezone awareness and recurring options
2. **Collaborative Notes** - Real-time shared notes within any chat
3. **AI Message Translation** - Instant translation of messages to any language
4. **Message Bookmarks** - Save and categorize important messages with tags

### Security
- End-to-end encryption for all messages
- Disappearing messages with custom timers
- Two-factor authentication
- Session management

## Tech Stack
- **Frontend**: React 18 + Vite + Tailwind CSS + Framer Motion
- **Backend**: Node.js + Express + Socket.IO
- **Database**: SQLite (better-sqlite3)
- **Encryption**: Web Crypto API + AES-256-GCM
- **Calls**: WebRTC

## Getting Started

```bash
# Install all dependencies
npm run install:all

# Run in development mode
npm run dev
```

Server runs on http://localhost:3001
Client runs on http://localhost:5173
