# WebGPU Galaxy Simulation

This project simulates a Solar System (Sun + 7 Planets) using Three.js and WebGPU Compute Shaders. It features real-time interaction using hand gestures captured via the webcam to control the position of the Sun, affecting the orbits of the planets.

## Features

- **WebGPU Compute Shaders**: High-performance physics simulation for planetary orbits.
- **Three.js TSL**: Uses the new Three Shading Language for materials and compute logic.
- **Hand Tracking**: Real-time control using MediaPipe HandLandmarker.
- **Visuals**: 
  - Sun and 7 Planets (Mercury to Neptune) with relative sizes and colors.
  - Orbital paths visualization.
  - Dynamic text labels.

## Requirements

- A browser with WebGPU support (Chrome 113+, Edge, etc.)
- A webcam for interaction

## How to Run

Since this project uses ES Modules and WebGPU, you need to serve it with a local web server.

### Using VS Code
1. Install the "Live Server" extension.
2. Right-click `index.html` and select "Open with Live Server".

### Using Python
Run this command in the project directory:
```bash
python -m http.server
```
Then open `http://localhost:8000`.

### Using Node.js
```bash
npx serve .
```

## Controls

1. Click **Start Camera** to enable gesture control.
2. Allow camera access.
3. **Move your hand**: The Sun follows your hand position in 3D space.
4. **Pinch (Thumb + Index)**: Zoom In.
5. **Open Hand**: Zoom Out.
6. **Closed Fist**: Stop/Freeze the Sun's position.
7. **Planets**: The planets will gravitationally react to the Sun's new position.
8. **Mouse Control**: If the camera is not active, the mouse can be used to move the Sun.
9. **Action Buttons**: Use the on-screen buttons to manually Zoom In, Zoom Out, or Freeze the simulation. These buttons override gesture inputs.
