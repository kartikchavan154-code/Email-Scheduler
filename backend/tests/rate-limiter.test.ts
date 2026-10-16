import { RateLimiterService } from '../src/modules/scheduling/rate-limiter.service';

describe('RateLimiterService Window Calculations', () => {
  it('should generate consistent UTC hourly window keys and boundary timestamps', () => {
    // Fixed timestamp: 2026-10-16 14:25:30 UTC = 1792160730000 ms
    const fixedTime = new Date('2026-10-16T14:25:30Z').getTime();
    const window = RateLimiterService.getHourlyWindowKey(fixedTime);

    expect(window.key).toBe('2026-10-16-14');
    expect(window.windowEndMs - window.windowStartMs).toBe(3600000);
    expect(window.windowStartMs).toBe(new Date('2026-10-16T14:00:00Z').getTime());
    expect(window.windowEndMs).toBe(new Date('2026-10-16T15:00:00Z').getTime());
  });

  it('should rollover window keys at the exact hourly boundary', () => {
    const justBefore = new Date('2026-10-16T14:59:59.999Z').getTime();
    const justAfter = new Date('2026-10-16T15:00:00.000Z').getTime();

    const w1 = RateLimiterService.getHourlyWindowKey(justBefore);
    const w2 = RateLimiterService.getHourlyWindowKey(justAfter);

    expect(w1.key).toBe('2026-10-16-14');
    expect(w2.key).toBe('2026-10-16-15');
  });
});
