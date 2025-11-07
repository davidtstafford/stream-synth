/**
 * Viewer Entrance Tracker
 * 
 * Tracks which viewers have sent their first message of the current app session.
 * This is an in-memory tracker that resets when the app restarts.
 * 
 * Used to determine when to play entrance sounds - only on the first message
 * a viewer sends after the app starts.
 */

export class ViewerEntranceTracker {
  private chattedViewers: Set<string> = new Set();

  /**
   * Check if a viewer has already chatted this session
   */
  hasChatted(viewerId: string): boolean {
    return this.chattedViewers.has(viewerId);
  }

  /**
   * Mark a viewer as having chatted this session
   */
  markChatted(viewerId: string): void {
    this.chattedViewers.add(viewerId);
  }

  /**
   * Reset the tracker (clear all chatted viewers)
   * Called on app restart or when manually resetting
   */
  reset(): void {
    this.chattedViewers.clear();
  }

  /**
   * Get count of viewers who have chatted this session
   */
  getChattedCount(): number {
    return this.chattedViewers.size;
  }

  /**
   * Check if a specific viewer has chatted
   * @param viewerId - The Twitch user ID
   */
  hasViewerChatted(viewerId: string): boolean {
    return this.hasChatted(viewerId);
  }
}

// Singleton instance
export const viewerEntranceTracker = new ViewerEntranceTracker();
