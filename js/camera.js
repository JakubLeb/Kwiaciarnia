// ============================================
// KONTROLKI KAMERY
// ============================================

import { CAMERA_CONTROLS_CONFIG } from './config.js';
import { isGizmoDragging } from './Raycaster.js';

let camera, domElement;
let isRotating = false;
let isZooming = false;

// Stan kamery
let spherical = {
    radius: CAMERA_CONTROLS_CONFIG.defaultDistance,
    theta: 0,
    phi: Math.PI / 4
};

// Pozycje myszy/dotyku
let previousMousePosition = { x: 0, y: 0 };
let previousTouchDistance = 0;

// Zmienne do rozróżnienia tap vs drag na urządzeniach dotykowych
let touchStartTime = 0;
let touchStartPosition = { x: 0, y: 0 };
let touchMoved = false;
const TAP_THRESHOLD_TIME = 300;
const TAP_THRESHOLD_DISTANCE = 10;

/**
 * Konfiguruje kontrolki kamery
 */
export function setupCameraControls(cameraRef, domElementRef) {
    camera = cameraRef;
    domElement = domElementRef;

    // Obsługa myszy
    domElement.addEventListener('mousedown', onMouseDown);
    domElement.addEventListener('mousemove', onMouseMove);
    domElement.addEventListener('mouseup', onMouseUp);
    domElement.addEventListener('mouseleave', onMouseUp);
    domElement.addEventListener('wheel', onWheel, { passive: false });

    // Obsługa dotyku
    domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    domElement.addEventListener('touchend', onTouchEnd, { passive: false });

    // Początkowa aktualizacja pozycji kamery
    updateCameraPosition();
}

/**
 * Aktualizuje pozycję kamery na podstawie współrzędnych sferycznych
 */
function updateCameraPosition() {
    // Ogranicz phi (kąt pionowy)
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

    // Ogranicz radius (zoom)
    spherical.radius = Math.max(
        CAMERA_CONTROLS_CONFIG.minDistance,
        Math.min(CAMERA_CONTROLS_CONFIG.maxDistance, spherical.radius)
    );

    // Konwersja współrzędnych sferycznych na kartezjańskie
    camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
    camera.position.y = spherical.radius * Math.cos(spherical.phi);
    camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);

    camera.lookAt(0, 0, 0);
}

// ============================================
// OBSŁUGA MYSZY
// ============================================

function onMouseDown(event) {
    // Nie rozpoczynaj rotacji kamery jeśli przeciągamy gizmo
    if (isGizmoDragging()) return;

    if (event.button === 0) {
        isRotating = true;
        previousMousePosition = { x: event.clientX, y: event.clientY };
    }
}

function onMouseMove(event) {
    // Nie obracaj kamery jeśli przeciągamy gizmo
    if (isGizmoDragging()) {
        isRotating = false;
        return;
    }

    if (!isRotating) return;

    const deltaX = event.clientX - previousMousePosition.x;
    const deltaY = event.clientY - previousMousePosition.y;

    spherical.theta -= deltaX * CAMERA_CONTROLS_CONFIG.rotationSpeed;
    spherical.phi += deltaY * CAMERA_CONTROLS_CONFIG.rotationSpeed;

    previousMousePosition = { x: event.clientX, y: event.clientY };
    updateCameraPosition();
}

function onMouseUp() {
    isRotating = false;
}

function onWheel(event) {
    event.preventDefault();
    spherical.radius += event.deltaY * CAMERA_CONTROLS_CONFIG.zoomSpeed;
    updateCameraPosition();
}

// ============================================
// OBSŁUGA DOTYKU
// ============================================

function onTouchStart(event) {
    // Nie rozpoczynaj jeśli przeciągamy gizmo
    if (isGizmoDragging()) return;

    touchStartTime = Date.now();
    touchMoved = false;

    if (event.touches.length === 1) {
        isRotating = true;
        previousMousePosition = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY
        };
        touchStartPosition = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY
        };
    } else if (event.touches.length === 2) {
        isRotating = false;
        isZooming = true;
        previousTouchDistance = getTouchDistance(event.touches);
    }
}

function onTouchMove(event) {
    // Nie obracaj kamery jeśli przeciągamy gizmo
    if (isGizmoDragging()) {
        isRotating = false;
        isZooming = false;
        return;
    }

    if (event.touches.length === 1) {
        const dx = event.touches[0].clientX - touchStartPosition.x;
        const dy = event.touches[0].clientY - touchStartPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > TAP_THRESHOLD_DISTANCE) {
            touchMoved = true;
        }
    } else {
        touchMoved = true;
    }

    if (event.touches.length === 1 && isRotating && touchMoved) {
        event.preventDefault();

        const deltaX = event.touches[0].clientX - previousMousePosition.x;
        const deltaY = event.touches[0].clientY - previousMousePosition.y;

        spherical.theta -= deltaX * CAMERA_CONTROLS_CONFIG.rotationSpeed;
        spherical.phi += deltaY * CAMERA_CONTROLS_CONFIG.rotationSpeed;

        previousMousePosition = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY
        };
        updateCameraPosition();
    } else if (event.touches.length === 2 && isZooming) {
        event.preventDefault();

        const currentDistance = getTouchDistance(event.touches);
        const delta = previousTouchDistance - currentDistance;

        spherical.radius += delta * CAMERA_CONTROLS_CONFIG.zoomSpeed * 0.5;
        previousTouchDistance = currentDistance;
        updateCameraPosition();
    }
}

function onTouchEnd(event) {
    const touchDuration = Date.now() - touchStartTime;

    if (!touchMoved && touchDuration < TAP_THRESHOLD_TIME) {
        console.log('Tap detected - allowing click propagation');
    }

    isRotating = false;
    isZooming = false;
    touchMoved = false;
}

/**
 * Oblicza odległość między dwoma punktami dotyku
 */
function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Gettery dla stanu kamery
 */
export function getCameraState() {
    return { ...spherical };
}

export function setCameraState(newState) {
    spherical = { ...spherical, ...newState };
    updateCameraPosition();
}