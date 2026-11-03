// Sign-up stepper must not pass the removed MUI v9 `StepIconProps` prop to StepLabel
// (it produced a React "unknown prop" console warning during the two-bot E2E run).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Auth from './Auth';
import { AuthContext } from '../context/AuthContext';

describe('Auth sign-up stepper', () => {
    afterEach(() => vi.restoreAllMocks());

    it('renders the sign-up steps without React unknown-prop warnings', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        render(
            <AuthContext.Provider value={{ user: null, login: vi.fn() }}>
                <MemoryRouter>
                    <Auth />
                </MemoryRouter>
            </AuthContext.Provider>
        );
        fireEvent.click(screen.getByRole('tab', { name: 'Sign Up' }));

        // The stepper is on screen...
        expect(document.querySelectorAll('.MuiStepLabel-root').length).toBeGreaterThan(0);
        // ...and nothing complained about StepIconProps (or any other unknown prop).
        const logged = [...errorSpy.mock.calls, ...warnSpy.mock.calls].map((args) => args.map(String).join(' '));
        expect(logged.filter((line) => /StepIconProps/.test(line))).toEqual([]);
        expect(logged.filter((line) => /does not recognize the .* prop/i.test(line))).toEqual([]);
    });
});
