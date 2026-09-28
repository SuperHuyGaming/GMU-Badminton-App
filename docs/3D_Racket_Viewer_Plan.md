# Interactive 3D Racket Viewer Improvement Plan

This document outlines a concise, 10-point actionable plan to refine the **Interactive 3D Racket Viewer** embedded in the Profile section (`ProfileIntro.jsx` / `RacketViewer.jsx`). Because this is a low-priority feature, all items are intentionally lightweight, self-contained, and strictly scoped to polish visual fidelity, user controls, and performance without introducing heavy dependencies or complex backend requirements.

---

## Phase 1: Performance & Resource Efficiency

### 1. Lazy Loading & Suspense Skeleton
- **Goal:** Prevent the Three.js and `@react-three/fiber` bundle from degrading initial Profile load times.
- **Action:** Code-split `RacketViewer` with `React.lazy()` and wrap it in a `<Suspense>` boundary displaying an MUI `<Skeleton variant="rectangular" height={280} sx={{ borderRadius: 3 }} />`.

### 2. Viewport & Tab Visibility Throttling
- **Goal:** Eliminate unnecessary GPU and battery consumption when the user is not actively viewing the racket.
- **Action:** Use an `IntersectionObserver` or R3F's `frameloop="demand"` to pause rendering and RAF loops when the canvas scrolls out of the viewport or when the browser tab is hidden.

### 3. WebGL Detection & Graceful Fallback
- **Goal:** Ensure low-end or restricted browser environments do not crash or show a broken black canvas.
- **Action:** Detect WebGL support upon mounting. If WebGL is unavailable or context creation fails, gracefully display a neat 2D SVG racket icon with badge metadata instead of an empty box.

---

## Phase 2: UI Controls & Profile Integration

### 4. Auto-Rotate Play/Pause Toggle
- **Goal:** Let users freeze the model in place to inspect frame details without fighting continuous auto-rotation.
- **Action:** Add a small semi-transparent icon button (play/pause) in the top-right overlay of the viewer card that toggles the `useFrame` rotation state.

### 5. Quick Camera Reset & Re-Center Button
- **Goal:** Enable users to quickly recover default framing if they orbit or pan the racket into an awkward orientation.
- **Action:** Add an adjacent reset button overlay that smoothly animates camera position back to `[0, 0, 8]` and resets OrbitControls target to `[0, 0, 0]`.

### 6. Compact Layout & Sticky Sidebar Sizing
- **Goal:** Prevent the 3D viewer from monopolizing vertical space in the left profile sidebar.
- **Action:** Reduce fixed height from `400px` to a compact `260px–280px` container with subtle padding and clean border radius, keeping the player stats and action buttons comfortably above the fold.

---

## Phase 3: Visual Polish & Lighting

### 7. Three-Point Studio Lighting Setup
- **Goal:** Replace flat lighting with studio-quality depth highlighting racket curves and metallic surfaces.
- **Action:** Configure a balanced three-point setup: a soft ambient light (`intensity={0.4}`), a directional key light (`position={[5, 8, 5]}`), and a subtle colored rim light (`position={[-5, 2, -5]}`), paired with soft `ContactShadows` (`opacity={0.35}`).

### 8. Color Theming & Weapon Sync
- **Goal:** Make the 3D racket feel personal and integrated with the profile data.
- **Action:** Bind the grip/frame accent material color to a theme prop or user preference (e.g., default GMU Green `#006633` and Gold `#FFCC33`, or accent colors based on the user's weapon / play style).

---

## Phase 4: Geometry Refinement & Interaction Tuning

### 9. Enhanced Low-Poly Procedural Geometry
- **Goal:** Improve racket aesthetics without loading heavy external `.gltf` / `.glb` files over the network.
- **Action:** Refine primitive composition:
  - Add an isometric cross-string pattern using simple line segments or an optimized low-poly wireframe disc.
  - Add a distinct T-joint connector mesh between head and shaft.
  - Maintain total procedural mesh budget under 500 polygons for instant rendering.

### 10. Smooth OrbitControls Clamping & Damping
- **Goal:** Make touch and mouse interaction smooth and prevent inverted angles on mobile devices.
- **Action:** Configure `OrbitControls` with `enableDamping={true}`, `dampingFactor={0.05}`, `rotateSpeed={0.8}`, and limit polar angles (`minPolarAngle={Math.PI / 4}`, `maxPolarAngle={3 * Math.PI / 4}`) so users cannot flip the racket upside down or clip into the shadow plane.
