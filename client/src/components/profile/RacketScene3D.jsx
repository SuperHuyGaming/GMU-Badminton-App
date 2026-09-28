import { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';

function CameraReset({ resetTrigger }) {
    const { camera, controls } = useThree();
    useEffect(() => {
        if (resetTrigger > 0) {
            camera.position.set(0, 0, 8);
            if (controls) {
                controls.target.set(0, 0, 0);
                controls.update();
            }
        }
    }, [resetTrigger, camera, controls]);
    return null;
}

function ProceduralRacket({ isPlaying, primaryColor, secondaryColor, ...props }) {
    const group = useRef();
    
    useFrame((state, delta) => {
        if (group.current && isPlaying) {
            group.current.rotation.y += delta * 0.5;
        }
    });

    return (
        <group ref={group} {...props} dispose={null}>
            {/* Racket Head (Torus) */}
            <mesh position={[0, 2.5, 0]} scale={[1, 1.2, 1]}>
                <torusGeometry args={[1, 0.08, 16, 64]} />
                <meshStandardMaterial color={primaryColor} metalness={0.7} roughness={0.2} />
            </mesh>

            {/* Isometric Cross-String Pattern */}
            <mesh position={[0, 2.5, 0]} scale={[0.95, 1.15, 1]}>
                <cylinderGeometry args={[1, 1, 0.01, 32]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.3} wireframe />
            </mesh>

            {/* T-Joint */}
            <mesh position={[0, 1.3, 0]}>
                <boxGeometry args={[0.25, 0.25, 0.12]} />
                <meshStandardMaterial color={primaryColor} metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Shaft (Thin Cylinder) */}
            <mesh position={[0, 0.4, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 1.8, 16]} />
                <meshStandardMaterial color="#cccccc" metalness={0.9} roughness={0.1} />
            </mesh>

            {/* Handle/Grip (Thicker Cylinder) */}
            <mesh position={[0, -1.1, 0]}>
                <cylinderGeometry args={[0.15, 0.15, 1.4, 16]} />
                <meshStandardMaterial color={secondaryColor} roughness={0.9} />
            </mesh>
            
            {/* Cone cap at bottom of grip */}
            <mesh position={[0, -1.85, 0]}>
                <cylinderGeometry args={[0.18, 0.15, 0.1, 16]} />
                <meshStandardMaterial color="#111111" />
            </mesh>

            {/* Cone at top of grip connecting to shaft */}
            <mesh position={[0, -0.4, 0]}>
                <cylinderGeometry args={[0.06, 0.15, 0.2, 16]} />
                <meshStandardMaterial color="#111111" />
            </mesh>
        </group>
    );
}

export default function RacketScene3D({ isPlaying, resetTrigger, primaryColor, secondaryColor }) {
    return (
        <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
            <ambientLight intensity={0.4} />
            {/* Three-Point Studio Lighting */}
            <directionalLight position={[5, 8, 5]} intensity={1} castShadow />
            <directionalLight position={[-5, 2, -5]} intensity={0.5} color="#abcdef" />
            
            <ProceduralRacket isPlaying={isPlaying} primaryColor={primaryColor} secondaryColor={secondaryColor} position={[0, 0, 0]} />
            <Environment preset="city" />
            
            <OrbitControls 
                enableZoom={true} 
                autoRotate={false} 
                enableDamping={true}
                dampingFactor={0.05}
                rotateSpeed={0.8}
                minPolarAngle={Math.PI / 4}
                maxPolarAngle={3 * Math.PI / 4}
            />
            <CameraReset resetTrigger={resetTrigger} />
            <ContactShadows position={[0, -2.5, 0]} opacity={0.35} scale={10} blur={2} far={4} />
        </Canvas>
    );
}
