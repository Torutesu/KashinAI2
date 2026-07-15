// src/loadEnv.ts
//
// Side-effect module: loads .env into process.env. Import this FIRST (before any
// module that reads process.env at load time) so config is populated before,
// e.g., GeminiProvider or the auth middleware read their env vars. ES module
// imports run top-to-bottom, so `import './loadEnv'` as the first import in an
// entrypoint guarantees this runs before the rest of the graph initializes.

import dotenv from 'dotenv';

dotenv.config();
