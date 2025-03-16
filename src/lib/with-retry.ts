import { delay } from './delay'

interface RetryOptions {
  count?: number
  interval?: number
  intervalMultiplier?: number
  maxInterval?: number
  onFailure?: (error: unknown, stop: () => void) => void
}

export async function withRetry<Result>(fn: () => Promise<Result>, options: RetryOptions = {}): Promise<Result> {
  const { count = 3, interval = 20, intervalMultiplier = 3, onFailure, maxInterval = 3600000 } = options

  let currentCount = 0
  let lastError: unknown
  const stop = () => {
    currentCount = count
  }

  let currentMultiplier = 1

  while (currentCount < count) {
    try {
      return await fn()
    } catch (error: unknown) {
      lastError = error
      onFailure?.(error, stop)
      currentCount++
    }

    if (currentCount < count) {
      await delay(interval)
    }

    currentMultiplier *= intervalMultiplier
    currentMultiplier = Math.min(currentMultiplier, maxInterval)
  }

  throw lastError
}
