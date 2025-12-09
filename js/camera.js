// ============================================
// KONTROLA KAMERY
// ============================================

import { CAMERA_CONTROLS_CONFIG } from './config.js';

let camera;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let cameraAngle = { theta: 0, phi: Math.PI / 4 };
let cameraDistance = CAMERA_CONTROLS_CONFIG.defaultDistance;

/**
 * Aktualizuje pozycję kamery na podstawie kątów i dystansu
 */
export function updateCameraPosition() {
    const theta = cameraAngle.theta;
    const phi = cameraAngle.phi;
    const distance = cameraDistance;

    camera.position.x = distance * Math.sin(phi) * Math.cos(theta);
    camera.position.y = distance * Math.cos(phi);
    camera.position.z = distance * Math.sin(phi) * Math.sin(theta);
    camera.lookAt(0, 0, 0);

    camera.updateMatrixWorld();
}

/**
 * Inicjalizuje kontrolki kamery
 */
export function setupCameraControls(cameraObj, canvas) {
    camera = cameraObj;

    // Obsługa myszy - przeciąganie
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        cameraAngle.theta += deltaX * CAMERA_CONTROLS_CONFIG.rotationSpeed;
        cameraAngle.phi += deltaY * CAMERA_CONTROLS_CONFIG.rotationSpeed;

        // Ograniczenie kąta phi
        cameraAngle.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraAngle.phi));

        previousMousePosition = { x: e.clientX, y: e.clientY };
        updateCameraPosition();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Obsługa scroll - zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        cameraDistance += e.deltaY * CAMERA_CONTROLS_CONFIG.zoomSpeed;
        cameraDistance = Math.max(
            CAMERA_CONTROLS_CONFIG.minDistance,
            Math.min(CAMERA_CONTROLS_CONFIG.maxDistance, cameraDistance)
        );
        updateCameraPosition();
    });

    // Początkowa pozycja
    updateCameraPosition();
}

/**
 * Resetuje kamerę do pozycji domyślnej
 */
export function resetCamera() {
    cameraAngle = { theta: 0, phi: Math.PI / 4 };
    cameraDistance = CAMERA_CONTROLS_CONFIG.defaultDistance;
    updateCameraPosition();
}

/**
 * Ustawia konkretny widok kamery
 */
export function setCameraView(theta, phi, distance) {
    cameraAngle.theta = theta;
    cameraAngle.phi = phi;
    cameraDistance = distance;
    updateCameraPosition();
}