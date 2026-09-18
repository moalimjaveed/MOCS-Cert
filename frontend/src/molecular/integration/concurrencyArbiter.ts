/**
 * MOCS-Cert Scientific Concurrency & Async Request Arbiter
 * 
 * Epistemic Status: ESTABLISHED
 * Standards: Monotonic Request Sequence Tokens & In-Flight Abort Coordination
 */

export interface ActiveRequestRecord {
  token: number;
  domain: string;
  targetId: string;
  controller?: AbortController;
  startedAt: number;
}

export class ConcurrencyArbiter {
  private requestCounter = 0;
  private activeDomains = new Map<string, ActiveRequestRecord>();
  private latestIssuedTokens = new Map<string, number>();
  private completedTokens = new Set<number>();
  private cancelledTokens = new Set<number>();

  /**
   * Starts a new async operation in a domain, aborting any prior in-flight operation.
   * Returns a monotonically increasing token and an AbortSignal.
   */
  public registerRequest(domain: string, targetId: string): { token: number; signal?: AbortSignal } {
    this.requestCounter++;
    const token = this.requestCounter;
    this.latestIssuedTokens.set(domain, token);

    // Abort existing in-flight request for this domain
    const existing = this.activeDomains.get(domain);
    if (existing) {
      if (existing.controller) {
        existing.controller.abort();
      }
      this.cancelledTokens.add(existing.token);
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    this.activeDomains.set(domain, {
      token,
      domain,
      targetId,
      controller,
      startedAt: Date.now(),
    });

    return {
      token,
      signal: controller ? controller.signal : undefined,
    };
  }

  /**
   * Checks whether an async response has become stale (i.e. superseded by a newer request, cancelled, or already completed).
   */
  public isStale(domain: string, token: number): boolean {
    if (this.cancelledTokens.has(token)) return true;
    if (this.completedTokens.has(token)) return true;
    const latest = this.latestIssuedTokens.get(domain);
    if (latest !== undefined && token < latest) return true;
    const current = this.activeDomains.get(domain);
    if (!current) return true;
    return current.token !== token;
  }

  /**
   * Completes a request if it is still current, freeing the domain and permanently marking the token completed.
   */
  public completeRequest(domain: string, token: number): boolean {
    if (this.cancelledTokens.has(token)) return false;
    const current = this.activeDomains.get(domain);
    if (current && current.token === token) {
      this.activeDomains.delete(domain);
      this.completedTokens.add(token);
      return true;
    }
    return false;
  }

  /**
   * Cancels any active request in a specific domain.
   */
  public cancelDomain(domain: string): boolean {
    const existing = this.activeDomains.get(domain);
    if (existing) {
      if (existing.controller) {
        existing.controller.abort();
      }
      this.cancelledTokens.add(existing.token);
      this.activeDomains.delete(domain);
      return true;
    }
    return false;
  }

  /**
   * Cancels all active requests across all domains.
   */
  public cancelAll(): void {
    for (const record of this.activeDomains.values()) {
      if (record.controller) {
        record.controller.abort();
      }
      this.cancelledTokens.add(record.token);
    }
    this.activeDomains.clear();
  }

  /**
   * Resets all arbiter state (for testing and hard resets).
   */
  public reset(): void {
    this.cancelAll();
    this.requestCounter = 0;
    this.latestIssuedTokens.clear();
    this.completedTokens.clear();
    this.cancelledTokens.clear();
  }

  public getActiveDomainCount(): number {
    return this.activeDomains.size;
  }

  public getActiveToken(domain: string): number | undefined {
    return this.activeDomains.get(domain)?.token;
  }
}

export const concurrencyArbiter = new ConcurrencyArbiter();
