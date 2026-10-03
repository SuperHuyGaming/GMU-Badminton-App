// client/src/pages/admin/TournamentApprovals.jsx
import { useState, useEffect, useCallback } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Alert,
    CircularProgress,
    IconButton,
    Checkbox,
    Grid,
    Link,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { toast } from "react-hot-toast";

import apiFetch from "../../utils/api";

const formatDateForInput = (dateVal) => {
    if (!dateVal) return "";
    try {
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
    } catch {
        return "";
    }
};

const formatDateForDisplay = (dateVal) => {
    if (!dateVal) return "TBD";
    try {
        const d = new Date(dateVal);
        return isNaN(d.getTime())
            ? "TBD"
            : d.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
              });
    } catch {
        return "TBD";
    }
};

const extractDomain = (url) => {
    if (!url) return "Unknown";
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
};

const initialManualForm = {
    tournamentName: "",
    startDate: "",
    endDate: "",
    eventLocation: "",
    entryFee: "",
    registrationUrl: "",
    registrationDeadline: "",
    flyerImageUrl: "",
    skillLevels: "",
    originalCaption: "",
};

export default function TournamentApprovals() {
    const [proposals, setProposals] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProposal, setSelectedProposal] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Edit form state for split-screen reviewer
    const [editForm, setEditForm] = useState({
        tournamentName: "",
        date: "",
        location: "",
        entryFee: "",
        registrationLink: "",
        skillLevels: "",
        registrationDeadline: "",
        confidenceScore: 0,
    });

    // Reject reason dialog state
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectTargetId, setRejectTargetId] = useState(null);
    const [rejectionReason, setRejectionReason] = useState("");

    // Manual Entry modal state
    const [manualModalOpen, setManualModalOpen] = useState(false);
    const [manualForm, setManualForm] = useState(initialManualForm);
    const [submittingManual, setSubmittingManual] = useState(false);

    const handleSelectAllClick = (event) => {
        if (event.target.checked) {
            const newSelecteds = proposals.map((n) => n._id);
            setSelectedIds(newSelecteds);
            return;
        }
        setSelectedIds([]);
    };

    const handleSelectClick = (event, id) => {
        const selectedIndex = selectedIds.indexOf(id);
        let newSelected = [];

        if (selectedIndex === -1) {
            newSelected = newSelected.concat(selectedIds, id);
        } else if (selectedIndex === 0) {
            newSelected = newSelected.concat(selectedIds.slice(1));
        } else if (selectedIndex === selectedIds.length - 1) {
            newSelected = newSelected.concat(selectedIds.slice(0, -1));
        } else if (selectedIndex > 0) {
            newSelected = newSelected.concat(
                selectedIds.slice(0, selectedIndex),
                selectedIds.slice(selectedIndex + 1)
            );
        }
        setSelectedIds(newSelected);
    };

    const handleBulkApprove = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to approve ${selectedIds.length} proposals?`)) return;
        try {
            await Promise.all(selectedIds.map(id => apiFetch(`/api/admin/tournaments/approve/${id}`, { method: 'POST' })));
            toast.success(`${selectedIds.length} proposals approved`);
            fetchProposals();
        } catch (err) {
            toast.error(err.message || 'Failed to bulk approve');
        }
    };
    
    const handleBulkReject = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to reject ${selectedIds.length} proposals?`)) return;
        try {
            await Promise.all(selectedIds.map(id => apiFetch(`/api/admin/tournaments/reject/${id}`, { method: 'POST' })));
            toast.success(`${selectedIds.length} proposals rejected`);
            fetchProposals();
        } catch (err) {
            toast.error(err.message || 'Failed to bulk reject');
        }
    };

    const fetchProposals = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiFetch("/api/admin/tournaments/proposed");
            const data = await res.json();
            setProposals(Array.isArray(data) ? data : []);
            setSelectedIds([]);
        } catch (err) {
            toast.error(err.message || "Failed to load tournament proposals");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
         
        fetchProposals();
    }, [fetchProposals]);

    const handleOpenReview = (proposal) => {
        setSelectedProposal(proposal);
        setEditForm({
            tournamentName: proposal.tournamentName || "",
            date: formatDateForInput(proposal.date),
            location: proposal.location || "",
            entryFee: proposal.entryFee || "",
            registrationLink: proposal.registrationLink || "",
            skillLevels: Array.isArray(proposal.skillLevels)
                ? proposal.skillLevels.join(", ")
                : proposal.skillLevels || "",
            registrationDeadline: formatDateForInput(proposal.registrationDeadline),
            confidenceScore: proposal.confidenceScore ?? 0,
        });
    };

    const handleCloseReview = () => {
        if (!submitting) {
            setSelectedProposal(null);
        }
    };

    const handleSaveEdits = async () => {
        if (!selectedProposal) return;
        if (!editForm.tournamentName.trim()) {
            toast.error("Tournament name cannot be empty.");
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                tournamentName: editForm.tournamentName.trim(),
                location: editForm.location.trim() || "TBD",
                entryFee: editForm.entryFee.trim(),
                registrationLink: editForm.registrationLink.trim(),
                skillLevels: editForm.skillLevels
                    ? editForm.skillLevels
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                    : [],
                date: editForm.date ? new Date(editForm.date).toISOString() : undefined,
                registrationDeadline: editForm.registrationDeadline
                    ? new Date(editForm.registrationDeadline).toISOString()
                    : undefined,
                confidenceScore: Number(editForm.confidenceScore),
            };

            const res = await apiFetch(`/api/admin/tournaments/${selectedProposal._id}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            toast.success(data.message || "Tournament details updated successfully.");

            const updated = data.proposedTournament || {
                ...selectedProposal,
                ...payload,
            };
            setSelectedProposal(updated);
            setProposals((prev) =>
                prev.map((p) => (p._id === selectedProposal._id ? { ...p, ...updated } : p))
            );
        } catch (err) {
            toast.error(err.message || "Failed to save tournament edits");
        } finally {
            setSubmitting(false);
        }
    };

    const handleApprove = async (id) => {
        const targetId = id || selectedProposal?._id;
        if (!targetId) return;

        try {
            setSubmitting(true);
            const res = await apiFetch(`/api/admin/tournaments/approve/${targetId}`, {
                method: "POST",
            });
            const data = await res.json();
            toast.success(data.message || "Tournament approved and published!");
            setProposals((prev) => prev.filter((p) => p._id !== targetId));
            if (selectedProposal && selectedProposal._id === targetId) {
                setSelectedProposal(null);
            }
        } catch (err) {
            toast.error(err.message || "Failed to approve tournament");
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenRejectDialog = (id) => {
        setRejectTargetId(id || selectedProposal?._id);
        setRejectionReason("");
        setRejectDialogOpen(true);
    };

    const handleConfirmReject = async () => {
        if (!rejectTargetId) return;

        try {
            setSubmitting(true);
            const payload = rejectionReason.trim() ? { reason: rejectionReason.trim() } : {};
            const res = await apiFetch(`/api/admin/tournaments/reject/${rejectTargetId}`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            toast.success(data.message || "Tournament proposal rejected");
            setProposals((prev) => prev.filter((p) => p._id !== rejectTargetId));
            setRejectDialogOpen(false);
            setRejectionReason("");
            if (selectedProposal && selectedProposal._id === rejectTargetId) {
                setSelectedProposal(null);
            }
        } catch (err) {
            toast.error(err.message || "Failed to reject tournament");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateManualTournament = async () => {
        if (!manualForm.tournamentName.trim()) {
            toast.error("Tournament name is required.");
            return;
        }

        try {
            setSubmittingManual(true);
            const payload = {
                tournamentName: manualForm.tournamentName.trim(),
                eventLocation: manualForm.eventLocation.trim() || "TBD",
                startDate: manualForm.startDate ? new Date(manualForm.startDate).toISOString() : undefined,
                endDate: manualForm.endDate ? new Date(manualForm.endDate).toISOString() : undefined,
                registrationDeadline: manualForm.registrationDeadline
                    ? new Date(manualForm.registrationDeadline).toISOString()
                    : undefined,
                registrationUrl: manualForm.registrationUrl.trim(),
                flyerImageUrl: manualForm.flyerImageUrl.trim(),
                skillLevels: manualForm.skillLevels
                    ? manualForm.skillLevels
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                    : [],
                originalCaption: manualForm.originalCaption.trim(),
                entryFee: manualForm.entryFee.trim(),
            };

            const res = await apiFetch("/api/admin/tournaments/manual", {
                method: "POST",
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            toast.success(data.message || "Tournament created successfully!");
            setManualModalOpen(false);
            setManualForm(initialManualForm);
        } catch (err) {
            toast.error(err.message || "Failed to create tournament manually");
        } finally {
            setSubmittingManual(false);
        }
    };

    const hasLowConfidence = proposals.some((p) => (p.confidenceScore ?? 0) < 80);

    return (
        <Box sx={{ width: "100%", pb: 8 }}>
            {/* Top Navigation Bar / Breadcrumb */}
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 3,
                    flexWrap: "wrap",
                    gap: 2,
                }}
            >
                <Box>
                    <Button
                        component={RouterLink}
                        to="/admin"
                        startIcon={<ArrowBackIcon />}
                        sx={{ textTransform: "none", color: "text.secondary", mb: 1, pl: 0 }}
                    >
                        Back to Admin Moderation Hub
                    </Button>
                    <Typography
                        variant="h4"
                        component="h1"
                        fontWeight="900"
                        color="text.primary"
                    >
                        Tournament Approvals
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Review, edit, and approve AI-scraped tournaments before publishing them to the public feed.
                    </Typography>
                </Box>

                <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                    {selectedIds.length > 0 && (
                        <>
                            <Button variant="contained" color="success" onClick={handleBulkApprove} sx={{ textTransform: "none", fontWeight: "bold" }}>
                                Approve ({selectedIds.length})
                            </Button>
                            <Button variant="contained" color="error" onClick={handleBulkReject} sx={{ textTransform: "none", fontWeight: "bold" }}>
                                Reject ({selectedIds.length})
                            </Button>
                        </>
                    )}
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={fetchProposals}
                        disabled={loading}
                        sx={{ textTransform: "none", fontWeight: "bold" }}
                    >
                        Refresh Queue
                    </Button>
                    <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<AddIcon />}
                        onClick={() => setManualModalOpen(true)}
                        sx={{
                            textTransform: "none",
                            fontWeight: "bold",
                            backgroundColor: "#FFCC33",
                            color: "#1a202c",
                            "&:hover": { backgroundColor: "#e6b800" },
                        }}
                    >
                        Manual Entry
                    </Button>
                </Box>
            </Box>

            {/* Low Confidence Queue-Wide Alert Banner */}
            {!loading && hasLowConfidence && (
                <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                    Low confidence proposals detected (below 80%). Please review flyer and caption context carefully before approving.
                </Alert>
            )}

            {/* Review Queue Content */}
            {loading ? (
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        minHeight: 280,
                    }}
                >
                    <CircularProgress color="primary" />
                </Box>
            ) : proposals.length === 0 ? (
                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: 4, md: 6 },
                        textAlign: "center",
                        borderRadius: 4,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: "background.paper",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
                        <svg
                            width="80"
                            height="80"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#FFCC33"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                            <path d="M4 22h16" />
                            <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
                            <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
                            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                        </svg>
                    </Box>
                    <Typography
                        variant="h5"
                        fontWeight="bold"
                        gutterBottom
                        color="text.primary"
                    >
                        Review Queue is Empty
                    </Typography>
                    <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{ maxWidth: 500, mb: 3 }}
                    >
                        All scraped tournament proposals have been reviewed and processed. New proposals will appear here automatically when detected by the scraping engine.
                    </Typography>
                    <Box sx={{ display: "flex", gap: 2 }}>
                        <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={fetchProposals}
                            sx={{ textTransform: "none", fontWeight: "bold" }}
                        >
                            Refresh Queue
                        </Button>
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<AddIcon />}
                            onClick={() => setManualModalOpen(true)}
                            sx={{
                                textTransform: "none",
                                fontWeight: "bold",
                                backgroundColor: "#FFCC33",
                                color: "#1a202c",
                                "&:hover": { backgroundColor: "#e6b800" },
                            }}
                        >
                            Manual Entry
                        </Button>
                    </Box>
                </Paper>
            ) : (
                <TableContainer
                    component={Paper}
                    elevation={0}
                    sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 3,
                        overflow: "hidden",
                    }}
                >
                    <Table aria-label="pending tournament proposals table">
                        <TableHead sx={{ bgcolor: "background.default" }}>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        color="primary"
                                        indeterminate={selectedIds.length > 0 && selectedIds.length < proposals.length}
                                        checked={proposals.length > 0 && selectedIds.length === proposals.length}
                                        onChange={handleSelectAllClick}
                                    />
                                </TableCell>
                                <TableCell sx={{ fontWeight: "bold" }}>Tournament Name</TableCell>
                                <TableCell sx={{ fontWeight: "bold" }}>Date</TableCell>
                                <TableCell sx={{ fontWeight: "bold" }}>Location</TableCell>
                                <TableCell sx={{ fontWeight: "bold" }}>Fee</TableCell>
                                <TableCell sx={{ fontWeight: "bold" }}>Source</TableCell>
                                <TableCell sx={{ fontWeight: "bold" }}>Confidence</TableCell>
                                <TableCell align="right" sx={{ fontWeight: "bold" }}>
                                    Actions
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {proposals.map((proposal) => {
                                const isLowConfidence = (proposal.confidenceScore ?? 0) < 80;
                                const confidenceColor =
                                    (proposal.confidenceScore ?? 0) >= 80
                                        ? "success"
                                        : (proposal.confidenceScore ?? 0) >= 60
                                        ? "warning"
                                        : "error";

                                return (
                                    <TableRow
                                        key={proposal._id}
                                        hover
                                        sx={{
                                            borderLeft: isLowConfidence
                                                ? "4px solid #E65100"
                                                : "4px solid transparent",
                                            backgroundColor: isLowConfidence
                                                ? "rgba(230, 81, 0, 0.04)"
                                                : "inherit",
                                        }}
                                    >
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                color="primary"
                                                checked={selectedIds.indexOf(proposal._id) !== -1}
                                                onChange={(event) => handleSelectClick(event, proposal._id)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography
                                                variant="body1"
                                                fontWeight="bold"
                                                color="text.primary"
                                            >
                                                {proposal.tournamentName}
                                            </Typography>
                                            {isLowConfidence && (
                                                <Typography
                                                    variant="caption"
                                                    color="warning.main"
                                                    fontWeight="bold"
                                                >
                                                    Attention required
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {formatDateForDisplay(proposal.date)}
                                        </TableCell>
                                        <TableCell>
                                            {proposal.location || "TBD"}
                                        </TableCell>
                                        <TableCell>
                                            {proposal.entryFee || "Free / Unspecified"}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={extractDomain(proposal.sourceUrl)}
                                                size="small"
                                                variant="outlined"
                                                component="a"
                                                href={proposal.sourceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                clickable
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={`${proposal.confidenceScore ?? 0}%`}
                                                color={confidenceColor}
                                                size="small"
                                                sx={{ fontWeight: "bold" }}
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    justifyContent: "flex-end",
                                                    gap: 1,
                                                }}
                                            >
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="primary"
                                                    startIcon={<VisibilityIcon />}
                                                    onClick={() => handleOpenReview(proposal)}
                                                    sx={{ textTransform: "none", fontWeight: "bold" }}
                                                >
                                                    Review
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    color="success"
                                                    startIcon={<CheckCircleIcon />}
                                                    onClick={() => handleApprove(proposal._id)}
                                                    disabled={submitting}
                                                    sx={{ textTransform: "none", fontWeight: "bold" }}
                                                >
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="error"
                                                    startIcon={<HighlightOffIcon />}
                                                    onClick={() => handleOpenRejectDialog(proposal._id)}
                                                    disabled={submitting}
                                                    sx={{ textTransform: "none", fontWeight: "bold" }}
                                                >
                                                    Reject
                                                </Button>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Split-Screen Reviewer Modal */}
            <Dialog
                open={Boolean(selectedProposal)}
                onClose={handleCloseReview}
                maxWidth="lg"
                fullWidth
                aria-labelledby="split-screen-reviewer-dialog-title"
                slotProps={{
                    paper: {
                        sx: {
                            borderRadius: 3,
                            maxHeight: "90vh",
                            display: "flex",
                            flexDirection: "column",
                        },
                    },
                }}
            >
                {selectedProposal && (
                    <>
                        <DialogTitle
                            id="split-screen-reviewer-dialog-title"
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                pb: 1,
                                borderBottom: "1px solid",
                                borderColor: "divider",
                            }}
                        >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                                <Box component="span" sx={{ fontSize: "1.25rem", fontWeight: "bold" }}>
                                    {selectedProposal.tournamentName}
                                </Box>
                                <Chip
                                    label={`${selectedProposal.confidenceScore ?? 0}% Confidence`}
                                    color={
                                        (selectedProposal.confidenceScore ?? 0) >= 80
                                            ? "success"
                                            : (selectedProposal.confidenceScore ?? 0) >= 60
                                            ? "warning"
                                            : "error"
                                    }
                                    size="small"
                                    sx={{ fontWeight: "bold" }}
                                />
                            </Box>
                            <IconButton
                                aria-label="close"
                                onClick={handleCloseReview}
                                disabled={submitting}
                                size="small"
                            >
                                <CloseIcon />
                            </IconButton>
                        </DialogTitle>

                        <DialogContent dividers sx={{ p: 0, flexGrow: 1, overflowY: "auto" }}>
                            <Grid container sx={{ minHeight: "100%" }}>
                                {/* Left Side: Raw Scraped Context */}
                                <Grid
                                    size={{ xs: 12, md: 6 }}
                                    sx={{
                                        p: 3,
                                        borderRight: { md: "1px solid" },
                                        borderColor: "divider",
                                        overflowY: "auto",
                                        maxHeight: { md: "calc(90vh - 140px)" },
                                    }}
                                >
                                    <Typography variant="h6" fontWeight="bold" gutterBottom color="primary">
                                        Raw Scraped Context
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        Visual and textual information extracted by the web scraper.
                                    </Typography>

                                    {/* Scraped Flyer Image */}
                                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                        Flyer Image Preview:
                                    </Typography>
                                    {selectedProposal.scrapedImageUrls &&
                                    selectedProposal.scrapedImageUrls.length > 0 &&
                                    selectedProposal.scrapedImageUrls[0] ? (
                                        <Box
                                            component="img"
                                            src={selectedProposal.scrapedImageUrls[0]}
                                            alt="Scraped Tournament Flyer"
                                            sx={{
                                                width: "100%",
                                                maxHeight: 260,
                                                objectFit: "contain",
                                                borderRadius: 2,
                                                bgcolor: "background.default",
                                                border: "1px solid",
                                                borderColor: "divider",
                                                mb: 2,
                                            }}
                                        />
                                    ) : (
                                        <Box
                                            sx={{
                                                p: 3,
                                                textAlign: "center",
                                                bgcolor: "background.default",
                                                borderRadius: 2,
                                                mb: 2,
                                                border: "1px dashed",
                                                borderColor: "divider",
                                            }}
                                        >
                                            <Typography variant="body2" color="text.secondary">
                                                No flyer image captured for this proposal.
                                            </Typography>
                                        </Box>
                                    )}

                                    {/* Raw Caption Box */}
                                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                        Raw Post Caption / OCR Text:
                                    </Typography>
                                    <Paper
                                        variant="outlined"
                                        sx={{
                                            p: 2,
                                            mb: 2,
                                            maxHeight: 180,
                                            overflowY: "auto",
                                            bgcolor: "background.default",
                                            fontFamily: "monospace",
                                            fontSize: "0.85rem",
                                            whiteSpace: "pre-wrap",
                                            wordBreak: "break-word",
                                        }}
                                    >
                                        {selectedProposal.rawCaption || "No raw caption text available."}
                                    </Paper>

                                    {/* Source URLs & Links */}
                                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                        Source Post:
                                    </Typography>
                                    <Box sx={{ mb: 2 }}>
                                        <Link
                                            href={selectedProposal.sourceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            underline="hover"
                                            sx={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 0.5,
                                                wordBreak: "break-all",
                                            }}
                                        >
                                            {selectedProposal.sourceUrl}
                                            <OpenInNewIcon fontSize="inherit" />
                                        </Link>
                                    </Box>

                                    {selectedProposal.sourceLinks &&
                                        selectedProposal.sourceLinks.length > 0 && (
                                            <>
                                                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                                    Extracted Source Links:
                                                </Typography>
                                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                                                    {selectedProposal.sourceLinks.map((link, idx) => (
                                                        <Chip
                                                            key={idx}
                                                            label={link}
                                                            component="a"
                                                            href={link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            size="small"
                                                            variant="outlined"
                                                            clickable
                                                        />
                                                    ))}
                                                </Box>
                                            </>
                                        )}
                                </Grid>

                                {/* Right Side: Editable AI Extracted Form */}
                                <Grid
                                    size={{ xs: 12, md: 6 }}
                                    sx={{
                                        p: 3,
                                        overflowY: "auto",
                                        maxHeight: { md: "calc(90vh - 140px)" },
                                    }}
                                >
                                    <Typography variant="h6" fontWeight="bold" gutterBottom color="primary">
                                        Extracted AI Data (Editable)
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        Verify and edit the structured fields before saving or publishing.
                                    </Typography>

                                    {(selectedProposal.confidenceScore ?? 0) < 80 && (
                                        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                                            Low confidence AI extraction ({selectedProposal.confidenceScore}%). Please double-check dates, location, and registration links against the flyer context.
                                        </Alert>
                                    )}

                                    <TextField
                                        label="Tournament Name"
                                        required
                                        fullWidth
                                        size="small"
                                        margin="normal"
                                        value={editForm.tournamentName}
                                        onChange={(e) =>
                                            setEditForm({ ...editForm, tournamentName: e.target.value })
                                        }
                                    />

                                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <TextField
                                                label="Tournament Date"
                                                type="date"
                                                fullWidth
                                                size="small"
                                                slotProps={{ inputLabel: { shrink: true } }}
                                                value={editForm.date}
                                                onChange={(e) =>
                                                    setEditForm({ ...editForm, date: e.target.value })
                                                }
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <TextField
                                                label="Registration Deadline"
                                                type="date"
                                                fullWidth
                                                size="small"
                                                slotProps={{ inputLabel: { shrink: true } }}
                                                value={editForm.registrationDeadline}
                                                onChange={(e) =>
                                                    setEditForm({
                                                        ...editForm,
                                                        registrationDeadline: e.target.value,
                                                    })
                                                }
                                            />
                                        </Grid>
                                    </Grid>

                                    <TextField
                                        label="Location / Venue"
                                        fullWidth
                                        size="small"
                                        margin="normal"
                                        value={editForm.location}
                                        onChange={(e) =>
                                            setEditForm({ ...editForm, location: e.target.value })
                                        }
                                    />

                                    <TextField
                                        label="Entry Fee"
                                        placeholder="e.g. $35/event, Free"
                                        fullWidth
                                        size="small"
                                        margin="normal"
                                        value={editForm.entryFee}
                                        onChange={(e) =>
                                            setEditForm({ ...editForm, entryFee: e.target.value })
                                        }
                                    />

                                    <TextField
                                        label="Registration Link / URL"
                                        fullWidth
                                        size="small"
                                        margin="normal"
                                        value={editForm.registrationLink}
                                        onChange={(e) =>
                                            setEditForm({
                                                ...editForm,
                                                registrationLink: e.target.value,
                                            })
                                        }
                                    />

                                    <TextField
                                        label="Skill Levels (comma separated)"
                                        placeholder="e.g. Open, Intermediate, Beginner"
                                        fullWidth
                                        size="small"
                                        margin="normal"
                                        value={editForm.skillLevels}
                                        onChange={(e) =>
                                            setEditForm({ ...editForm, skillLevels: e.target.value })
                                        }
                                    />

                                    <TextField
                                        label="Confidence Score (0 - 100)"
                                        type="number"
                                        fullWidth
                                        size="small"
                                        margin="normal"
                                        slotProps={{ htmlInput: { min: 0, max: 100 } }}
                                        value={editForm.confidenceScore}
                                        onChange={(e) =>
                                            setEditForm({
                                                ...editForm,
                                                confidenceScore: Number(e.target.value),
                                            })
                                        }
                                    />
                                </Grid>
                            </Grid>
                        </DialogContent>

                        <DialogActions
                            sx={{
                                p: 2,
                                px: 3,
                                justifyContent: "space-between",
                                borderTop: "1px solid",
                                borderColor: "divider",
                            }}
                        >
                            <Box sx={{ display: "flex", gap: 1 }}>
                                <Button
                                    variant="outlined"
                                    color="primary"
                                    onClick={handleSaveEdits}
                                    disabled={submitting}
                                    sx={{ textTransform: "none", fontWeight: "bold" }}
                                >
                                    {submitting ? "Saving..." : "Save Edits"}
                                </Button>
                            </Box>
                            <Box sx={{ display: "flex", gap: 1.5 }}>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    onClick={() => handleOpenRejectDialog(selectedProposal._id)}
                                    disabled={submitting}
                                    sx={{ textTransform: "none", fontWeight: "bold" }}
                                >
                                    Reject
                                </Button>
                                <Button
                                    variant="contained"
                                    color="success"
                                    onClick={() => handleApprove(selectedProposal._id)}
                                    disabled={submitting}
                                    sx={{ textTransform: "none", fontWeight: "bold" }}
                                >
                                    {submitting ? "Approving..." : "Approve & Publish"}
                                </Button>
                            </Box>
                        </DialogActions>
                    </>
                )}
            </Dialog>

            {/* Rejection Reason Confirmation Dialog */}
            <Dialog
                open={rejectDialogOpen}
                onClose={() => !submitting && setRejectDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                aria-labelledby="reject-dialog-title"
                slotProps={{ paper: { sx: { borderRadius: 3 } } }}
            >
                <DialogTitle id="reject-dialog-title">Reject Tournament Proposal</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Optionally provide a reason for rejecting this tournament proposal.
                    </Typography>
                    <TextField
                        fullWidth
                        label="Rejection Reason (Optional)"
                        placeholder="e.g. Duplicate posting, cancelled tournament, incomplete flyer info"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        multiline
                        rows={3}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button
                        onClick={() => setRejectDialogOpen(false)}
                        disabled={submitting}
                        sx={{ textTransform: "none" }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleConfirmReject}
                        disabled={submitting}
                        sx={{ textTransform: "none", fontWeight: "bold" }}
                    >
                        {submitting ? "Rejecting..." : "Confirm Rejection"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Manual Tournament Creation Dialog */}
            <Dialog
                open={manualModalOpen}
                onClose={() => !submittingManual && setManualModalOpen(false)}
                maxWidth="md"
                fullWidth
                aria-labelledby="manual-entry-dialog-title"
                slotProps={{ paper: { sx: { borderRadius: 3 } } }}
            >
                <DialogTitle
                    id="manual-entry-dialog-title"
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <Box component="span" sx={{ fontSize: "1.25rem", fontWeight: "bold" }}>
                        Create Tournament (Manual Entry)
                    </Box>
                    <IconButton
                        aria-label="close"
                        onClick={() => setManualModalOpen(false)}
                        disabled={submittingManual}
                        size="small"
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent dividers>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Directly publish a tournament to the active listings without going through the web scraper.
                    </Typography>

                    <TextField
                        label="Tournament Name"
                        required
                        fullWidth
                        size="small"
                        margin="normal"
                        value={manualForm.tournamentName}
                        onChange={(e) =>
                            setManualForm({ ...manualForm, tournamentName: e.target.value })
                        }
                    />

                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                label="Start Date"
                                type="date"
                                fullWidth
                                size="small"
                                slotProps={{ inputLabel: { shrink: true } }}
                                value={manualForm.startDate}
                                onChange={(e) =>
                                    setManualForm({ ...manualForm, startDate: e.target.value })
                                }
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                label="End Date"
                                type="date"
                                fullWidth
                                size="small"
                                slotProps={{ inputLabel: { shrink: true } }}
                                value={manualForm.endDate}
                                onChange={(e) =>
                                    setManualForm({ ...manualForm, endDate: e.target.value })
                                }
                            />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                label="Location / Venue"
                                fullWidth
                                size="small"
                                value={manualForm.eventLocation}
                                onChange={(e) =>
                                    setManualForm({ ...manualForm, eventLocation: e.target.value })
                                }
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                label="Entry Fee"
                                placeholder="e.g. $25/event"
                                fullWidth
                                size="small"
                                value={manualForm.entryFee}
                                onChange={(e) =>
                                    setManualForm({ ...manualForm, entryFee: e.target.value })
                                }
                            />
                        </Grid>
                    </Grid>

                    <TextField
                        label="Registration Link / URL"
                        fullWidth
                        size="small"
                        margin="normal"
                        value={manualForm.registrationUrl}
                        onChange={(e) =>
                            setManualForm({ ...manualForm, registrationUrl: e.target.value })
                        }
                    />

                    <TextField
                        label="Registration Deadline"
                        type="date"
                        fullWidth
                        size="small"
                        margin="normal"
                        slotProps={{ inputLabel: { shrink: true } }}
                        value={manualForm.registrationDeadline}
                        onChange={(e) =>
                            setManualForm({
                                ...manualForm,
                                registrationDeadline: e.target.value,
                            })
                        }
                    />

                    <TextField
                        label="Flyer Image URL"
                        placeholder="https://..."
                        fullWidth
                        size="small"
                        margin="normal"
                        value={manualForm.flyerImageUrl}
                        onChange={(e) =>
                            setManualForm({ ...manualForm, flyerImageUrl: e.target.value })
                        }
                    />

                    <TextField
                        label="Skill Levels (comma separated)"
                        placeholder="e.g. Open, Intermediate, Beginner"
                        fullWidth
                        size="small"
                        margin="normal"
                        value={manualForm.skillLevels}
                        onChange={(e) =>
                            setManualForm({ ...manualForm, skillLevels: e.target.value })
                        }
                    />

                    <TextField
                        label="Description / Caption Notes"
                        multiline
                        rows={3}
                        fullWidth
                        size="small"
                        margin="normal"
                        value={manualForm.originalCaption}
                        onChange={(e) =>
                            setManualForm({
                                ...manualForm,
                                originalCaption: e.target.value,
                            })
                        }
                    />
                </DialogContent>

                <DialogActions sx={{ p: 2, px: 3 }}>
                    <Button
                        onClick={() => setManualModalOpen(false)}
                        disabled={submittingManual}
                        sx={{ textTransform: "none" }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="secondary"
                        onClick={handleCreateManualTournament}
                        disabled={submittingManual}
                        sx={{
                            textTransform: "none",
                            fontWeight: "bold",
                            backgroundColor: "#FFCC33",
                            color: "#1a202c",
                            "&:hover": { backgroundColor: "#e6b800" },
                        }}
                    >
                        {submittingManual ? "Creating..." : "Create Tournament"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
