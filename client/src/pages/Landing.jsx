import PropTypes from "prop-types";
import { Box, Typography, Button, Container, Paper } from "@mui/material";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export const HeroBadmintonGraphic = ({ maxWidth = 500, sx = {} }) => {
	return (
		<Box
			component={motion.div}
			initial={{ opacity: 0, scale: 0.92, y: 20 }}
			animate={{ 
				opacity: 1, 
				scale: 1, 
				y: [0, -8, 0],
			}}
			transition={{
				opacity: { duration: 0.8, ease: "easeOut" },
				scale: { duration: 0.8, ease: "easeOut" },
				y: { repeat: Infinity, duration: 6, ease: "easeInOut" }
			}}
			whileHover={{ scale: 1.02, transition: { duration: 0.3 } }}
			sx={{
				position: "relative",
				width: "100%",
				maxWidth,
				mx: "auto",
				filter: "drop-shadow(0 20px 40px rgba(0, 102, 51, 0.22))",
				...sx,
			}}
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 600 600"
				width="100%"
				height="100%"
				style={{ overflow: "visible", display: "block" }}
				role="img"
				aria-label="Mason Badminton Connect Dynamic Hero Illustration"
			>
				<defs>
					{/* Background Ambient Glow */}
					<radialGradient id="heroAmbientGlow" cx="50%" cy="45%" r="55%">
						<stop offset="0%" stopColor="#00E676" stopOpacity={0.18} />
						<stop offset="35%" stopColor="#006633" stopOpacity={0.12} />
						<stop offset="70%" stopColor="#004D26" stopOpacity={0.05} />
						<stop offset="100%" stopColor="#02120A" stopOpacity={0} />
					</radialGradient>

					{/* Kinetic Trajectory Gradient */}
					<linearGradient id="heroTrajectoryGrad" x1="0%" y1="100%" x2="100%" y2="0%">
						<stop offset="0%" stopColor="#004D26" stopOpacity={0} />
						<stop offset="25%" stopColor="#006633" stopOpacity={0.4} />
						<stop offset="55%" stopColor="#00E676" stopOpacity={0.9} />
						<stop offset="85%" stopColor="#FFCC33" stopOpacity={0.95} />
						<stop offset="100%" stopColor="#FFFFFF" stopOpacity={1} />
					</linearGradient>

					{/* Trail Ribbon Gradient */}
					<linearGradient id="heroRibbonGrad" x1="0%" y1="100%" x2="100%" y2="0%">
						<stop offset="0%" stopColor="#00E676" stopOpacity={0} />
						<stop offset="40%" stopColor="#006633" stopOpacity={0.35} />
						<stop offset="75%" stopColor="#FFCC33" stopOpacity={0.7} />
						<stop offset="100%" stopColor="#FFE082" stopOpacity={0.95} />
					</linearGradient>

					{/* Sonic Burst Radial */}
					<radialGradient id="sonicBurstGrad" cx="50%" cy="50%" r="50%">
						<stop offset="0%" stopColor="#FFE57F" stopOpacity={0.8} />
						<stop offset="30%" stopColor="#FFCC33" stopOpacity={0.5} />
						<stop offset="65%" stopColor="#00E676" stopOpacity={0.2} />
						<stop offset="100%" stopColor="#004D26" stopOpacity={0} />
					</radialGradient>

					{/* Racket Frame Metallic Gradient */}
					<linearGradient id="racketRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stopColor="#80E27E" />
						<stop offset="30%" stopColor="#006633" />
						<stop offset="70%" stopColor="#004D26" />
						<stop offset="100%" stopColor="#002A14" />
					</linearGradient>

					{/* Racket Rim Gold Bevel Highlight */}
					<linearGradient id="racketGoldBevel" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stopColor="#FFF3B0" />
						<stop offset="50%" stopColor="#FFCC33" />
						<stop offset="100%" stopColor="#B45309" />
					</linearGradient>

					{/* Racket Shaft Carbon Gradient */}
					<linearGradient id="shaftGrad" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" stopColor="#1E293B" />
						<stop offset="40%" stopColor="#475569" />
						<stop offset="70%" stopColor="#1E293B" />
						<stop offset="100%" stopColor="#0F172A" />
					</linearGradient>

					{/* Grip Tape Gradient */}
					<linearGradient id="gripGrad" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" stopColor="#00381B" />
						<stop offset="50%" stopColor="#005A2B" />
						<stop offset="100%" stopColor="#002411" />
					</linearGradient>

					{/* Shuttlecock Cork Gradient */}
					<linearGradient id="corkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stopColor="#FFF9C4" />
						<stop offset="45%" stopColor="#FFCC33" />
						<stop offset="85%" stopColor="#D97706" />
						<stop offset="100%" stopColor="#92400E" />
					</linearGradient>

					{/* Feather Shade Gradient */}
					<linearGradient id="featherGrad" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" stopColor="#E2E8F0" stopOpacity={0.9} />
						<stop offset="50%" stopColor="#FFFFFF" stopOpacity={0.98} />
						<stop offset="100%" stopColor="#F8FAFC" stopOpacity={0.85} />
					</linearGradient>

					{/* Feather Inner Shadow */}
					<linearGradient id="featherInnerShade" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" stopColor="#0F172A" stopOpacity={0.25} />
						<stop offset="60%" stopColor="#334155" stopOpacity={0.1} />
						<stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
					</linearGradient>

					{/* Sweet Spot Radial Glow */}
					<radialGradient id="sweetSpotGrad" cx="50%" cy="50%" r="50%">
						<stop offset="0%" stopColor="#FFCC33" stopOpacity={0.35} />
						<stop offset="60%" stopColor="#00E676" stopOpacity={0.15} />
						<stop offset="100%" stopColor="#006633" stopOpacity={0} />
					</radialGradient>

					{/* Filters for Neon Luminance */}
					<filter id="emeraldGlow" x="-30%" y="-30%" width="160%" height="160%">
						<feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#00E676" floodOpacity={0.75} />
						<feDropShadow dx="0" dy="2" stdDeviation="12" floodColor="#00E676" floodOpacity={0.4} />
					</filter>

					<filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
						<feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#FFCC33" floodOpacity={0.8} />
						<feDropShadow dx="0" dy="2" stdDeviation="14" floodColor="#F59E0B" floodOpacity={0.5} />
					</filter>

					<filter id="racket3dShadow" x="-20%" y="-20%" width="150%" height="150%">
						<feDropShadow dx="10" dy="18" stdDeviation="16" floodColor="#000000" floodOpacity={0.4} />
					</filter>

					<filter id="softSpeedBlur" x="-10%" y="-10%" width="120%" height="120%">
						<feGaussianBlur stdDeviation="3" />
					</filter>

					{/* String Bed Pattern */}
					<pattern id="racketStrings" width="6.5" height="6.5" patternUnits="userSpaceOnUse">
						<line x1="0" y1="0" x2="0" y2="6.5" stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity={0.65} />
						<line x1="0" y1="0" x2="6.5" y2="0" stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity={0.65} />
					</pattern>

					{/* Clip Paths */}
					<clipPath id="innerHeadClip">
						<ellipse cx="0" cy="0" rx="64" ry="86" />
					</clipPath>
				</defs>

				{/* 1. AMBIENT COURT & ARENA BACKDROP */}
				<ellipse cx="320" cy="270" rx="270" ry="240" fill="url(#heroAmbientGlow)" />

				<g opacity={0.32} stroke="#00E676" strokeLinecap="round">
					<line x1="260" y1="560" x2="310" y2="430" strokeWidth="2" strokeOpacity={0.45} />
					<line x1="120" y1="510" x2="480" y2="475" strokeWidth="2.5" strokeOpacity={0.6} />
					<line x1="60" y1="575" x2="540" y2="530" strokeWidth="3" strokeOpacity={0.5} />
					<line x1="60" y1="575" x2="220" y2="420" strokeWidth="2" strokeOpacity={0.35} />
					<line x1="540" y1="530" x2="400" y2="420" strokeWidth="2" strokeOpacity={0.35} />
					<line x1="290" y1="492" x2="310" y2="490" strokeWidth="3" stroke="#FFCC33" strokeOpacity={0.8} />
				</g>

				<circle cx="160" cy="180" r="2.5" fill="#00E676" opacity={0.6} filter="url(#emeraldGlow)" />
				<circle cx="210" cy="130" r="3.5" fill="#FFCC33" opacity={0.5} filter="url(#goldGlow)" />
				<circle cx="360" cy="100" r="2" fill="#FFFFFF" opacity={0.7} />
				<circle cx="490" cy="290" r="3" fill="#00E676" opacity={0.5} />
				<circle cx="530" cy="240" r="2" fill="#FFCC33" opacity={0.6} />
				<circle cx="120" cy="380" r="3" fill="#38BDF8" opacity={0.5} />

				{/* 2. KINETIC SMASH TRAJECTORY & SPEED TRAILS */}
				<path
					d="M 90 470 C 120 340, 190 260, 240 240 C 310 215, 380 190, 440 172"
					fill="none"
					stroke="url(#heroRibbonGrad)"
					strokeWidth="18"
					strokeLinecap="round"
					opacity={0.3}
					filter="url(#softSpeedBlur)"
				/>
				<path
					d="M 110 450 C 140 330, 200 255, 245 238 C 305 215, 375 192, 442 173"
					fill="none"
					stroke="url(#heroTrajectoryGrad)"
					strokeWidth="8"
					strokeLinecap="round"
					opacity={0.65}
				/>
				<path
					d="M 130 435 C 160 320, 215 250, 250 236 C 310 214, 380 190, 445 174"
					fill="none"
					stroke="#FFFFFF"
					strokeWidth="2.5"
					strokeDasharray="14,8"
					strokeLinecap="round"
					opacity={0.9}
				/>
				<path
					d="M 458 170 C 490 161, 520 152, 545 144"
					fill="none"
					stroke="url(#racketGoldBevel)"
					strokeWidth="3"
					strokeDasharray="8,6"
					strokeLinecap="round"
					opacity={0.85}
					filter="url(#goldGlow)"
				/>

				<line x1="395" y1="184" x2="295" y2="212" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeDasharray="18,12" opacity={0.75} />
				<line x1="415" y1="162" x2="320" y2="188" stroke="#FFCC33" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="24,14" opacity={0.85} filter="url(#goldGlow)" />
				<line x1="405" y1="202" x2="330" y2="224" stroke="#00E676" strokeWidth="2" strokeLinecap="round" strokeDasharray="16,10" opacity={0.7} filter="url(#emeraldGlow)" />
				<line x1="375" y1="148" x2="300" y2="170" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="12,8" opacity={0.6} />

				{/* 3. RACKET IMPACT BURST & SONIC RIPPLES */}
				<g transform="translate(242, 238)">
					<circle cx="0" cy="0" r="55" fill="url(#sonicBurstGrad)" />
					<ellipse cx="0" cy="0" rx="32" ry="18" fill="none" stroke="#FFCC33" strokeWidth="2.5" opacity={0.9} filter="url(#goldGlow)" transform="rotate(-26)" />
					<ellipse cx="0" cy="0" rx="54" ry="28" fill="none" stroke="#00E676" strokeWidth="2" strokeDasharray="6,4" opacity={0.7} filter="url(#emeraldGlow)" transform="rotate(-26)" />
					<ellipse cx="0" cy="0" rx="78" ry="42" fill="none" stroke="#38BDF8" strokeWidth="1.2" strokeDasharray="8,6" opacity={0.45} transform="rotate(-26)" />

					<g transform="translate(26, -18) scale(1.2)">
						<polygon points="0,-7 2,-2 7,0 2,2 0,7 -2,2 -7,0 -2,-2" fill="#FFCC33" filter="url(#goldGlow)" />
					</g>
					<g transform="translate(-24, 22) scale(0.9)">
						<polygon points="0,-7 2,-2 7,0 2,2 0,7 -2,2 -7,0 -2,-2" fill="#00E676" filter="url(#emeraldGlow)" />
					</g>
					<g transform="translate(38, 20) scale(0.8)">
						<polygon points="0,-7 2,-2 7,0 2,2 0,7 -2,2 -7,0 -2,-2" fill="#FFFFFF" />
					</g>
					<g transform="translate(-18, -28) scale(0.7)">
						<polygon points="0,-7 2,-2 7,0 2,2 0,7 -2,2 -7,0 -2,-2" fill="#FFCC33" />
					</g>
				</g>

				{/* 4. BADMINTON RACKET (ISOMETRIC 3D ANGLE) */}
				<g transform="translate(225, 275) rotate(-28)" filter="url(#racket3dShadow)">
					{/* Handle Butt Cap */}
					<path d="M -11 364 L 11 364 L 9 375 L -9 375 Z" fill="#004D26" stroke="#FFCC33" strokeWidth="1.5" />
					<circle cx="0" cy="370" r="3" fill="#FFCC33" />

					{/* Ergonomic Grip Handle with Spiral Overlap Ridges */}
					<rect x="-9.5" y="260" width="19" height="104" rx="2" fill="url(#gripGrad)" stroke="#002411" strokeWidth="1" />
					<g stroke="#00180B" strokeWidth="2" opacity={0.6}>
						<line x1="-9" y1="272" x2="9" y2="280" />
						<line x1="-9" y1="288" x2="9" y2="296" />
						<line x1="-9" y1="304" x2="9" y2="312" />
						<line x1="-9" y1="320" x2="9" y2="328" />
						<line x1="-9" y1="336" x2="9" y2="344" />
						<line x1="-9" y1="352" x2="9" y2="360" />
					</g>
					<rect x="-10" y="256" width="20" height="5" fill="#FFCC33" stroke="#B45309" strokeWidth="0.8" rx="1" />

					{/* Cone & Carbon Shaft */}
					<polygon points="-5,238 5,238 9,256 -9,256" fill="url(#shaftGrad)" stroke="#334155" strokeWidth="1" />
					<line x1="-6" y1="248" x2="6" y2="248" stroke="#00E676" strokeWidth="1.5" />

					<rect x="-3" y="105" width="6" height="133" fill="url(#shaftGrad)" rx="1.5" />
					<line x1="-0.5" y1="108" x2="-0.5" y2="235" stroke="#94A3B8" strokeWidth="1" strokeOpacity={0.5} />
					<rect x="-3.5" y="150" width="7" height="14" fill="#006633" />
					<line x1="-3.5" y1="152" x2="3.5" y2="152" stroke="#FFCC33" strokeWidth="1.5" />
					<line x1="-3.5" y1="162" x2="3.5" y2="162" stroke="#FFCC33" strokeWidth="1.5" />

					{/* Built-in T-Joint */}
					<path d="M -7 92 Q 0 97 7 92 L 4 108 L -4 108 Z" fill="#004D26" stroke="#006633" strokeWidth="1.2" />
					<polygon points="-3,95 3,95 2,105 -2,105" fill="#FFCC33" />

					{/* Racket Head & High-Tension Strings */}
					<ellipse cx="0" cy="0" rx="72" ry="94" fill="none" stroke="url(#racketRimGrad)" strokeWidth="8" />
					<ellipse cx="0" cy="0" rx="76" ry="98" fill="none" stroke="url(#racketGoldBevel)" strokeWidth="1.6" opacity={0.85} />
					<ellipse cx="0" cy="0" rx="66" ry="88" fill="none" stroke="#001F0E" strokeWidth="1.5" />

					{/* Grommet Accents */}
					<g stroke="#1E293B" strokeWidth="1.2" opacity={0.7}>
						<line x1="-40" y1="-80" x2="-43" y2="-84" />
						<line x1="-20" y1="-91" x2="-21" y2="-96" />
						<line x1="0" y1="-94" x2="0" y2="-99" />
						<line x1="20" y1="-91" x2="21" y2="-96" />
						<line x1="40" y1="-80" x2="43" y2="-84" />
						<line x1="62" y1="-50" x2="67" y2="-53" />
						<line x1="-62" y1="-50" x2="-67" y2="-53" />
					</g>

					<g clipPath="url(#innerHeadClip)">
						<rect x="-65" y="-87" width="130" height="174" fill="rgba(8, 33, 20, 0.45)" />
						<rect x="-65" y="-87" width="130" height="174" fill="url(#racketStrings)" />

						<ellipse cx="0" cy="5" rx="36" ry="46" fill="url(#sweetSpotGrad)" />
						<ellipse cx="0" cy="5" rx="26" ry="34" fill="none" stroke="#FFCC33" strokeWidth="1.2" strokeDasharray="4,3" strokeOpacity={0.85} />

						{/* Stenciled Collegiate Mason "M" */}
						<path
							d="M -16 22 L -16 -12 L -9 -12 L 0 5 L 9 -12 L 16 -12 L 16 22 L 11 22 L 11 -2 L 3 13 L -3 13 L -11 -2 L -11 22 Z"
							fill="#FFCC33"
							fillOpacity={0.75}
							stroke="#006633"
							strokeWidth="1"
							strokeOpacity={0.9}
						/>
					</g>

					<path
						d="M -50 -65 C -25 -88, 25 -88, 50 -65"
						fill="none"
						stroke="#FFFFFF"
						strokeWidth="2.5"
						strokeLinecap="round"
						opacity={0.75}
					/>
				</g>

				{/* 5. HIGH-VELOCITY SHUTTLECOCK (SMASH FLIGHT) */}
				<g transform="translate(446, 172) rotate(-26)">
					<ellipse cx="0" cy="0" rx="55" ry="34" fill="url(#sonicBurstGrad)" opacity={0.4} />
					<polygon points="-46,-28 14,-12 14,12 -46,28" fill="url(#featherInnerShade)" />

					{/* 16 Overlapping Goose Feathers */}
					<path d="M 14 12 L -46 29 L -48 23 L 13 8 Z" fill="url(#featherGrad)" stroke="#CBD5E1" strokeWidth="0.8" />
					<path d="M 14 9 L -47 22 L -48 16 L 14 6 Z" fill="url(#featherGrad)" stroke="#CBD5E1" strokeWidth="0.8" />
					<path d="M 14 6 L -48 15 L -48 8 L 14 3 Z" fill="url(#featherGrad)" stroke="#CBD5E1" strokeWidth="0.8" />
					<path d="M 14 3 L -49 7 L -49 -1 L 14 0 Z" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.8" />
					<path d="M 14 0 L -49 0 L -49 -8 L 14 -3 Z" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.8" />
					<path d="M 14 -3 L -48 -8 L -48 -15 L 14 -6 Z" fill="url(#featherGrad)" stroke="#CBD5E1" strokeWidth="0.8" />
					<path d="M 14 -6 L -47 -16 L -48 -22 L 14 -9 Z" fill="url(#featherGrad)" stroke="#CBD5E1" strokeWidth="0.8" />
					<path d="M 13 -8 L -46 -23 L -46 -29 L 14 -12 Z" fill="url(#featherGrad)" stroke="#CBD5E1" strokeWidth="0.8" />

					{/* Feather Central Rachis Lines */}
					<g stroke="#94A3B8" strokeWidth="1" strokeLinecap="round" opacity={0.8}>
						<line x1="14" y1="-10" x2="-45" y2="-26" />
						<line x1="14" y1="-6" x2="-47" y2="-17" />
						<line x1="14" y1="-2" x2="-48" y2="-8" />
						<line x1="14" y1="2" x2="-48" y2="7" />
						<line x1="14" y1="6" x2="-47" y2="16" />
						<line x1="14" y1="10" x2="-45" y2="25" />
					</g>

					{/* Scalloped Back Tips */}
					<g stroke="#94A3B8" strokeWidth="1" fill="#FFFFFF">
						<path d="M -46 -29 Q -49 -26 -46 -23" />
						<path d="M -46 -23 Q -50 -19 -47 -16" />
						<path d="M -47 -16 Q -51 -12 -48 -8" />
						<path d="M -48 -8 Q -52 0 -48 8" />
						<path d="M -48 8 Q -51 12 -47 16" />
						<path d="M -47 16 Q -50 19 -46 23" />
						<path d="M -46 23 Q -49 26 -46 29" />
					</g>

					{/* Circumferential Threads */}
					<path d="M -30 -21 C -24 -12, -24 12, -30 21" fill="none" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" />
					<path d="M -30 -21 C -24 -12, -24 12, -30 21" fill="none" stroke="#006633" strokeWidth="1.2" strokeDasharray="3,2" strokeLinecap="round" />
					<path d="M -12 -15 C -8 -8, -8 8, -12 15" fill="none" stroke="#64748B" strokeWidth="1.6" strokeLinecap="round" />
					<path d="M -12 -15 C -8 -8, -8 8, -12 15" fill="none" stroke="#006633" strokeWidth="1.2" strokeDasharray="3,2" strokeLinecap="round" />

					{/* Collar & Natural Cork Dome */}
					<rect x="12" y="-12.5" width="6.5" height="25" rx="1.5" fill="#004D26" stroke="#006633" strokeWidth="1" />
					<line x1="15.2" y1="-12" x2="15.2" y2="12" stroke="#FFCC33" strokeWidth="1.2" />

					<path
						d="M 18.5 -12.5 C 24 -12.5, 36 -9, 41 -4 C 44 -1, 44 1, 41 4 C 36 9, 24 12.5, 18.5 12.5 Z"
						fill="url(#corkGrad)"
						stroke="#B45309"
						strokeWidth="1.4"
						filter="url(#goldGlow)"
					/>
					<path d="M 22 -9 C 30 -8, 38 -4, 40 0" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity={0.85} />
				</g>

				{/* 6. FOREGROUND KINETIC PARTICLES */}
				<g transform="translate(475, 142) scale(1)">
					<polygon points="0,-8 2.5,-2.5 8,0 2.5,2.5 0,8 -2.5,2.5 -8,0 -2.5,-2.5" fill="#FFCC33" filter="url(#goldGlow)" />
				</g>
				<g transform="translate(420, 130) scale(0.7)">
					<polygon points="0,-8 2.5,-2.5 8,0 2.5,2.5 0,8 -2.5,2.5 -8,0 -2.5,-2.5" fill="#FFFFFF" />
				</g>
				<g transform="translate(370, 240) scale(0.85)">
					<polygon points="0,-8 2.5,-2.5 8,0 2.5,2.5 0,8 -2.5,2.5 -8,0 -2.5,-2.5" fill="#00E676" filter="url(#emeraldGlow)" />
				</g>
				<g transform="translate(490, 210) scale(0.65)">
					<polygon points="0,-8 2.5,-2.5 8,0 2.5,2.5 0,8 -2.5,2.5 -8,0 -2.5,-2.5" fill="#38BDF8" />
				</g>
			</svg>
		</Box>
	);
};

