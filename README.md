# ♛ AI RPG

Written with the help of Claude Sonnet 4.6.

A terminal-based multi-player RPG powered by the HuggingFace Inference API.
Each player has their own isolated story context, memory, and universe.
An optional React frontend provides a live dashboard with AI-generated scene images.

## Requirements

- [Rust](https://rustup.rs/) 1.85+ (for edition 2024)
- C++ Build Tools (Required for the linker):
  - Windows: [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#:~:text=Build%20Tools%20for%20Visual%20Studio (Check 'Desktop development with C++')
  - macOS: `xcode-select --install`
  - Linux:
    - Ubuntu/Debian: `sudo apt install build-essential`
    - Fedora: `sudo dnf groupinstall "Development Tools"`
    - Arch: `sudo pacman -S base-devel`
- [Node.js](https://nodejs.org/) 24+
- A free [HuggingFace](https://huggingface.co) account + API token
- A Google Cloud project (for optional Google Play sync feature)

---

## Setup

### 1. Get a HuggingFace API token

1. Sign up at https://huggingface.co
2. Go to **Settings → Access Tokens**
3. Create a token with **"Read"** permission (free tier)

### 2. Set your API key

Create `.env` in the project root:

```
HF_TOKEN=hf_yourtoken
```

### 3. (Optional) Google OAuth for Play sync

- See [Google Sign-in for Web](https://developers.google.com/identity/sign-in/web/sign-in) for full documentation.
- Enable authorized JavaScript Origins and Authorized Redirect URIs to use `http://localhost:5173`

#### Add to .env

```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

### 5. Build and run the Rust game

```bash
cargo build --release
cargo run --release
```

### 6. Run the frontend (separate terminal)

```bash
cd frontend
npm install
npm start        # starts bridge server on :3001 AND Vite on :5173
```

Open **http://localhost:5173**
