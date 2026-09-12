import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import App from '../App';

describe('App Component', () => {
  it('should render without crashing', () => {
    // App uses MemoryRouter or BrowserRouter depending on setup
    // Since App already has a BrowserRouter inside, we just render it.
    render(<App />);
    expect(document.body).toBeDefined();
  });
});
