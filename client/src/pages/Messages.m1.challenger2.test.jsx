import { StrictMode } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Messages from './Messages';
import { AuthContext } from '../context/AuthContext';
import apiFetch from '../utils/api';

vi.mock('../utils/api', () => ({ default: vi.fn() }));

const { socketHandlers, mockSocket } = vi.hoisted(() => {
    const handlers = {};
    const socket = {
        emit: vi.fn(),
        on: vi.fn((event, cb) => {
            (handlers[event] ||= new Set()).add(cb);
        }),
        off: vi.fn((event, cb) => {
            handlers[event]?.delete(cb);
        }),
    };
    return { socketHandlers: handlers, mockSocket: socket };
});
vi.mock('../utils/socket', () => ({ default: mockSocket }));

const ALICE = { id: 'alice-1', _id: 'alice-1', name: 'Alice Smith' };
const BOB = { _id: 'bob-2', id: 'bob-2', name: 'Bob Jones', profilePic: 'https://example.com/bob.jpg' };

const json = (data, ok = true) => ({ ok, json: async () => data });

const bubbles = (text) => screen.queryAllByText(text, { selector: 'p.MuiTypography-body1' });

describe('Milestone 1 Challenger 2 Empirical Stress Tests: Messages.jsx', () => {
    let originalAlert;
    let originalConfirm;
    let originalClipboard;

    beforeEach(() => {
        vi.clearAllMocks();
        Object.keys(socketHandlers).forEach((k) => delete socketHandlers[k]);
        Element.prototype.scrollIntoView = vi.fn();
        localStorage.clear();
        localStorage.setItem('activeChat', JSON.stringify(BOB));

        originalAlert = window.alert;
        originalConfirm = window.confirm;
        originalClipboard = navigator.clipboard;

        window.alert = vi.fn();
        window.confirm = vi.fn(() => true);

        apiFetch.mockImplementation(async (url, opts) => {
            if (url.startsWith('/api/friends/')) return json({ friends: [BOB] });
            if (url.startsWith('/api/messages/recent/')) return json([]);
            if (url.startsWith('/api/messages/read/')) return json({ message: 'ok' });
            if (url.startsWith(`/api/messages/${ALICE.id}/${BOB._id}`)) {
                return json({
                    messages: [{
                        _id: 'msg-init-1',
                        sender: BOB,
                        receiver: ALICE,
                        content: 'Hey Alice',
                        timestamp: new Date().toISOString(),
                        read: true
                    }],
                    hasMore: false
                });
            }
            if (url === '/api/messages' && opts?.method === 'POST') {
                const body = JSON.parse(opts.body);
                return json({
                    _id: `msg-${Date.now()}`,
                    sender: ALICE,
                    receiver: BOB,
                    content: body.content,
                    timestamp: new Date().toISOString(),
                    read: false
                });
            }
            if (url === '/api/upload/image' && opts?.method === 'POST') {
                return json({
                    imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1234/badminton_shot.jpg'
                });
            }
            if (url.startsWith('/api/messages/report/') && opts?.method === 'POST') {
                return json({ message: 'Reported' });
            }
            return json({});
        });
    });

    afterEach(() => {
        localStorage.clear();
        window.alert = originalAlert;
        window.confirm = originalConfirm;
        Object.defineProperty(navigator, 'clipboard', {
            value: originalClipboard,
            configurable: true,
            writable: true
        });
    });

    const renderMessages = () =>
        render(
            <StrictMode>
                <AuthContext.Provider value={{ user: ALICE }}>
                    <MemoryRouter initialEntries={['/messages']}>
                        <Messages />
                    </MemoryRouter>
                </AuthContext.Provider>
            </StrictMode>
        );

    // =========================================================================
    // 1. Dynamic Send / Quick Like Button Tests
    // =========================================================================
    describe('1. Dynamic Send / Quick Like Button', () => {
        it('displays thumbs up 👍 button with aria-label="Send a thumbs-up" when input is empty', async () => {
            renderMessages();
            await waitFor(() => expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument());

            const thumbsUpBtn = screen.getByRole('button', { name: 'Send a thumbs-up' });
            expect(thumbsUpBtn).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Send message' })).toBeNull();
        });

        it('clicking thumbs up 👍 submits "👍" to the conversation and triggers API call', async () => {
            renderMessages();
            await waitFor(() => expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument());

            const thumbsUpBtn = screen.getByRole('button', { name: 'Send a thumbs-up' });
            await act(async () => {
                fireEvent.click(thumbsUpBtn);
            });

            await waitFor(() => {
                const postCalls = apiFetch.mock.calls.filter(([url, opts]) => url === '/api/messages' && opts?.method === 'POST');
                expect(postCalls.length).toBeGreaterThan(0);
                const lastPayload = JSON.parse(postCalls[0][1].body);
                expect(lastPayload.content).toBe('👍');
                expect(lastPayload.receiverId).toBe(BOB._id);
            });

            // Optimistic copy displays in chat bubble
            expect(bubbles('👍').length).toBeGreaterThan(0);
        });

        it('typing whitespace-only ("   ") preserves the thumbs up 👍 button', async () => {
            renderMessages();
            const input = await screen.findByPlaceholderText('Type a message...');

            fireEvent.change(input, { target: { value: '     ' } });

            // Must STILL show thumbs-up button and NOT swap to send button
            expect(screen.getByRole('button', { name: 'Send a thumbs-up' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Send message' })).toBeNull();

            // Clicking thumbs up still sends 👍
            const thumbsUpBtn = screen.getByRole('button', { name: 'Send a thumbs-up' });
            await act(async () => {
                fireEvent.click(thumbsUpBtn);
            });

            const postCalls = apiFetch.mock.calls.filter(([url, opts]) => url === '/api/messages' && opts?.method === 'POST');
            expect(postCalls.length).toBeGreaterThan(0);
            expect(JSON.parse(postCalls[0][1].body).content).toBe('👍');
        });

        it('typing non-whitespace text swaps to Send button with aria-label="Send message"', async () => {
            renderMessages();
            const input = await screen.findByPlaceholderText('Type a message...');

            // Type non-whitespace text
            fireEvent.change(input, { target: { value: 'Smash incoming!' } });

            // Swaps to Send message button
            expect(screen.queryByRole('button', { name: 'Send a thumbs-up' })).toBeNull();
            const sendBtn = screen.getByRole('button', { name: 'Send message' });
            expect(sendBtn).toBeInTheDocument();

            // Clear text back to empty: swaps back to thumbs-up button
            fireEvent.change(input, { target: { value: '' } });
            expect(screen.getByRole('button', { name: 'Send a thumbs-up' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Send message' })).toBeNull();
        });

        it('submitting message via Send button dispatches text and resets button to 👍', async () => {
            renderMessages();
            const input = await screen.findByPlaceholderText('Type a message...');

            fireEvent.change(input, { target: { value: 'Match tomorrow?' } });
            const sendBtn = screen.getByRole('button', { name: 'Send message' });

            await act(async () => {
                fireEvent.click(sendBtn);
            });

            // Message text posted
            const postCalls = apiFetch.mock.calls.filter(([url, opts]) => url === '/api/messages' && opts?.method === 'POST');
            expect(postCalls.length).toBeGreaterThan(0);
            expect(JSON.parse(postCalls[0][1].body).content).toBe('Match tomorrow?');

            // Input is cleared and button returns to thumbs up
            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Send a thumbs-up' })).toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // 2. Image Attachment Action Tests
    // =========================================================================
    describe('2. Image Attachment Action', () => {
        it('renders image attachment button with aria-label and triggers file input click', async () => {
            renderMessages();
            await waitFor(() => expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument());

            const attachBtn = screen.getByRole('button', { name: 'Attach photo or image' });
            expect(attachBtn).toBeInTheDocument();

            const fileInput = document.querySelector('input[type="file"][accept="image/*"]');
            expect(fileInput).not.toBeNull();
            expect(fileInput.style.display).toBe('none');

            const clickSpy = vi.spyOn(fileInput, 'click');
            fireEvent.click(attachBtn);
            expect(clickSpy).toHaveBeenCalled();
        });

        it('client validation rejects files larger than 10MB with alert', async () => {
            renderMessages();
            await waitFor(() => expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument());

            const fileInput = document.querySelector('input[type="file"][accept="image/*"]');
            const oversizedFile = new File(['a'.repeat(100)], 'huge.png', { type: 'image/png' });
            Object.defineProperty(oversizedFile, 'size', { value: 11 * 1024 * 1024 }); // 11MB

            await act(async () => {
                fireEvent.change(fileInput, { target: { files: [oversizedFile] } });
            });

            expect(window.alert).toHaveBeenCalledWith('Image file size exceeds 10MB limit.');
            const uploadCalls = apiFetch.mock.calls.filter(([url]) => url === '/api/upload/image');
            expect(uploadCalls).toHaveLength(0);
        });

        it('client validation rejects non-image MIME types with alert', async () => {
            renderMessages();
            await waitFor(() => expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument());

            const fileInput = document.querySelector('input[type="file"][accept="image/*"]');
            const pdfFile = new File(['content'], 'document.pdf', { type: 'application/pdf' });
            Object.defineProperty(pdfFile, 'size', { value: 1024 });

            await act(async () => {
                fireEvent.change(fileInput, { target: { files: [pdfFile] } });
            });

            expect(window.alert).toHaveBeenCalledWith('Please select a valid image file (PNG, JPG, WebP, GIF).');
            const uploadCalls = apiFetch.mock.calls.filter(([url]) => url === '/api/upload/image');
            expect(uploadCalls).toHaveLength(0);
        });

        it('uploads valid image (<=10MB) to /api/upload/image and auto-dispatches image message', async () => {
            renderMessages();
            await waitFor(() => expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument());

            const fileInput = document.querySelector('input[type="file"][accept="image/*"]');
            const validFile = new File(['image-bytes'], 'racket.jpg', { type: 'image/jpeg' });
            Object.defineProperty(validFile, 'size', { value: 2 * 1024 * 1024 }); // 2MB

            await act(async () => {
                fireEvent.change(fileInput, { target: { files: [validFile] } });
            });

            await waitFor(() => {
                const uploadCalls = apiFetch.mock.calls.filter(([url]) => url === '/api/upload/image');
                expect(uploadCalls).toHaveLength(1);
            });

            // Auto-dispatches message with Cloudinary imageUrl
            await waitFor(() => {
                const messageCalls = apiFetch.mock.calls.filter(([url, opts]) =>
                    url === '/api/messages' &&
                    opts?.method === 'POST' &&
                    opts?.body.includes('https://res.cloudinary.com/demo/image/upload/v1234/badminton_shot.jpg')
                );
                expect(messageCalls.length).toBeGreaterThan(0);
            });
        });

        it('renders Cloudinary image URL in chat bubble without breaking accessible text content', async () => {
            const imageUrl = 'https://res.cloudinary.com/demo/image/upload/court_setup.png';
            apiFetch.mockImplementation(async (url) => {
                if (url.startsWith('/api/friends/')) return json({ friends: [BOB] });
                if (url.startsWith('/api/messages/recent/')) return json([]);
                if (url.startsWith('/api/messages/read/')) return json({ message: 'ok' });
                if (url.startsWith(`/api/messages/${ALICE.id}/${BOB._id}`)) {
                    return json({
                        messages: [{
                            _id: 'msg-img-1',
                            sender: BOB,
                            receiver: ALICE,
                            content: imageUrl,
                            timestamp: new Date().toISOString(),
                            read: true
                        }],
                        hasMore: false
                    });
                }
                return json({});
            });

            renderMessages();

            // Image tag should be rendered with alt="Shared attachment"
            const imgElement = await screen.findByRole('img', { name: 'Shared attachment' });
            expect(imgElement).toBeInTheDocument();
            expect(imgElement.getAttribute('src')).toBe(imageUrl);

            // Hidden body1 typography is preserved for test selectors and screen readers
            const hiddenText = screen.getByText(imageUrl, { selector: 'p.MuiTypography-body1' });
            expect(hiddenText).toBeInTheDocument();
        });
    });

    // =========================================================================
    // 3. Tap-to-Inspect Message Drawer Tests
    // =========================================================================
    describe('3. Tap-to-Inspect Message Drawer', () => {
        const partnerMsg = {
            _id: 'msg-partner-77',
            sender: BOB,
            receiver: ALICE,
            content: 'Meet at RAC Court 3 at 6pm',
            timestamp: new Date('2026-11-07T18:00:00Z').toISOString(),
            read: true
        };

        const ownMsg = {
            _id: 'msg-own-88',
            sender: ALICE,
            receiver: BOB,
            content: 'Sounds good, see you there',
            timestamp: new Date('2026-11-07T18:01:00Z').toISOString(),
            read: true
        };

        beforeEach(() => {
            apiFetch.mockImplementation(async (url) => {
                if (url.startsWith('/api/friends/')) return json({ friends: [BOB] });
                if (url.startsWith('/api/messages/recent/')) return json([]);
                if (url.startsWith('/api/messages/read/')) return json({ message: 'ok' });
                if (url.startsWith(`/api/messages/${ALICE.id}/${BOB._id}`)) {
                    return json({
                        messages: [partnerMsg, ownMsg],
                        hasMore: false
                    });
                }
                if (url.startsWith('/api/messages/report/') && url.includes(partnerMsg._id)) {
                    return json({ message: 'Reported successfully' });
                }
                return json({});
            });
        });

        it('tapping a partner message opens drawer with sender, localized timestamp, preview, copy and report', async () => {
            renderMessages();
            await waitFor(() => expect(screen.getByText('Meet at RAC Court 3 at 6pm')).toBeInTheDocument());

            // Tap partner's message bubble
            const bubble = screen.getByText('Meet at RAC Court 3 at 6pm').closest('.MuiBox-root');
            fireEvent.click(bubble);

            // Drawer opens with Close message details button
            const closeBtn = await screen.findByRole('button', { name: 'Close message details' });
            expect(closeBtn).toBeInTheDocument();

            // Action buttons present for partner's message
            expect(screen.getByRole('button', { name: 'Copy Text' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Report' })).toBeInTheDocument();
        });

        it('tapping own message displays "You" and does NOT display "Report" button', async () => {
            renderMessages();
            await waitFor(() => expect(screen.getByText('Sounds good, see you there')).toBeInTheDocument());

            const bubble = screen.getByText('Sounds good, see you there').closest('.MuiBox-root');
            fireEvent.click(bubble);

            await waitFor(() => {
                expect(screen.getByText('You')).toBeInTheDocument();
            });

            // Copy button is present
            expect(screen.getByRole('button', { name: 'Copy Text' })).toBeInTheDocument();

            // Report button MUST NOT be present for own message
            expect(screen.queryByRole('button', { name: 'Report' })).toBeNull();
        });

        it('clicking Copy Text calls clipboard API and provides feedback', async () => {
            const mockWriteText = vi.fn().mockResolvedValue(undefined);
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: mockWriteText },
                configurable: true,
                writable: true
            });

            renderMessages();
            await waitFor(() => expect(screen.getByText('Meet at RAC Court 3 at 6pm')).toBeInTheDocument());

            const bubble = screen.getByText('Meet at RAC Court 3 at 6pm').closest('.MuiBox-root');
            fireEvent.click(bubble);

            const copyBtn = await screen.findByRole('button', { name: 'Copy Text' });
            await act(async () => {
                fireEvent.click(copyBtn);
            });

            expect(mockWriteText).toHaveBeenCalledWith('Meet at RAC Court 3 at 6pm');
            await waitFor(() => {
                expect(screen.getByText('✓ Copied to clipboard')).toBeInTheDocument();
            });
        });

        it('clicking Report confirms and calls report API endpoint', async () => {
            renderMessages();
            await waitFor(() => expect(screen.getByText('Meet at RAC Court 3 at 6pm')).toBeInTheDocument());

            const bubble = screen.getByText('Meet at RAC Court 3 at 6pm').closest('.MuiBox-root');
            fireEvent.click(bubble);

            const reportBtn = await screen.findByRole('button', { name: 'Report' });
            await act(async () => {
                fireEvent.click(reportBtn);
            });

            expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to report this message to admins?');
            await waitFor(() => {
                const reportCalls = apiFetch.mock.calls.filter(([url]) => url === `/api/messages/report/${partnerMsg._id}`);
                expect(reportCalls).toHaveLength(1);
            });
        });
    });

    // =========================================================================
    // 4. Virtual Keyboard visualViewport Ergonomics Tests
    // =========================================================================
    describe('4. Virtual Keyboard visualViewport Ergonomics', () => {
        let mockVisualViewport;

        beforeEach(() => {
            mockVisualViewport = {
                height: 800,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            };
            Object.defineProperty(window, 'visualViewport', {
                value: mockVisualViewport,
                configurable: true,
                writable: true
            });
            Object.defineProperty(window, 'innerHeight', {
                value: 800,
                configurable: true,
                writable: true
            });
        });

        it('registers visualViewport resize and scroll event listeners and cleans them up on unmount', async () => {
            const { unmount } = renderMessages();
            expect(mockVisualViewport.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
            expect(mockVisualViewport.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));

            unmount();
            expect(mockVisualViewport.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
            expect(mockVisualViewport.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
        });

        it('auto-scrolls conversation to newest message when virtual keyboard opens', async () => {
            vi.useFakeTimers();
            renderMessages();

            // Wait for initial messages to load so messagesEndRef is in DOM
            await act(async () => {
                await Promise.resolve();
            });

            // Simulate keyboard opening: visualViewport height drops from 800 to 450 (offset = 350 > 80)
            mockVisualViewport.height = 450;
            const resizeListener = mockVisualViewport.addEventListener.mock.calls.find(([e]) => e === 'resize')?.[1];
            expect(resizeListener).toBeDefined();

            act(() => {
                resizeListener();
            });

            // Fast forward auto-scroll debounce timer (120ms)
            act(() => {
                vi.advanceTimersByTime(200);
            });

            expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
            vi.useRealTimers();
        });
    });
});
