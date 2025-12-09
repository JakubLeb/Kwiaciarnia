// ============================================
// KONFIGURACJA APLIKACJI
// ============================================

export const flowerTypes = [
    { id: 'rose', name: 'Róża', modelUrl: "models/rose.glb", color: 0xff0000 },
    { id: 'gozdzik', name: 'Goździk', modelUrl: "models/gozdzik.glb", color: 0xffc0cb },
    { id: 'lily', name: 'Lilia', modelUrl: "models/lilia.glb", color: 0xffffff },
    { id: 'eustoma', name: 'Eustoma', modelUrl: "models/eustoma.glb", color: 0x800080 },
];

export const BOUQUET_RINGS_CONFIG = [
    { count: 4, radius: 0.1, y: -0.05, tilt: 15 },
    { count: 8, radius: 0.2, y: -0.1, tilt: 30 },
    { count: 12, radius: 0.3, y: -0.15, tilt: 45 },
    { count: 16, radius: 0.35, y: -0.2, tilt: 60 }
];

export const INCLUDE_CENTER_FLOWER = true;

export const SCENE_CONFIG = {
    backgroundColor: 0xf0f0f0,
    cameraFov: 50,
    cameraNear: 0.1,
    cameraFar: 1000,
    cameraInitialPosition: { x: 0, y: 5, z: 10 },
    ambientLightIntensity: 0.6,
    directionalLightIntensity: 0.8,
    pointLightIntensity: 0.4
};

export const CAMERA_CONTROLS_CONFIG = {
    minDistance: 3,
    maxDistance: 10,
    defaultDistance: 6,
    rotationSpeed: 0.01,
    zoomSpeed: 0.01
};