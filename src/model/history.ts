import type { Project } from './types';

const CAP = 50;
/** Window in which same-key edits fold into the previous undo step. */
const COALESCE_MS = 900;

/**
 * Undo/redo over whole-project snapshots. Cheap because every mutation already
 * deep-clones the project before applying — we just keep the pre-mutation copy.
 * Scoped to one project: switching sheets clears both stacks.
 */
export class History {
  private undoStack: Project[] = [];
  private redoStack: Project[] = [];
  private projectId: string | null = null;
  private lastKey: string | null = null;
  private lastAt = 0;

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(projectId: string | null = null): void {
    this.undoStack = [];
    this.redoStack = [];
    this.projectId = projectId;
    this.lastKey = null;
  }

  /**
   * Call with the project as it was *before* the mutation.
   *
   * `key` coalesces a burst of the same kind of edit into one undo step —
   * without it, typing a title would push one snapshot per keystroke and
   * evict everything else from the stack.
   */
  push(before: Project, key?: string): void {
    if (this.projectId !== before.id) this.clear(before.id);
    const now = Date.now();
    const coalesce = !!key && key === this.lastKey && now - this.lastAt < COALESCE_MS;
    this.lastKey = key ?? null;
    this.lastAt = now;
    if (coalesce && this.undoStack.length) {
      // Keep the snapshot from the start of the burst; just drop the redo path.
      this.redoStack = [];
      return;
    }
    this.undoStack.push(before);
    if (this.undoStack.length > CAP) this.undoStack.shift();
    this.redoStack = [];
  }

  /** Returns the project to restore, given the current one to stash for redo. */
  undo(current: Project): Project | null {
    const prev = this.undoStack.pop();
    if (!prev) return null;
    this.redoStack.push(current);
    return prev;
  }

  redo(current: Project): Project | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(current);
    return next;
  }
}
