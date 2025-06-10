/**
 * Priority Queue implementation for session management
 */
export class Queue<T> {
  private items: Array<{ item: T; priority: number }> = [];

  async enqueue(item: T, priority: number = 0): Promise<void> {
    const entry = { item, priority };
    
    // Binary search to find insertion point
    let left = 0;
    let right = this.items.length;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const midItem = this.items[mid];
      if (midItem && midItem.priority > priority) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    this.items.splice(left, 0, entry);
  }

  async dequeue(): Promise<T | undefined> {
    if (this.items.length === 0) {
      return undefined;
    }
    
    const entry = this.items.shift();
    return entry?.item;
  }

  peek(): T | undefined {
    if (this.items.length === 0) {
      return undefined;
    }
    
    return this.items[0]?.item;
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  clear(): void {
    this.items = [];
  }

  toArray(): T[] {
    return this.items.map(entry => entry.item);
  }
}