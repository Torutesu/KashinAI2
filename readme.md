# Local AI Context Engine Backend

A cross-platform AI backend that continuously understands your computer activity, stores contextual memory locally, retrieves relevant information using RAG, and allows an LLM (Google Gemini) to interact with both your operating system and cloud applications.

---

## Features

### Context Collection

Runs background collectors that continuously capture computer context.

- Active Application & Window
- Clipboard History
- Browser History
- Selected Text
- Screen OCR
- Slack Messages
- Google Calendar Events
- VS Code Context

---

### Local Memory (RAG)

Stores all collected context locally.

- SQLite + Prisma
- LanceDB Vector Database
- Transformers.js Embeddings
- Semantic Search
- Context Retrieval

---

### LLM Orchestration

- Google Gemini Integration
- Tool / Function Calling
- Context-aware Prompting
- Automatic Tool Selection

---

### Action Layer

Execute actions locally and through cloud integrations.

#### Local Actions

- Open Browser URLs
- Create Directories
- Open Files/Folders in VS Code
- Browser Automation (Playwright)

#### Cloud Integrations

- Slack
- Gmail
- Google Calendar
- GitHub
- Notion

---

### Cross Platform Support

- macOS
- Linux (X11 & Wayland)
- Windows

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Node.js | Backend Runtime |
| Express | REST API |
| TypeScript | Programming Language |
| Prisma | ORM |
| SQLite | Local Database |
| LanceDB | Vector Database |
| Transformers.js | Embedding Model |
| Google Gemini | LLM |
| Playwright | Browser Automation |

---

## Prerequisites

Install the following before running the project.

### Common

- Node.js 18+
- npm

### Linux

```bash
sudo apt install sqlite3 xdotool xclip wl-clipboard tesseract-ocr gnome-screenshot
```

### macOS

```bash
brew install sqlite tesseract
```

### Windows

Install:

- Tesseract OCR

Make sure it is added to your PATH.

Also ensure the VS Code `code` command is available in PATH.

---

## Installation

Clone the repository.

```bash
git clone <repository-url>
cd ai-context-engine
```

Install dependencies.

```bash
npm install
```

Install Playwright.

```bash
npx playwright install chromium
```

Create the database.

```bash
npx prisma migrate dev --name init
```

---

## Environment Variables

Create a `.env` file in the project root.

```env
DATABASE_URL="file:./dev.db"

PORT=3001

GEMINI_API_KEY=your_google_gemini_api_key

SLACK_BOT_TOKEN=
SLACK_CHANNEL_ID=

GITHUB_TOKEN=

NOTION_API_KEY=
```

Google integrations require OAuth authentication.

---

## Google OAuth Setup

1. Open Google Cloud Console.
2. Create a project.
3. Enable:
   - Gmail API
   - Google Calendar API
4. Configure the OAuth Consent Screen.
5. Add yourself as a Test User.
6. Create an OAuth Client ID.
7. Choose **Desktop Application**.
8. Download the credentials.
9. Rename the file to:

```
google_credentials.json
```

10. Place it in the project root.

Generate the OAuth token.

```bash
npx ts-node src/auth/googleAuth.ts
```

After successful authentication a file named

```
google_token.json
```

will be created.

---

## Running the Application

Start the backend.

```bash
npm run dev
```

The server runs on:

```
http://localhost:3001
```

---

## REST API

### Health

```
GET /health
```

---

### Context

```
GET /context/current
GET /context/recent?limit=10
```

---

### Memory

```
GET /memory/search?query=<query>
POST /memory/store
```

---

### AI

```
POST /chat
POST /retrieve
POST /llm/query
```

---

### Actions

```
POST /actions/execute
```

---

## Example Requests

### Ask the AI

```bash
curl -X POST http://localhost:3001/chat \
-H "Content-Type: application/json" \
-d '{"prompt":"What is my current VS Code workspace?"}'
```

### Browser Automation

```bash
curl -X POST http://localhost:3001/chat \
-H "Content-Type: application/json" \
-d '{"prompt":"Open GitHub in my browser."}'
```

---

## Project Structure

```
src/
├── actions/
├── auth/
├── collectors/
├── db/
├── integrations/
├── llm/
├── memory/
├── retriever/
├── types/
├── app.ts
└── server.ts

prisma/
```

---

## Security

- Local-first architecture
- SQLite local storage
- OAuth authentication
- API key-based integrations
- User context remains on the local machine
- Controlled tool execution

---

## Notes

- macOS Accessibility API requires macOS.
- AppleScript functionality requires macOS.
- Browser automation is implemented using Playwright.
- All context is stored locally before retrieval.

---

## License

MIT License