import React from "react";
import { Box, Typography, Button, Container, Grid, Paper, useTheme } from "@mui/material";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function Landing() {
	const theme = useTheme();
	const navigate = useNavigate();

	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: { staggerChildren: 0.2, delayChildren: 0.1 },
		},
	};

	const itemVariants = {
		hidden: { y: 30, opacity: 0 },
		visible: {
			y: 0,
			opacity: 1,
			transition: { type: "spring", stiffness: 100 },
		},
	};

	return (
		<Box sx={{ minHeight: "100vh", pt: { xs: 8, md: 12 }, pb: 8 }}>
			<Container maxWidth="lg" component={motion.div} variants={containerVariants} initial="hidden" animate="visible">
				{/* Hero Section */}
				<Box sx={{ textAlign: "center", mb: 8 }}>
					<motion.img
						src="/icon.jpg"
						alt="GMU Badminton"
						style={{ width: 120, height: 120, borderRadius: 24, marginBottom: 24, boxShadow: "0px 12px 24px rgba(0,0,0,0.2)" }}
						initial={{ scale: 0.8, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{ type: "spring", bounce: 0.5 }}
					/>
					<motion.div variants={itemVariants}>
						<Typography variant="h2" fontWeight="900" sx={{ mb: 2, background: "linear-gradient(45deg, #006633, #FFCC33)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
							Mason Badminton Connect
						</Typography>
					</motion.div>
					<motion.div variants={itemVariants}>
						<Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: 600, mx: "auto" }}>
							A student-run community platform for George Mason University badminton players. Connect, rank up, and hit the courts.
						</Typography>
					</motion.div>
					<motion.div variants={itemVariants}>
						<Button
							variant="contained"
							color="primary"
							size="large"
							onClick={() => navigate("/auth")}
							sx={{ py: 1.5, px: 4, borderRadius: 8, fontSize: "1.1rem", fontWeight: "bold", textTransform: "none", boxShadow: "0 8px 16px rgba(0, 102, 51, 0.3)" }}
						>
							Join the Club
						</Button>
					</motion.div>
				</Box>

				{/* Features Grid */}
				<Box sx={{ 
					display: 'grid', 
					gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(280px, 1fr))' }, 
					gap: 4, 
					mt: 6 
				}}>
					{[
						{ title: "Live RAC Status", desc: "Instantly see if courts are open before you walk all the way to the gym.", icon: "🏸" },
						{ title: "Elo Leaderboards", desc: "Climb the ranks. Challenge players to official matches and prove you're the best on campus.", icon: "🏆" },
						{ title: "Active Forum", desc: "Find doubles partners, discuss gear, and organize late-night smash sessions.", icon: "💬" },
						{ title: "Player Profiles", desc: "Show off your racket, playstyle, and win streaks to the entire university.", icon: "🎴" }
					].map((feature, i) => (
						<motion.div key={i} variants={itemVariants} whileHover={{ y: -8 }} style={{ height: "100%" }}>
							<Paper elevation={0} sx={{ 
								p: 4, 
								height: "100%", 
								borderRadius: "24px", 
								backgroundColor: "background.paper", 
								border: "1px solid", 
								borderColor: "divider", 
								display: "flex", 
								flexDirection: "column", 
								alignItems: "flex-start", 
								textAlign: "left",
								boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
								transition: "box-shadow 0.3s ease"
							}}>
								<Box sx={{ fontSize: "2.5rem", mb: 2, background: "rgba(0, 102, 51, 0.1)", p: 2, borderRadius: "16px", display: "inline-flex" }}>
									{feature.icon}
								</Box>
								<Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>{feature.title}</Typography>
								<Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6 }}>{feature.desc}</Typography>
							</Paper>
						</motion.div>
					))}
				</Box>
			</Container>
		</Box>
	);
}
