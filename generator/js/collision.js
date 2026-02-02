// ============================================
// SYSTEM KOLIZJI I SPACE-AWARE PLACEMENT
// Circle Packing z różnymi promieniami
// ============================================

/**
 * Struktura przechowująca informacje o zajętych przestrzeniach
 */
let placedCircles = [];

/**
 * Konfiguracja systemu placement
 */
export const PLACEMENT_CONFIG = {
    // Minimalny odstęp między kwiatami
    padding: 0.03,
    // Maksymalna liczba prób znalezienia miejsca
    maxAttempts: 150,
    // Promień obszaru bukietu (w XZ) - ZWIĘKSZONY dla więcej kwiatów
    bouquetRadius: 0.8,
    // Parametry dla poisson disk sampling
    poissonMinDistance: 0.02,
    // Współczynnik skalowania promienia z bounding box
    radiusScale: 0.45,
    // Domyślny promień jeśli nie można obliczyć
    defaultRadius: 0.08,
    // Centrum bukietu
    center: { x: 0, z: 0 },
    // Konfiguracja pierścieni (dla fallback i initial seeding)
    rings: [
        { radius: 0, maxFlowers: 1, tilt: 0, yOffset: 0 },
        { radius: 0.12, maxFlowers: 5, tilt: 15, yOffset: -0.05 },
        { radius: 0.22, maxFlowers: 8, tilt: 30, yOffset: -0.1 },
        { radius: 0.32, maxFlowers: 12, tilt: 45, yOffset: -0.15 },
        { radius: 0.42, maxFlowers: 16, tilt: 55, yOffset: -0.2 }
    ]
};

/**
 * Oblicza informacje o rozmiarze kwiatu z modelu 3D
 * @param {THREE.Object3D} model - Model kwiatu
 * @returns {Object} - { radiusXZ, height, boundingBox }
 */
export function calculateFlowerBounds(model) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());

    // Promień w rzucie z góry (XZ) - bierzemy większy z wymiarów
    const radiusXZ = Math.max(size.x, size.z) / 2;

    // Wysokość
    const height = size.y;

    return {
        radiusXZ: radiusXZ * PLACEMENT_CONFIG.radiusScale,
        height,
        boundingBox: box,
        size
    };
}

/**
 * Sprawdza czy dwa okręgi kolidują w 2D (widok z góry)
 * @param {Object} circle1 - { x, z, radius }
 * @param {Object} circle2 - { x, z, radius }
 * @returns {boolean}
 */
export function checkCircleCollision(circle1, circle2) {
    const dx = circle1.x - circle2.x;
    const dz = circle1.z - circle2.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const minDistance = circle1.radius + circle2.radius + PLACEMENT_CONFIG.padding;

    return distance < minDistance;
}

/**
 * Sprawdza czy pozycja koliduje z którymkolwiek z umieszczonych kwiatów
 * @param {number} x
 * @param {number} z
 * @param {number} radius
 * @returns {boolean}
 */
export function hasCollision(x, z, radius) {
    const newCircle = { x, z, radius };

    for (const placed of placedCircles) {
        if (checkCircleCollision(newCircle, placed)) {
            return true;
        }
    }

    return false;
}

/**
 * Sprawdza czy pozycja mieści się w granicach bukietu
 * @param {number} x
 * @param {number} z
 * @param {number} radius
 * @returns {boolean}
 */
export function isWithinBouquetBounds(x, z, radius) {
    const distanceFromCenter = Math.sqrt(x * x + z * z);
    return distanceFromCenter + radius <= PLACEMENT_CONFIG.bouquetRadius;
}

/**
 * Znajduje najlepszą pozycję dla kwiatu używając ring-based placement
 * Kwiaty są dodawane w koncentrycznych pierścieniach dla okrągłego kształtu
 * @param {number} radius - Promień kwiatu w XZ
 * @param {Object} options - Opcje placement
 * @returns {Object|null} - { x, z, y, tiltAngle } lub null jeśli nie znaleziono
 */
