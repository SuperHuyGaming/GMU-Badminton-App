// client/src/pages/admin/TournamentApprovals.test.jsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import TournamentApprovals from "./TournamentApprovals";
import apiFetch from "../../utils/api";
import { toast } from "react-hot-toast";

vi.mock("../../utils/api", () => ({
    default: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

const mockProposals = [
    {
        _id: "prop-high-1",
        tournamentName: "Mason Open 2026",
        date: "2026-11-20T00:00:00.000Z",
        location: "RAC Gym, Fairfax, VA",
        entryFee: "$25",
        registrationLink: "https://masonbadminton.com/register/open",
        skillLevels: ["Intermediate", "Advanced"],
        registrationDeadline: "2026-11-15T00:00:00.000Z",
        sourceUrl: "https://instagram.com/p/mason-open-2026",
        confidenceScore: 94,
        status: "pending",
        rawCaption: "🏸 Mason Open 2026 is officially live! Nov 20 at RAC Gym. $25 entry fee. Register at link in bio.",
        scrapedImageUrls: ["https://images.unsplash.com/photo-1626224583764-f87db24ac4ea"],
        sourceLinks: ["https://masonbadminton.com/register/open"],
        createdAt: "2026-10-01T12:00:00.000Z",
    },
    {
        _id: "prop-low-2",
        tournamentName: "DMV Fall Racket Fest",
        date: "2026-12-05T00:00:00.000Z",
        location: "TBD",
        entryFee: "",
        registrationLink: "",
        skillLevels: ["Open"],
        registrationDeadline: null,
        sourceUrl: "https://instagram.com/p/dmv-fall-racket",
        confidenceScore: 62,
        status: "pending",
        rawCaption: "Tentative fall tournament coming up in DMV area. Save the date Dec 5. Details soon.",
        scrapedImageUrls: [],
        sourceLinks: [],
        createdAt: "2026-10-02T08:00:00.000Z",
    },
];

const renderComponent = () => {
    return render(
        <MemoryRouter>
            <TournamentApprovals />
        </MemoryRouter>
    );
};

describe("TournamentApprovals Admin Page Component", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("1. Review queue renders proposals fetched from API", async () => {
        apiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockProposals,
        });

        renderComponent();

        expect(screen.getByRole("progressbar")).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText("Mason Open 2026")).toBeInTheDocument();
            expect(screen.getByText("DMV Fall Racket Fest")).toBeInTheDocument();
        });

        expect(screen.getByText("RAC Gym, Fairfax, VA")).toBeInTheDocument();
        expect(screen.getByText("$25")).toBeInTheDocument();
        expect(screen.getByText("94%")).toBeInTheDocument();
        expect(screen.getByText("62%")).toBeInTheDocument();
    });

    it("2. Low confidence (< 80) proposal renders warning highlight", async () => {
        apiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockProposals,
        });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText("DMV Fall Racket Fest")).toBeInTheDocument();
        });

        // Queue-level alert banner should be rendered
        expect(
            screen.getByText(/Low confidence proposals detected \(below 80%\)/i)
        ).toBeInTheDocument();

        // The low confidence item has specific attention label
        expect(screen.getByText("Attention required")).toBeInTheDocument();
    });

    it("3. Split-screen reviewer modal opens on click, displaying raw flyer/caption and pre-filled form", async () => {
        apiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockProposals,
        });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText("Mason Open 2026")).toBeInTheDocument();
        });

        // Click Review on the first proposal
        const reviewButtons = screen.getAllByRole("button", { name: /Review/i });
        fireEvent.click(reviewButtons[0]);

        // Dialog should be open
        expect(screen.getByRole("dialog")).toBeInTheDocument();

        // Left Side: Raw Scraped Context
        expect(screen.getByText("Raw Scraped Context")).toBeInTheDocument();
        expect(
            screen.getByText(/🏸 Mason Open 2026 is officially live!/i)
        ).toBeInTheDocument();
        const flyerImg = screen.getByAltText("Scraped Tournament Flyer");
        expect(flyerImg).toBeInTheDocument();
        expect(flyerImg).toHaveAttribute(
            "src",
            "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea"
        );

        // Right Side: Editable AI Extracted Form
        expect(screen.getByText("Extracted AI Data (Editable)")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Mason Open 2026")).toBeInTheDocument();
        expect(screen.getByDisplayValue("RAC Gym, Fairfax, VA")).toBeInTheDocument();
        expect(screen.getByDisplayValue("$25")).toBeInTheDocument();
        expect(
            screen.getByDisplayValue("https://masonbadminton.com/register/open")
        ).toBeInTheDocument();
        expect(
            screen.getByDisplayValue("Intermediate, Advanced")
        ).toBeInTheDocument();
    });

    it("4. Approve button triggers POST /approve/:id, toast success, and queue removal", async () => {
        apiFetch.mockImplementation(async (url) => {
            if (url === "/api/admin/tournaments/proposed") {
                return {
                    ok: true,
                    json: async () => [...mockProposals],
                };
            }
            if (url.includes("/api/admin/tournaments/approve/prop-high-1")) {
                return {
                    ok: true,
                    json: async () => ({
                        message: "Tournament approved and published successfully",
                        tournament: { _id: "tourney-1", tournamentName: "Mason Open 2026" },
                    }),
                };
            }
            return { ok: true, json: async () => ({}) };
        });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText("Mason Open 2026")).toBeInTheDocument();
        });

        // Click quick Approve button in row
        const approveButtons = screen.getAllByRole("button", { name: /Approve/i });
        fireEvent.click(approveButtons[0]);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(
                "/api/admin/tournaments/approve/prop-high-1",
                expect.objectContaining({ method: "POST" })
            );
            expect(toast.success).toHaveBeenCalledWith(
                "Tournament approved and published successfully"
            );
        });

        // Proposal should be removed from view
        await waitFor(() => {
            expect(screen.queryByText("Mason Open 2026")).not.toBeInTheDocument();
        });
        // Second proposal remains
        expect(screen.getByText("DMV Fall Racket Fest")).toBeInTheDocument();
    });

    it("5. Reject button triggers POST /reject/:id, toast success, and queue removal", async () => {
        apiFetch.mockImplementation(async (url) => {
            if (url === "/api/admin/tournaments/proposed") {
                return {
                    ok: true,
                    json: async () => [...mockProposals],
                };
            }
            if (url.includes("/api/admin/tournaments/reject/prop-low-2")) {
                return {
                    ok: true,
                    json: async () => ({
                        message: "Tournament proposal rejected",
                    }),
                };
            }
            return { ok: true, json: async () => ({}) };
        });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText("DMV Fall Racket Fest")).toBeInTheDocument();
        });

        // Click Reject button for second proposal
        const rejectButtons = screen.getAllByRole("button", { name: /Reject/i });
        fireEvent.click(rejectButtons[1]);

        // Rejection Reason Confirmation Dialog opens
        expect(screen.getByText("Reject Tournament Proposal")).toBeInTheDocument();

        const reasonInput = screen.getByLabelText(/Rejection Reason \(Optional\)/i);
        fireEvent.change(reasonInput, {
            target: { value: "Duplicate event posting" },
        });

        const confirmButton = screen.getByRole("button", { name: /Confirm Rejection/i });
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(
                "/api/admin/tournaments/reject/prop-low-2",
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({ reason: "Duplicate event posting" }),
                })
            );
            expect(toast.success).toHaveBeenCalledWith(
                "Tournament proposal rejected"
            );
        });

        // prop-low-2 removed from view
        await waitFor(() => {
            expect(screen.queryByText("DMV Fall Racket Fest")).not.toBeInTheDocument();
        });
    });

    it("6. Save edits triggers PUT /:id with updated form data and updates state", async () => {
        apiFetch.mockImplementation(async (url, options) => {
            if (url === "/api/admin/tournaments/proposed") {
                return {
                    ok: true,
                    json: async () => [...mockProposals],
                };
            }
            if (url.includes("/api/admin/tournaments/prop-low-2") && options?.method === "PUT") {
                const body = JSON.parse(options.body);
                return {
                    ok: true,
                    json: async () => ({
                        message: "Tournament details updated successfully.",
                        proposedTournament: {
                            ...mockProposals[1],
                            ...body,
                        },
                    }),
                };
            }
            return { ok: true, json: async () => ({}) };
        });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText("DMV Fall Racket Fest")).toBeInTheDocument();
        });

        // Click Review on the second proposal (prop-low-2)
        const reviewButtons = screen.getAllByRole("button", { name: /Review/i });
        fireEvent.click(reviewButtons[1]);

        // Edit location input
        const locationInput = screen.getByLabelText(/Location \/ Venue/i);
        fireEvent.change(locationInput, {
            target: { value: "Capital Badminton Center" },
        });

        // Edit entry fee input
        const feeInput = screen.getByLabelText(/Entry Fee/i);
        fireEvent.change(feeInput, {
            target: { value: "$35" },
        });

        // Click Save Edits
        const saveButton = screen.getByRole("button", { name: /Save Edits/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(
                "/api/admin/tournaments/prop-low-2",
                expect.objectContaining({
                    method: "PUT",
                    body: expect.stringContaining("Capital Badminton Center"),
                })
            );
            expect(toast.success).toHaveBeenCalledWith(
                "Tournament details updated successfully."
            );
        });

        // Close review modal
        const closeButton = screen.getByLabelText("close");
        fireEvent.click(closeButton);

        // Check that updated location appears in the table
        await waitFor(() => {
            expect(screen.getByText("Capital Badminton Center")).toBeInTheDocument();
        });
    });

    it("6b. Admin can edit flyer image URL and raw post caption in review modal", async () => {
        let sentBody = null;
        apiFetch.mockImplementation(async (url, options) => {
            if (url === "/api/admin/tournaments/proposed") {
                return {
                    ok: true,
                    json: async () => [...mockProposals],
                };
            }
            if (url.includes("/api/admin/tournaments/prop-high-1") && options?.method === "PUT") {
                sentBody = JSON.parse(options.body);
                return {
                    ok: true,
                    json: async () => ({
                        message: "Tournament details updated successfully.",
                        proposedTournament: {
                            ...mockProposals[0],
                            ...sentBody,
                        },
                    }),
                };
            }
            return { ok: true, json: async () => ({}) };
        });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText("Mason Open 2026")).toBeInTheDocument();
        });

        // Open review modal
        const reviewButtons = screen.getAllByRole("button", { name: /Review/i });
        fireEvent.click(reviewButtons[0]);

        // Edit Flyer Image URL
        const flyerInput = screen.getByLabelText(/Flyer Image URL/i);
        fireEvent.change(flyerInput, {
            target: { value: "https://example.com/custom-flyer.png" },
        });

        // Edit Raw Caption
        const captionInput = screen.getByPlaceholderText(/Edit post caption or extracted flyer OCR context/i);
        fireEvent.change(captionInput, {
            target: { value: "Updated caption: Open to all regional badminton enthusiasts!" },
        });

        // Click Save Edits
        const saveButton = screen.getByRole("button", { name: /Save Edits/i });
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(sentBody).not.toBeNull();
            expect(sentBody.flyerImageUrl).toBe("https://example.com/custom-flyer.png");
            expect(sentBody.rawCaption).toBe("Updated caption: Open to all regional badminton enthusiasts!");
            expect(sentBody.scrapedImageUrls).toContain("https://example.com/custom-flyer.png");
        });
    });

    it("7. Manual entry button opens form, submits, and calls API", async () => {
        apiFetch.mockImplementation(async (url, options) => {
            if (url === "/api/admin/tournaments/proposed") {
                return {
                    ok: true,
                    json: async () => [...mockProposals],
                };
            }
            if (url === "/api/admin/tournaments/manual" && options?.method === "POST") {
                return {
                    ok: true,
                    json: async () => ({
                        message: "Tournament created successfully!",
                        tournament: { _id: "manual-tourney-1" },
                    }),
                };
            }
            return { ok: true, json: async () => ({}) };
        });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText("Tournament Approvals")).toBeInTheDocument();
        });

        // Click Manual Entry button
        const manualEntryBtn = screen.getByRole("button", { name: /Manual Entry/i });
        fireEvent.click(manualEntryBtn);

        // Manual Entry dialog is open
        expect(
            screen.getByText("Create Tournament (Manual Entry)")
        ).toBeInTheDocument();

        // Fill form fields
        const nameInput = screen.getByLabelText(/Tournament Name/i);
        fireEvent.change(nameInput, {
            target: { value: "GMU Spring Invitational 2026" },
        });

        const locationInput = screen.getByLabelText(/Location \/ Venue/i);
        fireEvent.change(locationInput, {
            target: { value: "EagleBank Arena" },
        });

        // Click submit in modal
        const submitButton = screen.getByRole("button", { name: /Create Tournament/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(
                "/api/admin/tournaments/manual",
                expect.objectContaining({
                    method: "POST",
                    body: expect.stringContaining("GMU Spring Invitational 2026"),
                })
            );
            expect(toast.success).toHaveBeenCalledWith(
                "Tournament created successfully!"
            );
        });
    });

    it("8. Empty queue state renders when no proposals exist", async () => {
        apiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [],
        });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText("Review Queue is Empty")).toBeInTheDocument();
        });

        expect(
            screen.getByText(/All scraped tournament proposals have been reviewed and processed/i)
        ).toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: /Refresh Queue/i })[0]).toBeInTheDocument();
    });

    it("9. Clicking Run Autonomous Hunter calls /run-hunt and refreshes the proposals", async () => {
        apiFetch.mockImplementation(async (url, options) => {
            if (url === "/api/admin/tournaments/proposed") {
                return {
                    ok: true,
                    json: async () => [],
                };
            }
            if (url === "/api/admin/tournaments/discovery-queue/run-hunt" && options?.method === "POST") {
                return {
                    ok: true,
                    json: async () => ({
                        message: "Autonomous Tournament Hunter completed cycle",
                        result: {
                            summary: {
                                addedToQueue: 2,
                                newProposalsCreated: 1,
                            },
                        },
                    }),
                };
            }
            return { ok: true, json: async () => ({}) };
        });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText("Review Queue is Empty")).toBeInTheDocument();
        });

        const hunterButtons = screen.getAllByRole("button", { name: /Run Autonomous Hunter/i });
        expect(hunterButtons.length).toBeGreaterThan(0);
        fireEvent.click(hunterButtons[0]);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(
                "/api/admin/tournaments/discovery-queue/run-hunt",
                expect.objectContaining({ method: "POST" })
            );
            expect(toast.success).toHaveBeenCalledWith(
                "Hunter complete: 2 queued, 1 proposed"
            );
        });
    });

    it("10. Switching to Discovery Queue tab renders discovered items and supports batch processing", async () => {
        const mockDiscoveryItems = [
            {
                _id: "disc-1",
                url: "https://www.tournamentsoftware.com/tournament/mid-atlantic",
                source: "tournamentsoftware",
                status: "pending",
                discoveredAt: "2026-10-12T10:00:00.000Z",
            },
        ];

        apiFetch.mockImplementation(async (url, options) => {
            if (url === "/api/admin/tournaments/proposed") {
                return { ok: true, json: async () => [] };
            }
            if (url.startsWith("/api/admin/tournaments/discovery-queue") && !url.includes("process") && !url.includes("run-hunt")) {
                return {
                    ok: true,
                    json: async () => ({
                        items: mockDiscoveryItems,
                        totalCount: 1,
                    }),
                };
            }
            if (url === "/api/admin/tournaments/discovery-queue/process" && options?.method === "POST") {
                return {
                    ok: true,
                    json: async () => ({
                        message: "Discovery queue processing complete",
                        result: {
                            processedCount: 1,
                            proposalsCreated: 1,
                        },
                    }),
                };
            }
            return { ok: true, json: async () => ({}) };
        });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText("Discovery Queue")).toBeInTheDocument();
        });

        // Click Discovery Queue tab
        fireEvent.click(screen.getByText("Discovery Queue"));

        await waitFor(() => {
            expect(screen.getByText("https://www.tournamentsoftware.com/tournament/mid-atlantic")).toBeInTheDocument();
        });

        // Click Process Next Batch
        const processBtn = screen.getByRole("button", { name: /Process Next Batch/i });
        fireEvent.click(processBtn);

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(
                "/api/admin/tournaments/discovery-queue/process",
                expect.objectContaining({ method: "POST" })
            );
            expect(toast.success).toHaveBeenCalledWith(
                "Processed 1 items (1 proposals generated)"
            );
        });
    });

    it("11. Renders warning alert and Use Verified Fallback button when proposal has expired linkStatus", async () => {
        const expiredProposal = {
            ...mockProposals[0],
            _id: "prop-expired-1",
            tournamentName: "NVBC Fall Smash 2026",
            linkStatus: "expired",
            linkStatusCode: 404,
            registrationLink: "https://novabadmintonacademy.com/events/smash-open-2026",
            fallbackRegistrationUrl: "https://novabadmintonacademy.com/",
        };

        apiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [expiredProposal],
        });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText("NVBC Fall Smash 2026")).toBeInTheDocument();
        });

        // Open review modal
        const reviewBtn = screen.getByRole("button", { name: /Review/i });
        fireEvent.click(reviewBtn);

        // Warning alert should be rendered
        expect(screen.getByTestId("expired-link-alert")).toBeInTheDocument();
        expect(screen.getByText(/Registration link is expired or broken/i)).toBeInTheDocument();

        // Check registration link initially has the broken URL
        const regLinkInput = screen.getByLabelText(/Registration Link \/ URL/i);
        expect(regLinkInput).toHaveValue("https://novabadmintonacademy.com/events/smash-open-2026");

        // Click "Use Verified Fallback" button
        const fallbackBtn = screen.getByTestId("btn-use-verified-fallback");
        expect(fallbackBtn).toBeInTheDocument();
        fireEvent.click(fallbackBtn);

        // Input field should now have the fallback URL
        expect(regLinkInput).toHaveValue("https://novabadmintonacademy.com/");
    });

    it("12. Renders disabled fallback button when proposal has expired linkStatus without fallbackRegistrationUrl", async () => {
        const expiredProposalNoFallback = {
            ...mockProposals[0],
            _id: "prop-expired-no-fallback",
            tournamentName: "DMV Spring Open 2026",
            linkStatus: "expired",
            linkStatusCode: 410,
            registrationLink: "https://badmintonclub.org/old-event",
            fallbackRegistrationUrl: "",
        };

        apiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => [expiredProposalNoFallback],
        });

        renderComponent();

        await waitFor(() => {
            expect(screen.getByText("DMV Spring Open 2026")).toBeInTheDocument();
        });

        const reviewBtn = screen.getByRole("button", { name: /Review/i });
        fireEvent.click(reviewBtn);

        expect(screen.getByTestId("expired-link-alert")).toBeInTheDocument();
        const fallbackBtn = screen.getByTestId("btn-use-verified-fallback");
        expect(fallbackBtn).toBeInTheDocument();
        expect(fallbackBtn).toBeDisabled();
        expect(screen.getByText(/No verified fallback URL registered/i)).toBeInTheDocument();
    });
});