HeroBadmintonGraphic.propTypes = {
	maxWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.object]),
	sx: PropTypes.object,
};

export default function Landing() {
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
		<Box sx={{ minHeight: "100vh", pt: { xs: 6, md: 10 }, pb: 8 }}>
			<Container maxWidth="lg" component={motion.div} variants={containerVariants} initial="hidden" animate="visible">
				{/* Hero Section */}
				<Box sx={{ textAlign: "center", mb: 8 }}>
					{/* Dynamic Vector Badminton Hero Centerpiece */}
					<HeroBadmintonGraphic maxWidth={{ xs: 340, sm: 460, md: 520 }} sx={{ mb: 3 }} />

					<motion.div variants={itemVariants}>
						<Typography 
							variant="h2" 
							fontWeight="900" 
							sx={{ 
								mb: 2, 
								color: "primary.main",
								fontSize: { xs: "2.2rem", sm: "3rem", md: "3.75rem" }
							}}
						>
							Mason Badminton Connect
						</Typography>
					</motion.div>
					<motion.div variants={itemVariants}>
						<Typography variant="h6" color="text.primary" sx={{ mb: 4, maxWidth: 640, mx: "auto", lineHeight: 1.6 }}>
							A student-run community platform for George Mason University badminton players. Connect, rank up, and hit the courts.
						</Typography>
					</motion.div>
					<motion.div variants={itemVariants}>
						<Button
							variant="contained"
							color="primary"
							size="large"
							onClick={() => navigate("/auth")}
							sx={{ 
								py: 1.5, 
								px: 4.5, 
								borderRadius: 8, 
								fontSize: "1.1rem", 
								fontWeight: "bold", 
								textTransform: "none", 
								boxShadow: "0 8px 24px rgba(0, 102, 51, 0.35)",
								'&:hover': {
									transform: 'translateY(-2px)',
									boxShadow: '0 12px 28px rgba(0, 102, 51, 0.45)',
								}
							}}
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
								<Typography variant="body1" color="text.primary" sx={{ lineHeight: 1.6 }}>{feature.desc}</Typography>
							</Paper>
						</motion.div>
					))}
				</Box>
			</Container>
		</Box>
	);
}
