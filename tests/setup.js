import { afterEach } from 'vitest';
import db from '../server/db/index.js';

// Database cleanup is disabled to allow tests within the same describe block to share state
// This is necessary for tests that depend on previous test data (e.g., duplicate username test)
// Tests are cleaned up in beforeAll() hooks of each test file instead