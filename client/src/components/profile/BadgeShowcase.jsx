import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Float, Stars, PresentationControls } from '@react-three/drei';
import { Box, Typography } from '@mui/material';

const BADGE_MAP = {
    first_win: { color: "#FF4136", label: "First Blood" },
    streak_3: { color: "#FF851B", label: "On Fire" },
    streak_5: { color: "#FFDC00", label: "Unstoppable" },
    matches_10: { color: "#0074D9", label: "Regular" },
    matches_50: { color: "#B10DC9", label: "Veteran" },
};

function BadgeCoin({ color, label, position }) {
    const meshRef = useRef();
    
    // Rotate the coin slowly
    useFrame((state, delta) => {
        meshRef.current.rotation.y += delta * 0.5;
    });

    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1} position={position}>
            <mesh ref={meshRef}>
                <cylinderGeometry args={[1, 1, 0.2, 32]} />
                <meshStandardMaterial color={color} metalness={0.6} roughness={0.2} />
                <Text 
                    position={[0, 0, 0.11]} 
                    fontSize={0.25} 
                    color="white" 
                    anchorX="center" 
                    anchorY="middle"
                >
                    {label}
                </Text>
                <Text 
                    position={[0, 0, -0.11]} 
                    rotation={[0, Math.PI, 0]}
                    fontSize={0.25} 
                    color="white" 
                    anchorX="center" 
                    anchorY="middle"
                >
                    {label}
                </Text>
            </mesh>
        </Float>
    );
}

export default function BadgeShowcase({ badges = [] }) {
    if (!badges || badges.length === 0) {
        return null;
    }

    return (
        <Box sx={{ width: '100%', height: 300, bgcolor: '#1a1a2e', borderRadius: 4, overflow: 'hidden', position: 'relative', my: 3 }}>
            <Typography variant="h6" sx={{ position: 'absolute', top: 16, left: 16, color: 'white', zIndex: 1, fontWeight: 'bold' }}>
                🏆 Achievements Showcase
            </Typography>
            <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 10]} intensity={1} />
                <pointLight position={[-10, -10, -10]} color="purple" intensity={0.5} />
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                
                <PresentationControls 
                    global 
                    rotation={[0.13, 0.1, 0]} 
                    polar={[-0.4, 0.2]} 
                    azimuth={[-1, 0.75]} 
                    config={{ mass: 2, tension: 400 }} 
                    snap={{ mass: 4, tension: 400 }}
                >
                    {badges.map((badgeId, index) => {
                        const badgeInfo = BADGE_MAP[badgeId] || { color: "white", label: "Unknown" };
                        // Position them in a line
                        const spacing = 2.2;
                        const startX = -((badges.length - 1) * spacing) / 2;
                        return (
                            <BadgeCoin 
                                key={badgeId} 
                                color={badgeInfo.color} 
                                label={badgeInfo.label} 
                                position={[startX + (index * spacing), 0, 0]} 
                            />
                        );
                    })}
                </PresentationControls>
            </Canvas>
        </Box>
    );
}
