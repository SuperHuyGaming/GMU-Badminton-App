// client/src/components/PushNotificationPrompt.test.jsx
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import PushNotificationPrompt from "./PushNotificationPrompt";
import { urlB64ToUint8Array } from "../utils/pushUtils";
import apiFetch from "../utils/api";

vi.mock("../utils/api", () => ({
    default: vi.fn()
}));

describe("PushNotificationPrompt Component", () => {
    let originalNotification;
    let originalPushManager;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.useFakeTimers();

        originalNotification = window.Notification;
        originalPushManager = window.PushManager;

        // Default mock push and notification APIs
        window.Notification = {
            permission: "default",
            requestPermission: vi.fn().mockResolvedValue("granted")
        };
        window.PushManager = class {};

        const mockSubscribe = vi.fn().mockResolvedValue({
            endpoint: "https://fcm.googleapis.com/test",
            toJSON: () => ({ endpoint: "https://fcm.googleapis.com/test" })
        });

        Object.defineProperty(window.navigator, "serviceWorker", {
            value: {
                ready: Promise.resolve({
                    pushManager: {
                        subscribe: mockSubscribe
                    }
                })
            },
            configurable: true,
            writable: true
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        window.Notification = originalNotification;
        window.PushManager = originalPushManager;
    });

    describe("urlB64ToUint8Array utility", () => {
        it("returns empty Uint8Array for falsy or invalid input", () => {
            expect(urlB64ToUint8Array(null)).toEqual(new Uint8Array(0));
            expect(urlB64ToUint8Array(undefined)).toEqual(new Uint8Array(0));
            expect(urlB64ToUint8Array("")).toEqual(new Uint8Array(0));
            expect(urlB64ToUint8Array(123)).toEqual(new Uint8Array(0));
        });

        it("converts a valid base64 / base64url string to Uint8Array", () => {
            // "hello" in base64 is "aGVsbG8="
            const result = urlB64ToUint8Array("aGVsbG8");
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBe(5);
        });
    });

    describe("Lifecycle & Display Rules", () => {
        it("does not render if hidePushPrompt is set in localStorage", () => {
            localStorage.setItem("hidePushPrompt", "true");
            render(<PushNotificationPrompt />);
            act(() => {
                vi.advanceTimersByTime(4000);
            });
            expect(screen.queryByTestId("push-notification-prompt")).not.toBeInTheDocument();
        });

        it("does not render if notification permission is already granted", () => {
            window.Notification.permission = "granted";
            render(<PushNotificationPrompt />);
            act(() => {
                vi.advanceTimersByTime(4000);
            });
            expect(screen.queryByTestId("push-notification-prompt")).not.toBeInTheDocument();
        });

        it("does not render if notification permission is denied", () => {
            window.Notification.permission = "denied";
            render(<PushNotificationPrompt />);
            act(() => {
                vi.advanceTimersByTime(4000);
            });
            expect(screen.queryByTestId("push-notification-prompt")).not.toBeInTheDocument();
        });

        it("does not crash if serviceWorker is absent from navigator", () => {
            Object.defineProperty(window.navigator, "serviceWorker", {
                value: undefined,
                configurable: true,
                writable: true
            });
            render(<PushNotificationPrompt />);
            act(() => {
                vi.advanceTimersByTime(4000);
            });
            expect(screen.queryByTestId("push-notification-prompt")).not.toBeInTheDocument();
        });

        it("displays prompt after 3 second delay when permission is default", () => {
            render(<PushNotificationPrompt />);
            expect(screen.queryByTestId("push-notification-prompt")).not.toBeInTheDocument();

            act(() => {
                vi.advanceTimersByTime(3100);
            });

            expect(screen.getByTestId("push-notification-prompt")).toBeInTheDocument();
            expect(screen.getByText(/Stay in the match/i)).toBeInTheDocument();
            expect(screen.getByTestId("push-enable-btn")).toBeInTheDocument();
            expect(screen.getByTestId("push-dismiss-btn")).toBeInTheDocument();
        });
    });

    describe("User Interactions", () => {
        it("dismisses prompt and persists hidePushPrompt when clicking 'Not Now'", () => {
            render(<PushNotificationPrompt />);
            act(() => {
                vi.advanceTimersByTime(3100);
            });

            const dismissBtn = screen.getByTestId("push-dismiss-btn");
            fireEvent.click(dismissBtn);

            expect(localStorage.getItem("hidePushPrompt")).toBe("true");
        });

        it("subscribes user and sends subscription to backend when clicking 'Enable'", async () => {
            apiFetch.mockResolvedValueOnce({ publicKey: "BK391ZkQ=" }); // VAPID key response
            apiFetch.mockResolvedValueOnce({ message: "Subscribed successfully." }); // Subscription post

            render(<PushNotificationPrompt />);
            act(() => {
                vi.advanceTimersByTime(3100);
            });

            const enableBtn = screen.getByTestId("push-enable-btn");
            await act(async () => {
                fireEvent.click(enableBtn);
            });

            expect(window.Notification.requestPermission).toHaveBeenCalled();
            expect(apiFetch).toHaveBeenCalledWith(
                "/api/push/subscribe",
                expect.objectContaining({ method: "POST" })
            );
            expect(localStorage.getItem("hidePushPrompt")).toBe("true");
        });

        it("handles user denying permission gracefully", async () => {
            window.Notification.requestPermission.mockResolvedValueOnce("denied");

            render(<PushNotificationPrompt />);
            act(() => {
                vi.advanceTimersByTime(3100);
            });

            const enableBtn = screen.getByTestId("push-enable-btn");
            await act(async () => {
                fireEvent.click(enableBtn);
            });

            expect(window.Notification.requestPermission).toHaveBeenCalled();
            expect(localStorage.getItem("hidePushPrompt")).toBe("true");
            expect(apiFetch).not.toHaveBeenCalled();
        });

        it("handles subscription error gracefully without crashing", async () => {
            window.Notification.requestPermission.mockRejectedValueOnce(new Error("Permission error"));

            render(<PushNotificationPrompt />);
            act(() => {
                vi.advanceTimersByTime(3100);
            });

            const enableBtn = screen.getByTestId("push-enable-btn");
            await act(async () => {
                fireEvent.click(enableBtn);
            });

            expect(window.Notification.requestPermission).toHaveBeenCalled();
        });
    });
});
