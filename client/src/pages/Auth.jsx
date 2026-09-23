import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	Container, Paper, Typography, TextField, Button, Box,
	Alert, Tabs, Tab, Stepper, Step, StepLabel, Grid, Card, CardContent,
	CircularProgress
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";

export default function Auth() {
	const [isLogin, setIsLogin] = useState(true);
	const navigate = useNavigate();
	const { login } = useAuth();
	const [error, setError] = useState(null);

	const [formData, setFormData] = useState({
		name: "",
		email: "",
		password: "",
		skillLevel: "D Level",
	});

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [activeStep, setActiveStep] = useState(0);

	const handleChange = (e) => {
		setFormData({ ...formData, [e.target.name]: e.target.value });
	};

	const handleSkillSelect = (level) => {
		setFormData({ ...formData, skillLevel: level });
	};

	const handleNext = () => {
		setError(null);
		if (activeStep === 0) {
			if (!formData.email || !formData.password) {
				setError("Email and password are required.");
				return;
			}
		} else if (activeStep === 1) {
			if (!formData.name) {
				setError("Name is required.");
				return;
			}
		}
		setActiveStep((prev) => prev + 1);
	};

	const handleBack = () => {
		setError(null);
		setActiveStep((prev) => prev - 1);
	};

	const handleSubmit = async (e) => {
		if (e) e.preventDefault();
		if (isSubmitting) return;
		setError(null);
		setIsSubmitting(true);

		const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";

		try {
			const response = await fetch(
				`${import.meta.env.VITE_API_URL}${endpoint}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(formData),
				},
			);

			const data = await response.json();
			if (!response.ok)
				throw new Error(data.message || "Something went wrong.");

			const welcomeMsg = isLogin ? `Welcome back, ${data.user.name}!` : `Welcome to the courts, ${data.user.name}!`;
			login(data.user, data.accessToken, data.refreshToken, welcomeMsg);
			navigate("/");
		} catch (err) {
			setError(err.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const steps = ['Account', 'Profile', 'Play Style'];

	const renderSignupStep = () => {
		switch (activeStep) {
			case 0:
				return (
					<motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
						<Typography variant="subtitle1" sx={{ mb: 2, textAlign: 'left', color: 'text.secondary', fontWeight: 'bold' }}>
							Let's start with the basics.
						</Typography>
						<TextField fullWidth label="Email Address" type="email" name="email" value={formData.email} onChange={handleChange} margin="normal" required />
						<TextField fullWidth label="Password" type="password" name="password" value={formData.password} onChange={handleChange} margin="normal" required />
					</motion.div>
				);
			case 1:
				return (
					<motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
						<Typography variant="subtitle1" sx={{ mb: 2, textAlign: 'left', color: 'text.secondary', fontWeight: 'bold' }}>
							What should we call you on the court?
						</Typography>
						<TextField fullWidth label="Full Name or Nickname" name="name" value={formData.name} onChange={handleChange} margin="normal" required autoFocus />
					</motion.div>
				);
			case 2:
				return (
					<motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
						<Typography variant="subtitle1" sx={{ mb: 2, textAlign: 'left', color: 'text.secondary', fontWeight: 'bold' }}>
							Select your badminton skill level.
						</Typography>
						<Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
							{[
								{ level: 'D Level', title: 'Beginner', desc: 'Just starting out or playing casually.' },
								{ level: 'C Level', title: 'Intermediate', desc: 'Plays regularly, knows basic positioning.' },
								{ level: 'B Level', title: 'Advanced', desc: 'Competitive player, strong fundamentals.' }
							].map((item) => (
								<Grid item xs={12} key={item.level}>
									<Card 
										onClick={() => handleSkillSelect(item.level)}
										sx={{ 
											cursor: 'pointer', 
											border: formData.skillLevel === item.level ? '2px solid' : '2px solid transparent',
											borderColor: formData.skillLevel === item.level ? 'primary.main' : 'divider',
											bgcolor: formData.skillLevel === item.level ? 'rgba(0, 102, 51, 0.05)' : 'background.paper',
											transition: 'all 0.2s',
											boxShadow: formData.skillLevel === item.level ? '0 4px 12px rgba(0, 102, 51, 0.15)' : 'none',
                                            '&:hover': {
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                            }
										}}
									>
										<CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, textAlign: 'left' }}>
											<Typography variant="h6" fontWeight="bold" color={formData.skillLevel === item.level ? 'primary.main' : 'text.primary'}>
												{item.level} <Typography component="span" variant="subtitle1" color="text.secondary">({item.title})</Typography>
											</Typography>
											<Typography variant="body2" color="text.secondary">
												{item.desc}
											</Typography>
										</CardContent>
									</Card>
								</Grid>
							))}
						</Grid>
					</motion.div>
				);
			default:
				return null;
		}
	};

	return (
		<Container maxWidth="sm" sx={{ mt: { xs: 4, md: 8 }, px: { xs: 2, sm: 3 } }}>
			<Paper elevation={3} sx={{ p: { xs: 3, md: 5 }, borderRadius: 4, textAlign: "center", overflow: 'hidden' }}>
				<Typography variant="h4" color="primary" sx={{ fontWeight: "900", mb: 1, fontSize: { xs: "1.75rem", sm: "2.125rem" } }}>
					{isLogin ? "Welcome Back" : "Join the Community"}
				</Typography>
				<Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
					{isLogin ? "Log in to view the schedule and forum." : "Create an account to start playing."}
				</Typography>

				<Box sx={{ borderBottom: 1, borderColor: "divider", mb: 4 }}>
					<Tabs
						value={isLogin ? 0 : 1}
						onChange={(e, newValue) => {
							setIsLogin(newValue === 0);
							setError(null);
							if (newValue === 1) setActiveStep(0); // Reset wizard on switch
						}}
						variant="fullWidth"
						textColor="primary"
						indicatorColor="primary"
					>
						<Tab label="Login" sx={{ fontWeight: "bold", fontSize: "1rem" }} />
						<Tab label="Sign Up" sx={{ fontWeight: "bold", fontSize: "1rem" }} />
					</Tabs>
				</Box>

				<Box sx={{ minHeight: '40px' }}>
					{error && (
						<Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
							{error}
						</Alert>
					)}
				</Box>

				{isLogin ? (
					<form onSubmit={handleSubmit}>
						<TextField fullWidth label="Email Address" type="email" name="email" value={formData.email} onChange={handleChange} margin="normal" required />
						<TextField fullWidth label="Password" type="password" name="password" value={formData.password} onChange={handleChange} margin="normal" required />
						<Button type="submit" fullWidth variant="contained" color="primary" size="large" disabled={isSubmitting} sx={{ mt: 4, mb: 2, fontWeight: "bold", py: 1.5, borderRadius: 2 }}>
							{isSubmitting ? <CircularProgress size={24} color="inherit" /> : "Login"}
						</Button>
					</form>
				) : (
					<Box sx={{ width: '100%' }}>
						<Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
							{steps.map((label) => (
								<Step key={label}>
									<StepLabel StepIconProps={{ sx: { '&.Mui-active': { color: 'secondary.main' } } }}>
                                        <Typography fontWeight={600}>{label}</Typography>
                                    </StepLabel>
								</Step>
							))}
						</Stepper>
						
						<Box sx={{ minHeight: 250, mb: 4, overflow: 'hidden', px: 1 }}>
							<AnimatePresence mode="wait">
								{renderSignupStep()}
							</AnimatePresence>
						</Box>

						<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<Button disabled={activeStep === 0 || isSubmitting} onClick={handleBack} sx={{ fontWeight: 'bold' }}>
								Back
							</Button>
							{activeStep === steps.length - 1 ? (
								<Button variant="contained" onClick={handleSubmit} disabled={isSubmitting} sx={{ fontWeight: 'bold', px: 4, py: 1, borderRadius: 2 }}>
									{isSubmitting ? <CircularProgress size={24} color="inherit" /> : "Complete Setup"}
								</Button>
							) : (
								<Button variant="contained" onClick={handleNext} sx={{ fontWeight: 'bold', px: 4, py: 1, borderRadius: 2 }}>
									Next
								</Button>
							)}
						</Box>
					</Box>
				)}
			</Paper>
		</Container>
	);
}