export function findBestPosition(radius, options = {}) {
    const scaledRadius = radius * PLACEMENT_CONFIG.radiusScale;

    console.log(`findBestPosition: szukam miejsca dla radius=${radius.toFixed(3)}, scaled=${scaledRadius.toFixed(3)}, placed=${placedCircles.length}`);

    // Strategia 1: Centrum jeśli puste
    if (placedCircles.length === 0) {
        const centerPos = tryPosition(0, 0, scaledRadius);
        if (centerPos) {
            console.log('  → znaleziono w centrum');
            return centerPos;
        }
    }

    // Strategia 2: Ring-based placement - szukaj miejsca w pierścieniach
    const ringPosition = findRingPosition(scaledRadius);
    if (ringPosition) {
        console.log(`  → znaleziono ring na (${ringPosition.x.toFixed(3)}, ${ringPosition.z.toFixed(3)})`);
        return ringPosition;
    }

    // Strategia 3: Fallback - losowe próbkowanie
    const randomPosition = findRandomPosition(scaledRadius);
    if (randomPosition) {
        console.log(`  → znaleziono random na (${randomPosition.x.toFixed(3)}, ${randomPosition.z.toFixed(3)})`);
        return randomPosition;
    }

    console.log('  → NIE ZNALEZIONO miejsca!');
    return null;
}

/**
 * Próbuje umieścić kwiat w konkretnej pozycji
 */
function tryPosition(x, z, radius, ringIndex = null) {
    if (!isWithinBouquetBounds(x, z, radius)) return null;
    if (hasCollision(x, z, radius)) return null;

    // Oblicz parametry na podstawie odległości od centrum
    const distanceFromCenter = Math.sqrt(x * x + z * z);
    const normalizedDistance = distanceFromCenter / PLACEMENT_CONFIG.bouquetRadius;

    // Y offset i tilt bazowane na odległości od centrum
    const y = -normalizedDistance * 0.2;
    const tiltAngle = normalizedDistance * 55 * (Math.PI / 180);

    return { x, z, y, tiltAngle, radius };
}

/**
 * Znajduje pozycję w pierścieniach koncentrycznych
 * Zaczyna od najbliższego pierścienia i idzie na zewnątrz
 */
function findRingPosition(scaledRadius) {
    const minRingRadius = scaledRadius * 2; // Minimalny pierścień (zaraz za centrum)
    const ringStep = scaledRadius * 1.8; // Odstęp między pierścieniami

    // Próbuj pierścienie od środka na zewnątrz
    for (let ringRadius = minRingRadius; ringRadius < PLACEMENT_CONFIG.bouquetRadius - scaledRadius; ringRadius += ringStep) {

        // Oblicz ile kwiatów zmieści się w tym pierścieniu
        const circumference = 2 * Math.PI * ringRadius;
        const flowerDiameter = (scaledRadius * 2) + PLACEMENT_CONFIG.padding;
        const maxFlowersInRing = Math.floor(circumference / flowerDiameter);
        const angleStep = (Math.PI * 2) / Math.max(maxFlowersInRing, 6);

        // Losowy offset startowy dla naturalnego wyglądu
        const startAngle = (placedCircles.length * 0.618033988749) * Math.PI * 2; // Golden ratio

        // Próbuj pozycje w tym pierścieniu
        const candidates = [];

        for (let i = 0; i < maxFlowersInRing; i++) {
            const angle = startAngle + (i * angleStep);
            const x = Math.cos(angle) * ringRadius;
            const z = Math.sin(angle) * ringRadius;

            const pos = tryPosition(x, z, scaledRadius);
            if (pos) {
                // Score: preferuj równomierne rozmieszczenie
                let minDistToExisting = Infinity;
                for (const existing of placedCircles) {
                    const dist = Math.sqrt((x - existing.x) ** 2 + (z - existing.z) ** 2);
                    minDistToExisting = Math.min(minDistToExisting, dist);
                }
                candidates.push({ ...pos, score: -minDistToExisting }); // Większa odległość = lepiej
            }
        }

        // Wybierz najlepszą pozycję w tym pierścieniu (najdalej od istniejących)
        if (candidates.length > 0) {
            candidates.sort((a, b) => a.score - b.score);
            return candidates[0];
        }
    }

    return null;
}

/**
 * Losowe próbkowanie (Poisson disk sampling style)
 */
function findRandomPosition(scaledRadius) {
    for (let attempt = 0; attempt < PLACEMENT_CONFIG.maxAttempts; attempt++) {
        // Losowy punkt w okręgu
        const r = Math.sqrt(Math.random()) * (PLACEMENT_CONFIG.bouquetRadius - scaledRadius);
        const theta = Math.random() * Math.PI * 2;

        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;

        const pos = tryPosition(x, z, scaledRadius);
        if (pos) return pos;
    }

    return null;
}

/**
 * Rejestruje umieszczony kwiat w systemie kolizji
 * @param {number} x
 * @param {number} z
 * @param {number} radius
 * @param {string} flowerId - ID kwiatu dla późniejszego usunięcia
 */
