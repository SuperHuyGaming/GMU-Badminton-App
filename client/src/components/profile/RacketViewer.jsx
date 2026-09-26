import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { Box, Typography } from '@mui/material';

// A procedural 3D Badminton Racket built using standard Three.js geometry primitives
function ProceduralRacket(props) {
    const group = useRef();
    
    // Auto-rotate slowly
    useFrame((state, delta) => {
        if (group.current) {
            group.current.rotation.y += delta * 0.5;
        }
    });

    return (
        <group ref={group} {...props} dispose={null}>
            {/* Racket Head (Torus) */}
            <mesh position={[0, 2.5, 0]} scale={[1, 1.2, 1]}>
                <torusGeometry args={[1, 0.08, 16, 100]} />
                <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Racket Strings (Wireframe plane or very thin grid) */}
            <mesh position={[0, 2.5, 0]} scale={[1, 1.2, 1]}>
                <cylinderGeometry args={[0.95, 0.95, 0.01, 32]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.3} wireframe />
            </mesh>

            {/* Shaft (Thin Cylinder) */}
            <mesh position={[0, 0.5, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 2.5, 16]} />
                <meshStandardMaterial color="#cccccc" metalness={0.9} roughness={0.1} />
            </mesh>

            {/* Handle/Grip (Thicker Cylinder) */}
            <mesh position={[0, -1.2, 0]}>
                <cylinderGeometry args={[0.15, 0.15, 1.2, 16]} />
                <meshStandardMaterial color="#e53935" roughness={0.9} />
            </mesh>
            
            {/* Cone cap at bottom of grip */}
            <mesh position={[0, -1.85, 0]}>
                <cylinderGeometry args={[0.18, 0.15, 0.1, 16]} />
                <meshStandardMaterial color="#111111" />
            </mesh>

            {/* Cone at top of grip connecting to shaft */}
            <mesh position={[0, -0.55, 0]}>
                <cylinderGeometry args={[0.06, 0.15, 0.2, 16]} />
                <meshStandardMaterial color="#111111" />
            </mesh>
        </group>
    );
}

export default function RacketViewer() {
    return (
        <Box sx={{ width: '100%', height: 400, borderRadius: 4, overflow: 'hidden', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', position: 'relative' }}>
            <Typography variant="caption" sx={{ position: 'absolute', top: 16, left: 16, zIndex: 10, fontWeight: 'bold', color: 'text.secondary' }}>
                INTERACTIVE 3D VIEWER
            </Typography>
            <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
                <ProceduralRacket position={[0, 0, 0]} />
                <Environment preset="city" />
                <OrbitControls enableZoom={false} autoRotate={false} />
                <ContactShadows position={[0, -2.5, 0]} opacity={0.4} scale={10} blur={2} far={4} />
            </Canvas>
        </Box>
    );
}
