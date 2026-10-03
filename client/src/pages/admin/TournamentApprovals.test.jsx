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
});
