// ============================================
// KONFIGURACJA APLIKACJI
// ============================================

export const flowerTypes = [
    { id: 'rose', name: 'Róża Czerwona', modelUrl: "models/rose.glb", color: 0xDC143C }, // Karmazynowy
    { id: 'rose_bialy', name: 'Róża Biała', modelUrl: "models/biala_roza.glb", color: 0xFFFFFF }, // Czysta biel
    { id: 'rose_herbaciana', name: 'Róża Herbaciana', modelUrl: "models/herbaciana_roza.glb", color: 0xF4A460 }, // Piaskowy brąz / bursztynowy
    { id: 'rose_rozowa', name: 'Róża Różowa', modelUrl: "models/rozowa_roza.glb", color: 0xFF69B4 }, // Intensywny róż
    { id: 'rose_zolta', name: 'Róża Żółta', modelUrl: "models/zolta_roza.glb", color: 0xFFD700 }, // Złoty żółty
    { id: 'rose_fioletowa', name: 'Róża Fioletowa', modelUrl: "models/fioletowa_roza.glb", color: 0x9370DB }, // Średni fiolet (Medium Purple)
    { id: 'tulipan', name: 'Tulipan', modelUrl: "models/tulipan.glb", color: 0xF6A0A9 },
    { id: 'gozdzik', name: 'Goździk', modelUrl: "models/gozdzik.glb", color: 0xFFA6C9 },
    { id: 'eustoma', name: 'Eustoma', modelUrl: "models/eustoma.glb", color: 0x7851A9 },
    { id: 'irys', name: 'Irys', modelUrl: "models/Irys.glb", color: 0x5D3FD3 },
    { id: 'Gerbera', name: 'Gerbera', modelUrl: "models/Gerbera.glb", color: 0xFF1493 },
    { id: 'Chryzantema', name: 'Chryzantema', modelUrl: "models/Chryzantema.glb", color: 0xFDFDD0 },
];

// ============================================
// LEGACY CONFIG - zachowane dla kompatybilności
// Nowy system używa PLACEMENT_CONFIG z collision.js
// ============================================
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
    minDistance: 2,
    maxDistance: 10,
    defaultDistance: 6,
    rotationSpeed: 0.01,
    zoomSpeed: 0.01
};

// ============================================
// NOWA KONFIGURACJA SPACE-AWARE PLACEMENT
// Te wartości można nadpisać importując PLACEMENT_CONFIG z collision.js
// ============================================
export const BOUQUET_CONFIG = {
    // Promień całego bukietu
    bouquetRadius: 0.45,
    // Minimalny odstęp między kwiatami
    padding: 0.02,
    // Maksymalna liczba prób znalezienia miejsca
    maxPlacementAttempts: 100,
    // Współczynnik skalowania promienia z bounding box
    // Zmniejsz jeśli kwiaty są zbyt daleko od siebie
    // Zwiększ jeśli nachodzą na siebie
    radiusScale: 1.0
};