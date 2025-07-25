# Minimal Chat

A minimalist, brutalist chat application with end-to-end encryption support. Built as a lightweight alternative to Slack with a focus on simplicity and security.

## Features

- **Real-time messaging** with WebSocket connections
- **End-to-end encryption** using Web Crypto API (AES-GCM)
- **Workspaces and channels** for organized communication
- **Direct messages** between users
- **Threaded conversations** for focused discussions
- **Quote/reply functionality** for contextual responses
- **Link aggregation** with voting system
- **Image sharing** (workspace setting)
- **Voice calls** using WebRTC
- **Three themes**: light, dark, and brutalist
- **Inbox view** for tracking mentions and replies
- **World view** for discovering content across channels

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express + Socket.io
- **Database**: SQLite with better-sqlite3
- **Authentication**: JWT
- **Encryption**: Web Crypto API (PBKDF2 + AES-GCM)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/minimal-chat.git
cd minimal-chat
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
JWT_SECRET=your-super-secret-jwt-key-change-in-production
PORT=3035
CLIENT_URL=http://localhost:3033
```

4. Start the development servers:
```bash
npm run dev
```

This will start:
- Frontend at http://localhost:3033
- Backend at http://localhost:3035

## Usage

1. **Create an account**: Sign up with a username and password
2. **Create a workspace**: Set up your first workspace
3. **Create channels**: Add channels for different topics
4. **Invite team members**: Share the workspace with others
5. **Enable encryption**: Create encrypted channels for sensitive discussions

### Encrypted Channels

To create an encrypted channel:
1. Click the `+` button next to "Channels"
2. Enter a channel name
3. Check "🔒 enable end-to-end encryption"
4. Choose a strong password (or use the suggested one)
5. Share the password securely with channel members

## Security

- Passwords are never sent to the server
- All encryption/decryption happens client-side
- Uses PBKDF2 with 100,000 iterations for key derivation
- AES-GCM for authenticated encryption
- Each message has a unique salt and IV

## Development

### Project Structure

```
minimal-chat/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── services/    # API and crypto services
│   │   └── stores/      # State management
│   └── index.html
├── server/              # Express backend
│   ├── api/            # REST endpoints
│   ├── db/             # Database setup and migrations
│   └── websocket/      # Socket.io handlers
├── package.json
└── vite.config.js
```

### Available Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run client:dev` - Start only the frontend
- `npm run server:dev` - Start only the backend
- `npm run build` - Build for production
- `npm start` - Run production server

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with React and Vite for fast development
- Uses Socket.io for real-time communication
- Encryption implementation inspired by Signal's approach to E2EE
- Brutalist design philosophy for minimal, functional UI