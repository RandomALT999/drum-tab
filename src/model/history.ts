import type { Project } from './types';

const CAP = 50;

/**
 * Undo/redo over whole-project snapshots. Cheap because every mutation already
 * deep-clones the project before applying — we just keep the pre-mutation copy.
 * Scoped to one project: switching sheets clears both stacks.
 */
export class History {
  private undoStack: Project[] = [];
  private redoStack: Project[] = [];
  private projectId: string | null = null;

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
  }

  /** Call with the project as it was *before* the mutation. */
  push(before: Project): void {
    if (this.projectId !== before.id) this.clear(before.id);
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
