import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatNotificationTime } from './dateUtils';

describe('formatNotificationTime', () => {
    beforeEach(() => {
        // Mock the current date to a fixed point in time
        // Let's say current time is Sep 13, 2026 12:00:00 PM
        const mockDate = new Date('2026-09-13T12:00:00Z');
        vi.useFakeTimers();
        vi.setSystemTime(mockDate);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns empty string if no date is provided', () => {
        expect(formatNotificationTime(null)).toBe('');
        expect(formatNotificationTime(undefined)).toBe('');
    });

    it('returns only time for dates less than 24 hours ago', () => {
        // 5 hours ago (Sep 13, 2026 07:00:00 AM UTC)
        const recentDate = new Date('2026-09-13T07:00:00Z').toISOString();
        const formatted = formatNotificationTime(recentDate);
        
        // It should just be the time. Format depends on locale but it won't contain the month (Sep)
        expect(formatted).not.toContain('Sep');
        expect(formatted).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)?/i);
    });

    it('returns date and time for dates more than 24 hours ago', () => {
        // 2 days ago (Sep 11, 2026 10:00:00 AM UTC)
        const oldDate = new Date('2026-09-11T10:00:00Z').toISOString();
        const formatted = formatNotificationTime(oldDate);
        
        // It should contain the month and 'at'
        expect(formatted).toContain('Sep');
        expect(formatted).toContain('11');
        expect(formatted).toContain('at');
        expect(formatted).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)?/i);
    });

    it('handles exact 24 hour boundary correctly', () => {
        // Exactly 24 hours ago (Sep 12, 2026 12:00:00 PM UTC)
        const exact24Date = new Date('2026-09-12T12:00:00Z').toISOString();
        const formatted = formatNotificationTime(exact24Date);
        
        // According to our logic (diffInHours < 24), exact 24 should fall into the else block (more than 24 hours)
        expect(formatted).toContain('Sep');
        expect(formatted).toContain('12');
        expect(formatted).toContain('at');
    });
});
