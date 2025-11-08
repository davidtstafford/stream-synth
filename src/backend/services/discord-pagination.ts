/**
 * Discord Pagination State Manager
 * 
 * Manages pagination state for voice discovery results
 * Stores paginated results temporarily to avoid re-querying
 */

interface PaginationState {
  voices: any[];
  filters: {
    language?: string;
    gender?: string;
    provider?: string;
  };
  currentPage: number;
  totalPages: number;
  voicesPerPage: number;
  expiresAt: number;
}

// Store pagination state per user+interaction
// Key: `userId_interactionId`
const paginationCache = new Map<string, PaginationState>();

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // Clean up every 5 minutes

// Start cleanup interval
setInterval(() => {
  cleanupExpiredStates();
}, CLEANUP_INTERVAL);

/**
 * Generate cache key from user and interaction IDs
 */
function getCacheKey(userId: string, interactionId: string): string {
  return `${userId}_${interactionId}`;
}

/**
 * Store pagination state
 */
export function setPaginationState(
  userId: string,
  interactionId: string,
  voices: any[],
  filters: any,
  voicesPerPage: number = 10
): void {
  const key = getCacheKey(userId, interactionId);
  const totalPages = Math.ceil(voices.length / voicesPerPage);

  paginationCache.set(key, {
    voices,
    filters,
    currentPage: 1,
    totalPages,
    voicesPerPage,
    expiresAt: Date.now() + CACHE_DURATION
  });

  console.log(`[Pagination] Stored state for ${userId}: ${voices.length} voices, ${totalPages} pages`);
}

/**
 * Get pagination state
 */
export function getPaginationState(userId: string, interactionId: string): PaginationState | null {
  const key = getCacheKey(userId, interactionId);
  const state = paginationCache.get(key);

  if (!state) {
    return null;
  }

  // Check if expired
  if (state.expiresAt < Date.now()) {
    paginationCache.delete(key);
    return null;
  }

  return state;
}

/**
 * Update current page
 */
export function updateCurrentPage(
  userId: string,
  interactionId: string,
  newPage: number
): boolean {
  const key = getCacheKey(userId, interactionId);
  const state = paginationCache.get(key);

  if (!state) {
    return false;
  }

  if (newPage < 1 || newPage > state.totalPages) {
    return false;
  }

  state.currentPage = newPage;
  state.expiresAt = Date.now() + CACHE_DURATION; // Refresh expiry
  return true;
}

/**
 * Get voices for current page
 */
export function getPageVoices(userId: string, interactionId: string): any[] {
  const state = getPaginationState(userId, interactionId);
  if (!state) {
    return [];
  }

  const startIdx = (state.currentPage - 1) * state.voicesPerPage;
  const endIdx = startIdx + state.voicesPerPage;

  return state.voices.slice(startIdx, endIdx);
}

/**
 * Get pagination info
 */
export function getPaginationInfo(userId: string, interactionId: string): {
  currentPage: number;
  totalPages: number;
  totalVoices: number;
  startIdx: number;
  endIdx: number;
} | null {
  const state = getPaginationState(userId, interactionId);
  if (!state) {
    return null;
  }

  const startIdx = (state.currentPage - 1) * state.voicesPerPage + 1;
  const endIdx = Math.min(state.currentPage * state.voicesPerPage, state.voices.length);

  return {
    currentPage: state.currentPage,
    totalPages: state.totalPages,
    totalVoices: state.voices.length,
    startIdx,
    endIdx
  };
}

/**
 * Clear pagination state
 */
export function clearPaginationState(userId: string, interactionId: string): void {
  const key = getCacheKey(userId, interactionId);
  paginationCache.delete(key);
  console.log(`[Pagination] Cleared state for ${userId}`);
}

/**
 * Cleanup expired states
 */
function cleanupExpiredStates(): void {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [key, state] of paginationCache.entries()) {
    if (state.expiresAt < now) {
      paginationCache.delete(key);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`[Pagination] Cleaned up ${cleanedCount} expired states`);
  }
}

/**
 * Get cache stats (for debugging)
 */
export function getCacheStats(): {
  totalStates: number;
  totalVoices: number;
} {
  let totalVoices = 0;

  for (const state of paginationCache.values()) {
    totalVoices += state.voices.length;
  }

  return {
    totalStates: paginationCache.size,
    totalVoices
  };
}
