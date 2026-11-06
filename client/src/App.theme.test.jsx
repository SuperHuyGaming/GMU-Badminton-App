import { describe, it, expect } from 'vitest';
import { createAppTheme } from './App';

describe('App Theme Tokens', () => {
	it('configures dark mode with elevated contrast, deep green bg, and glassmorphism borders', () => {
		const theme = createAppTheme('dark');
		expect(theme.palette.mode).toBe('dark');
		expect(theme.palette.background.default).toBe('#02120a');
		expect(theme.palette.background.paper).toBe('rgba(13, 38, 25, 0.85)');
		expect(theme.palette.text.primary).toBe('#f8fafc');
		expect(theme.palette.text.secondary).toBe('rgba(248, 250, 252, 0.75)');
		expect(theme.palette.divider).toBe('rgba(255, 255, 255, 0.08)');
		expect(theme.components.MuiPaper.styleOverrides.root.border).toBe('1px solid rgba(255, 255, 255, 0.08)');
	});

	it('configures light mode with clean background, glassmorphism border, and subtle divider', () => {
		const theme = createAppTheme('light');
		expect(theme.palette.mode).toBe('light');
		expect(theme.palette.background.default).toBe('#f4f6f8');
		expect(theme.palette.background.paper).toBe('rgba(255, 255, 255, 0.75)');
		expect(theme.palette.text.primary).toBe('#1a202c');
		expect(theme.palette.divider).toBe('rgba(0, 0, 0, 0.08)');
		expect(theme.components.MuiPaper.styleOverrides.root.border).toBe('1px solid rgba(255, 255, 255, 0.4)');
	});
});