export function registerPlacedFlower(x, z, radius, flowerId) {
    placedCircles.push({ x, z, radius, flowerId });
}

/**
 * Usuwa kwiat z systemu kolizji
 * @param {string} flowerId
 */
export function unregisterFlower(flowerId) {
    placedCircles = placedCircles.filter(c => c.flowerId !== flowerId);
}

/**
 * Aktualizuje pozycję kwiatu w systemie kolizji
 * @param {string} flowerId
 * @param {number} x
 * @param {number} z
 */
export function updateFlowerPosition(flowerId, x, z) {
    const circle = placedCircles.find(c => c.flowerId === flowerId);
    if (circle) {
        circle.x = x;
        circle.z = z;
    }
}

/**
 * Czyści wszystkie zarejestrowane kwiaty
 */
export function clearAllPlacedFlowers() {
    placedCircles = [];
}

/**
 * Zwraca liczbę umieszczonych kwiatów
 */
export function getPlacedCount() {
    return placedCircles.length;
}

/**
 * Zwraca wszystkie umieszczone okręgi (do debugowania)
 */
export function getPlacedCircles() {
    return [...placedCircles];
}

/**
 * Szacuje ile jeszcze kwiatów zmieści się w bukiecie
 * @param {number} avgRadius - Średni promień kwiatów
 * @returns {number}
 */
export function estimateRemainingCapacity(avgRadius = PLACEMENT_CONFIG.defaultRadius) {
    const totalArea = Math.PI * PLACEMENT_CONFIG.bouquetRadius * PLACEMENT_CONFIG.bouquetRadius;
    const usedArea = placedCircles.reduce((sum, c) => sum + Math.PI * c.radius * c.radius, 0);
    const avgFlowerArea = Math.PI * avgRadius * avgRadius;

    // Współczynnik pakowania ~0.6 dla circle packing
    const packingEfficiency = 0.6;
    const availableArea = (totalArea - usedArea) * packingEfficiency;

    return Math.max(0, Math.floor(availableArea / avgFlowerArea));
}

/**
 * Generuje pozycje dla pełnego bukietu używając Poisson disk sampling
 * @param {Array} flowerRadii - Tablica promieni kwiatów do umieszczenia
 * @returns {Array} - Tablica pozycji
 */
export function generateBouquetPositions(flowerRadii) {
    clearAllPlacedFlowers();
    const positions = [];

    // Sortuj od największych do najmniejszych (duże najpierw)
    const sortedRadii = [...flowerRadii].sort((a, b) => b - a);

    for (const radius of sortedRadii) {
        const pos = findBestPosition(radius);
        if (pos) {
            const flowerId = `flower_${positions.length}`;
            registerPlacedFlower(pos.x, pos.z, pos.radius, flowerId);
            positions.push({ ...pos, flowerId });
        }
    }

    return positions;
}

/**
 * Debug: Tworzy wizualizację zajętych przestrzeni
 * @param {THREE.Scene} scene
 */
export function debugVisualizePlacement(scene) {
    // Usuń poprzednie debug obiekty
    const oldDebug = scene.getObjectByName('placementDebug');
    if (oldDebug) scene.remove(oldDebug);

    const debugGroup = new THREE.Group();
    debugGroup.name = 'placementDebug';

    // Rysuj granicę bukietu
    const boundaryGeom = new THREE.RingGeometry(
        PLACEMENT_CONFIG.bouquetRadius - 0.01,
        PLACEMENT_CONFIG.bouquetRadius,
        64
    );
    const boundaryMat = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3
    });
    const boundary = new THREE.Mesh(boundaryGeom, boundaryMat);
    boundary.rotation.x = -Math.PI / 2;
    boundary.position.y = 0.01;
    debugGroup.add(boundary);

    // Rysuj umieszczone okręgi
    for (const circle of placedCircles) {
        const circleGeom = new THREE.RingGeometry(
            circle.radius - 0.005,
            circle.radius,
            32
        );
        const circleMat = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.5
        });
        const circleMesh = new THREE.Mesh(circleGeom, circleMat);
        circleMesh.rotation.x = -Math.PI / 2;
        circleMesh.position.set(circle.x, 0.02, circle.z);
        debugGroup.add(circleMesh);
    }

    scene.add(debugGroup);
}

/**
 * Usuwa wizualizację debug
 * @param {THREE.Scene} scene
 */
export function removeDebugVisualization(scene) {
    const oldDebug = scene.getObjectByName('placementDebug');
    if (oldDebug) scene.remove(oldDebug);
}