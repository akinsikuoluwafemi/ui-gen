# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components via chat, and the AI generates React code that renders in real-time in a sandboxed preview iframe. The system uses a virtual file system (no disk writes) and persists projects to a SQLite database for authenticated users.

## Common Commands

### Development

```bash
# Start dev server with Turbopack
npm run dev

# Start dev server as background daemon (logs to logs.txt)
npm run dev:daemon

# Build for production
npm run build

# Run production build
npm start

# Lint code
npm run lint
```

### Testing

```bash
# Run all tests with Vitest
npm test

# Run tests for a specific file
npm test -- src/lib/__tests__/file-system.test.ts
```

### Database

```bash
# Install dependencies and setup database (run once)
npm run setup

# Reset database to fresh state
npm run db:reset

# Generate Prisma client (after schema changes)
npx prisma generate

# Create migration after schema changes
npx prisma migrate dev
```

## Architecture

### Core System Flow

1. **User Input** → Chat interface sends messages to `/api/chat` route
2. **AI Processing** → Vercel AI SDK streams responses from Claude, executing file tools
3. **Virtual File System** → All file operations happen in memory via `VirtualFileSystem` class
4. **Preview Generation** → Files are transformed to ES modules using Babel, served via blob URLs in an iframe with import maps
5. **Persistence** → Projects saved to SQLite with serialized file system state and messages

### Virtual File System

The `VirtualFileSystem` class (src/lib/file-system.ts) is the foundation:

- In-memory file tree using Maps
- Supports standard operations: create, read, update, delete, rename
- Serializes to JSON for database storage and API transport
- Deserializes on load to reconstruct file tree

Two AI tools interact with the file system:

- `str_replace_editor` (src/lib/tools/str-replace.ts) - view, create, edit files via string replacement
- `file_manager` (src/lib/tools/file-manager.ts) - rename and delete files/folders

### Context Providers

Two key React contexts coordinate the application:

**FileSystemContext** (src/lib/contexts/file-system-context.tsx):

- Wraps the VirtualFileSystem with React state
- Tracks selected file for editor
- Handles tool calls from AI (creates/updates trigger React re-renders)
- Provides refresh trigger to notify components of changes

**ChatContext** (src/lib/contexts/chat-context.tsx):

- Wraps Vercel AI SDK's `useChat` hook
- Forwards tool calls to FileSystemContext
- Serializes file system state in API body
- Tracks anonymous user work for session persistence

### Preview System

The preview pipeline (src/lib/transform/jsx-transformer.ts) transforms virtual files into runnable code:

1. **Transform Phase**: Each `.jsx/.tsx` file is transformed via Babel to standard JavaScript
2. **Import Resolution**: Creates import map with:
   - React/React-DOM from esm.sh CDN
   - Local files as blob URLs
   - `@/` alias support (maps to root directory)
   - Third-party packages from esm.sh
3. **CSS Handling**: Extracts CSS imports, injects as `<style>` tags
4. **Error Tracking**: Captures and displays syntax errors per file
5. **HTML Generation**: Creates complete HTML document with import map, styles, and React bootstrap code

The `PreviewFrame` component (src/components/preview/PreviewFrame.tsx) watches for file system changes via `refreshTrigger` and regenerates the preview HTML.

### Database Schema

SQLite database with Prisma ORM (prisma/schema.prisma):

- **User**: email, hashed password (bcrypt)
- **Project**: name, userId (nullable for anonymous), messages (JSON), data (JSON serialized file system)

Anonymous users can work without accounts. If they sign up, they can create/save projects. The `anon-work-tracker` (src/lib/anon-work-tracker.ts) saves anonymous work to localStorage for potential account conversion.

### Authentication

JWT-based auth (src/lib/auth.ts):

- Sessions stored in httpOnly cookies
- 7-day expiration
- Middleware (src/middleware.ts) validates auth for protected routes
- `getSession()` retrieves current user server-side

## File Structure

```text
src/
├── app/                      # Next.js App Router pages
│   ├── api/chat/route.ts    # Streaming chat endpoint with AI tools
│   ├── [projectId]/page.tsx # Individual project page
│   └── page.tsx             # Home page
├── components/
│   ├── chat/                # Chat UI components
│   ├── editor/              # Code editor and file tree
│   ├── preview/             # Preview iframe component
│   └── auth/                # Sign in/up forms
├── lib/
│   ├── contexts/            # React context providers (FileSystem, Chat)
│   ├── transform/           # JSX→ES modules transformation
│   ├── tools/               # AI tool definitions
│   ├── prompts/             # System prompts for AI
│   ├── file-system.ts       # Virtual file system implementation
│   ├── auth.ts              # JWT session management
│   ├── provider.ts          # AI model provider configuration
│   └── prisma.ts            # Prisma client singleton
├── actions/                 # Server actions for projects
└── hooks/                   # Custom React hooks

prisma/
├── schema.prisma            # Database schema
└── dev.db                   # SQLite database file
```

## AI System Prompt

The generation prompt (src/lib/prompts/generation.tsx) instructs Claude to:

- Create React components styled with Tailwind CSS
- Always create `/App.jsx` as entry point
- Use `@/` import alias for local files
- Keep responses brief, avoid summaries
- Never create HTML files (React only)

## Key Implementation Details

### Import Alias Resolution

The `@/` alias maps to the root directory. The import map transformer creates multiple aliases:

- `/components/Button.jsx` → accessible as `@/components/Button`, `/components/Button`, `components/Button`
- Extensions optional in imports (`.jsx`, `.tsx`, `.js`, `.ts` automatically resolved)

### Tool Call Flow

When AI executes a tool:

1. Vercel AI SDK calls tool function on backend
2. Tool modifies VirtualFileSystem
3. `onToolCall` callback in ChatContext receives tool call
4. FileSystemContext's `handleToolCall` updates React state
5. Component re-renders triggered by refreshTrigger change
6. Preview automatically regenerates on next refresh

### Preview Sandboxing

The iframe uses strict sandboxing but requires `allow-scripts allow-same-origin` for blob URL imports. This is safe because:

- Blob URLs are same-origin with the iframe's srcdoc
- No external scripts except Tailwind CDN
- User code runs in isolated iframe context

### Mock Provider Mode

When `ANTHROPIC_API_KEY` is not set, the system uses a mock provider that returns static code instead of calling Claude API (see src/lib/provider.ts). Useful for testing without API costs.

## Testing Notes

- Tests use Vitest with jsdom environment
- File system tests validate in-memory operations
- Component tests use React Testing Library
- No database in tests (mock Prisma if needed)

## Environment Variables

Required:

- `JWT_SECRET` - Secret key for session tokens (auto-generated in dev)

Optional:

- `ANTHROPIC_API_KEY` - Claude API key (falls back to mock provider)
- `DATABASE_URL` - SQLite path (defaults to prisma/dev.db)
