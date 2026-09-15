import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PostSkeleton, LeaderboardRowSkeleton, ProfileSkeleton } from './Skeletons';

describe('Skeleton Components', () => {
    it('renders PostSkeleton without crashing', () => {
        const { container } = render(<PostSkeleton />);
        const skeletons = container.querySelectorAll('.MuiSkeleton-root');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders LeaderboardRowSkeleton without crashing', () => {
        const { container } = render(<LeaderboardRowSkeleton />);
        const skeletons = container.querySelectorAll('.MuiSkeleton-root');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders ProfileSkeleton without crashing', () => {
        const { container } = render(<ProfileSkeleton />);
        const skeletons = container.querySelectorAll('.MuiSkeleton-root');
        expect(skeletons.length).toBeGreaterThan(0);
    });
});
