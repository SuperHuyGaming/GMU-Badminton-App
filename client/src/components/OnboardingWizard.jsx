// client/src/components/OnboardingWizard.jsx
import React, { useState } from "react";
import {
	Box,
	Typography,
	TextField,
	MenuItem,
	Button,
	Stepper,
	Step,
	StepLabel,
	Paper,
	Avatar,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import apiFetch from "../utils/api";
import { useAuth } from "../context/AuthContext";

const steps = ["Welcome", "Your Info", "Play Style", "Ready!"];

const skillLevels = [
	"A Level",
	"B Level",
	"C Level",
	"D Level",
	"E Level",
	"Beginner",
];

const playStyles = ["Singles", "Doubles", "Mixed Doubles", "Any"];

const slideVariants = {
	enter: (direction) => ({ x: direction > 0 ? 200 : -200, opacity: 0 }),
	center: { x: 0, opacity: 1 },
	exit: (direction) => ({ x: direction < 0 ? 200 : -200, opacity: 0 }),
};

export default function OnboardingWizard({ onComplete }) {
	const { user, updateUser, setToastMessage } = useAuth();
	const [activeStep, setActiveStep] = useState(0);
	const [direction, setDirection] = useState(1);
	const [saving, setSaving] = useState(false);
	const [formData, setFormData] = useState({
		name: user?.name || "",
		skillLevel: "D Level",
		preferredPlay: "Any",
		racket: "",
		bio: "",
	});

	const handleChange = (e) =>
		setFormData({ ...formData, [e.target.name]: e.target.value });

	const handleNext = () => {
		setDirection(1);
		setActiveStep((prev) => prev + 1);
	};

	const handleBack = () => {
		setDirection(-1);
		setActiveStep((prev) => prev - 1);
	};

	const handleFinish = async () => {
		setSaving(true);
		try {
			const res = await apiFetch("/api/profile", {
				method: "PUT",
				body: JSON.stringify({ ...formData, onboardingComplete: true }),
			});
			if (res.ok) {
				const updatedUser = await res.json();
				updateUser({ ...user, ...updatedUser, onboardingComplete: true });
				localStorage.setItem("onboardingComplete", "true");
				setToastMessage("Profile setup complete! Welcome to the community 🏸");
				onComplete?.();
			}
		} catch (err) {
			console.error("Onboarding save failed:", err);
		} finally {
			setSaving(false);
		}
	};

	const renderStepContent = (step) => {
		switch (step) {
			case 0:
				return (
					<Box sx={{ textAlign: "center", py: 3 }}>
						<Typography variant="h3" sx={{ mb: 1 }}>🏸</Typography>
						<Typography variant="h5" fontWeight="bold" gutterBottom>
							Welcome to Mason Badminton Connect!
						</Typography>
						<Typography color="text.secondary" sx={{ maxWidth: 400, mx: "auto" }}>
							Let&apos;s set up your player profile in 3 quick steps so other
							players can find and challenge you.
						</Typography>
					</Box>
				);
			case 1:
				return (
					<Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
						<Typography variant="h6" fontWeight="bold">
							Tell us about yourself
						</Typography>
						<TextField
							label="Display Name"
							name="name"
							value={formData.name}
							onChange={handleChange}
							fullWidth
							required
							aria-label="Display Name"
						/>
						<TextField
							label="Short Bio"
							name="bio"
							value={formData.bio}
							onChange={handleChange}
							fullWidth
							multiline
							rows={2}
							placeholder="e.g. CS major, love playing doubles after class!"
							aria-label="Short Bio"
						/>
					</Box>
				);
			case 2:
				return (
					<Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
						<Typography variant="h6" fontWeight="bold">
							Your Play Style
						</Typography>
						<TextField
							select
							label="Skill Level"
							name="skillLevel"
							value={formData.skillLevel}
							onChange={handleChange}
							fullWidth
							aria-label="Skill Level"
						>
							{skillLevels.map((level) => (
								<MenuItem key={level} value={level}>
									{level}
								</MenuItem>
							))}
						</TextField>
						<TextField
							select
							label="Preferred Play"
							name="preferredPlay"
							value={formData.preferredPlay}
							onChange={handleChange}
							fullWidth
							aria-label="Preferred Play"
						>
							{playStyles.map((style) => (
								<MenuItem key={style} value={style}>
									{style}
								</MenuItem>
							))}
						</TextField>
						<TextField
							label="Your Racket"
							name="racket"
							value={formData.racket}
							onChange={handleChange}
							fullWidth
							placeholder="e.g. Yonex Astrox 88D Pro"
							aria-label="Your Racket"
						/>
					</Box>
				);
			case 3:
				return (
					<Box sx={{ textAlign: "center", py: 3 }}>
						<Avatar
							sx={{
								width: 80,
								height: 80,
								mx: "auto",
								mb: 2,
								bgcolor: "#006633",
								fontSize: "2rem",
							}}
						>
							{formData.name?.[0]?.toUpperCase() || "?"}
						</Avatar>
						<Typography variant="h5" fontWeight="bold" gutterBottom>
							You&apos;re all set, {formData.name || "Player"}!
						</Typography>
						<Typography color="text.secondary">
							Skill: {formData.skillLevel} · Plays: {formData.preferredPlay}
						</Typography>
						{formData.racket && (
							<Typography color="text.secondary" sx={{ mt: 0.5 }}>
								Racket: {formData.racket}
							</Typography>
						)}
					</Box>
				);
			default:
				return null;
		}
	};

	return (
		<Box
			sx={{
				minHeight: "100vh",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				bgcolor: "background.default",
				p: 2,
			}}
		>
			<Paper
				elevation={3}
				sx={{
					maxWidth: 520,
					width: "100%",
					borderRadius: 4,
					overflow: "hidden",
					border: "1px solid",
					borderColor: "divider",
				}}
			>
				{/* Green header bar */}
				<Box
					sx={{
						bgcolor: "#006633",
						py: 2,
						px: 3,
					}}
				>
					<Stepper activeStep={activeStep} alternativeLabel>
						{steps.map((label) => (
							<Step key={label}>
								<StepLabel
									sx={{
										"& .MuiStepLabel-label": { color: "rgba(255,255,255,0.7)", fontWeight: "bold", fontSize: "0.75rem" },
										"& .MuiStepLabel-label.Mui-active": { color: "#fff" },
										"& .MuiStepLabel-label.Mui-completed": { color: "#FFCC33" },
										"& .MuiStepIcon-root": { color: "rgba(255,255,255,0.3)" },
										"& .MuiStepIcon-root.Mui-active": { color: "#FFCC33" },
										"& .MuiStepIcon-root.Mui-completed": { color: "#FFCC33" },
									}}
								>
									{label}
								</StepLabel>
							</Step>
						))}
					</Stepper>
				</Box>

				{/* Step content with animation */}
				<Box sx={{ p: { xs: 3, sm: 4 }, minHeight: 250, position: "relative", overflow: "hidden" }}>
					<AnimatePresence mode="wait" custom={direction}>
						<motion.div
							key={activeStep}
							custom={direction}
							variants={slideVariants}
							initial="enter"
							animate="center"
							exit="exit"
							transition={{ type: "spring", stiffness: 300, damping: 30 }}
						>
							{renderStepContent(activeStep)}
						</motion.div>
					</AnimatePresence>
				</Box>

				{/* Navigation buttons */}
				<Box
					sx={{
						display: "flex",
						justifyContent: "space-between",
						p: 3,
						pt: 0,
					}}
				>
					<Button
						onClick={handleBack}
						disabled={activeStep === 0}
						sx={{ visibility: activeStep === 0 ? "hidden" : "visible" }}
					>
						Back
					</Button>
					{activeStep < steps.length - 1 ? (
						<Button
							variant="contained"
							onClick={handleNext}
							disabled={activeStep === 1 && !formData.name.trim()}
							sx={{
								bgcolor: "#006633",
								"&:hover": { bgcolor: "#005528" },
								borderRadius: 3,
								px: 4,
							}}
						>
							Next
						</Button>
					) : (
						<Button
							variant="contained"
							onClick={handleFinish}
							disabled={saving}
							sx={{
								bgcolor: "#006633",
								"&:hover": { bgcolor: "#005528" },
								borderRadius: 3,
								px: 4,
							}}
						>
							{saving ? "Saving..." : "Let's Go! 🏸"}
						</Button>
					)}
				</Box>
			</Paper>
		</Box>
	);
}
