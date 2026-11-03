// Onboarding must not overwrite what the user chose at sign-up (two-bot E2E: Alice picked
// "C Level" at sign-up and onboarding silently reset her to "D Level").
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OnboardingWizard from './OnboardingWizard';
import { AuthContext } from '../context/AuthContext';
import apiFetch from '../utils/api';

vi.mock('../utils/api', () => ({ default: vi.fn() }));

const alice = { id: 'alice-1', _id: 'alice-1', name: 'Alice Bot', skillLevel: 'C Level' };

const renderWizard = (user = alice) => {
    const updateUser = vi.fn();
    const onComplete = vi.fn();
    render(
        <AuthContext.Provider value={{ user, updateUser, setToastMessage: vi.fn() }}>
            <OnboardingWizard onComplete={onComplete} />
        </AuthContext.Provider>
    );
    return { updateUser, onComplete };
};

const clickNext = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));
const profileBody = () => {
    const call = apiFetch.mock.calls.find(([url, o]) => url === '/api/profile' && o?.method === 'PUT');
    return call ? JSON.parse(call[1].body) : null;
};

describe('OnboardingWizard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        apiFetch.mockImplementation(async (url, opts) => ({
            ok: true,
            json: async () => ({ ...alice, ...JSON.parse(opts?.body || '{}') }),
        }));
    });

    it('starts from the skill level chosen at sign-up and does not overwrite it', async () => {
        const { onComplete } = renderWizard();
        clickNext(); // -> Your Info
        clickNext(); // -> Play Style
        await waitFor(() => expect(screen.getByText('Your Play Style')).toBeInTheDocument());
        expect(screen.getByText('C Level')).toBeInTheDocument();
        clickNext(); // -> Ready
        await waitFor(() => expect(screen.getByText(/Skill: C Level/)).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /Let's Go/ }));
        await waitFor(() => expect(onComplete).toHaveBeenCalled());

        const body = profileBody();
        expect(body.onboardingComplete).toBe(true);
        // Untouched fields are not sent at all, so the server keeps "C Level".
        expect(body).not.toHaveProperty('skillLevel');
        expect(body).not.toHaveProperty('name');
    });

    it('sends only the fields the user changed', async () => {
        renderWizard();
        clickNext(); // -> Your Info
        const bio = await screen.findByRole('textbox', { name: 'Short Bio' });
        fireEvent.change(bio, { target: { value: 'Doubles after class' } });
        clickNext();
        await screen.findByText('Your Play Style');
        clickNext();
        await screen.findByText(/Skill: C Level/);
        fireEvent.click(screen.getByRole('button', { name: /Let's Go/ }));
        await waitFor(() => expect(profileBody()).not.toBeNull());

        expect(profileBody()).toEqual({ bio: 'Doubles after class', onboardingComplete: true });
    });
});
