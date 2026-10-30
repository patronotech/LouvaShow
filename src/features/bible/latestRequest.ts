/** Native requests cannot always be cancelled, but obsolete replies must never change preparation. */
export class LatestRequest {
  private revision = 0;

  invalidate(): void { this.revision += 1; }

  async run<T>(load: () => Promise<T>, handlers: {
    success: (value: T) => void;
    failure: (reason: unknown) => void;
    settled: () => void;
  }): Promise<void> {
    const revision = ++this.revision;
    try {
      const value = await load();
      if (revision === this.revision) handlers.success(value);
    } catch (reason) {
      if (revision === this.revision) handlers.failure(reason);
    } finally {
      if (revision === this.revision) handlers.settled();
    }
  }
}
