// ============================================
// ZARZĄDZANIE KWIATAMI
// Z space-aware placement (circle packing)
// ============================================
import { flowerTypes } from './config.js';
import { getModelFromCache, getModelBounds, getCachedBounds } from './modelLoader.js';
import {
    findBestPosition,
    registerPlacedFlower,
    unregisterFlower,
    updateFlowerPosition,
    clearAllPlacedFlowers,
    getPlacedCount,
    estimateRemainingCapacity,
    PLACEMENT_CONFIG
} from './collision.js';

let flowers = [];
let flowerIdCounter = 0;

/**
 * Generuje unikalne ID dla kwiatu
 */
function generateFlowerId() {
    return `flower_${Date.now()}_${flowerIdCounter++}`;
}

/**
 * Tworzy proceduralny kwiat (fallback)
 */
function createProceduralFlower(type, position) {
    const petalCount = 8;
    const petalGroup = new THREE.Group();

    for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2;
        const petalGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const petalMaterial = new THREE.MeshPhongMaterial({
            color: type.color,
            shininess: 50
        });
        const petal = new THREE.Mesh(petalGeometry, petalMaterial);

        petal.position.x = Math.cos(angle) * 0.4;
        petal.position.z = Math.sin(angle) * 0.4;
        petal.scale.set(0.8, 1.2, 0.5);
        petal.castShadow = true;

        petalGroup.add(petal);
    }

    const centerGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const centerMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00 });
    const center = new THREE.Mesh(centerGeometry, centerMaterial);
    center.castShadow = true;
    petalGroup.add(center);

    const stemGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8);
    const stemMaterial = new THREE.MeshPhongMaterial({ color: 0x228b22 });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.y = -0.75;

    const flower = new THREE.Group();
    flower.add(petalGroup);
    flower.add(stem);

    applyPositionToFlower(flower, position);

    return { flower, radius: 0.15 };
}

/**
 * Aplikuje pozycję i rotację do kwiatu
 */
function applyPositionToFlower(flower, position) {
    flower.position.set(position.x, position.y, position.z);

    // Obróć w kierunku centrum
    if (position.x !== 0 || position.z !== 0) {
        const angleToCenter = Math.atan2(position.x, position.z);
        flower.rotation.y = angleToCenter;
    }

    // Przechyl na zewnątrz
    flower.rotateX(position.tiltAngle);
}

/**
 * Klonuje materiały dla wszystkich mesh w obiekcie
 */
function cloneMaterials(object) {
    object.traverse((child) => {
        if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
                child.material = child.material.map(mat => mat.clone());
            } else {
                child.material = child.material.clone();
            }
        }
    });
}

/**
 * Tworzy kwiat z modelu GLB
 */
async function createFlowerFromGLB(type, position, flowerId) {
    try {
        const { model, bounds } = await getModelFromCache(type.id, type.modelUrl);

        const flower = new THREE.Group();
        flower.add(model);

        cloneMaterials(flower);

        applyPositionToFlower(flower, position);

        flower.userData.flowerType = type;
        flower.userData.flowerId = flowerId;
        flower.userData.bounds = bounds;
        flower.userData.placementPosition = { ...position };

        return { flower, radius: bounds.radiusXZ };
    } catch (error) {
        console.error('Błąd podczas tworzenia kwiatu z GLB:', error);
        const result = createProceduralFlower(type, position);
        result.flower.userData.flowerType = type;
        result.flower.userData.flowerId = flowerId;
        return result;
    }
}

/**
 * Inicjalizuje system kwiatów
 * @param {Array} positions - Legacy: ignorowane w nowym systemie
 */
export function initFlowers(positions = []) {
    flowers = [];
    flowerIdCounter = 0;
    clearAllPlacedFlowers();
    console.log('System kwiatów zainicjalizowany (space-aware placement)');
}

/**
 * Dodaje pojedynczy kwiat do sceny
 * Używa space-aware placement do znalezienia pozycji
 */
export async function addFlower(type, scene) {
    // Pobierz bounds dla typu kwiatu
    const bounds = await getModelBounds(type.id, type.modelUrl);
    const radius = bounds.radiusXZ;

    // Znajdź najlepszą pozycję (findBestPosition sam skaluje radius)
    const position = findBestPosition(radius);

    if (!position) {
        console.warn(`Nie można znaleźć miejsca dla kwiatu ${type.name} (radius: ${radius.toFixed(3)})`);
        return null;
    }

    const flowerId = generateFlowerId();

    // Stwórz kwiat
    const { flower } = await createFlowerFromGLB(type, position, flowerId);

    // Dodaj do sceny
    scene.add(flower);

    // Zarejestruj w systemie kolizji - position.radius to już scaled radius
    registerPlacedFlower(position.x, position.z, position.radius, flowerId);

    // Zapisz w lokalnej tablicy
    flowers.push({
        mesh: flower,
        flowerId,
        radius: position.radius,
        position: { ...position }
    });

    console.log(`Dodano kwiat ${type.name} na pozycji (${position.x.toFixed(2)}, ${position.z.toFixed(2)}), radius: ${position.radius.toFixed(3)}`);

    return flower;
}

/**
 * Zamienia kwiat na inny typ
 */
export async function replaceFlower(oldFlowerMesh, newFlowerType, scene) {
    const flowerIndex = flowers.findIndex(f => f.mesh === oldFlowerMesh);
    if (flowerIndex === -1) {
        console.error('Nie znaleziono kwiatu do zamiany');
        return null;
    }

    const oldFlower = flowers[flowerIndex];
    const oldPosition = oldFlower.position;
    const oldFlowerId = oldFlower.flowerId;

    // Usuń stary kwiat z systemu kolizji
    unregisterFlower(oldFlowerId);

    // Pobierz bounds nowego typu
    const newBounds = await getModelBounds(newFlowerType.id, newFlowerType.modelUrl);
    const newRadius = newBounds.radiusXZ * PLACEMENT_CONFIG.radiusScale;

    // Użyj tej samej pozycji
    let newPosition = { ...oldPosition, radius: newRadius };

    // Usuń stary kwiat ze sceny
    scene.remove(oldFlowerMesh);

    // Stwórz nowy kwiat
    const newFlowerId = generateFlowerId();
    const { flower: newFlower } = await createFlowerFromGLB(newFlowerType, newPosition, newFlowerId);

    // Dodaj do sceny
    scene.add(newFlower);

    // Zarejestruj nowy kwiat
    registerPlacedFlower(newPosition.x, newPosition.z, newRadius, newFlowerId);

    // Zaktualizuj tablicę
    flowers[flowerIndex] = {
        mesh: newFlower,
        flowerId: newFlowerId,
        radius: newRadius,
        position: newPosition
    };

    console.log(`Zamieniono kwiat na ${newFlowerType.name}`);

    return newFlower;
}

/**
 * Usuwa konkretny kwiat ze sceny
 */
export function deleteFlower(flowerMesh, scene) {
    const flowerIndex = flowers.findIndex(f => f.mesh === flowerMesh);
    if (flowerIndex === -1) {
        console.error('Nie znaleziono kwiatu do usunięcia');
        return false;
    }

    const flower = flowers[flowerIndex];

    // Usuń ze sceny
    scene.remove(flowerMesh);

    // Usuń z systemu kolizji
    unregisterFlower(flower.flowerId);

    // Usuń z tablicy
    flowers.splice(flowerIndex, 1);

    console.log(`Usunięto kwiat ${flower.flowerId}`);
    return true;
}

/**
 * Usuwa ostatni dodany kwiat
 */
export function removeLastFlower(scene) {
    if (flowers.length === 0) return null;

    const lastFlower = flowers.pop();
    scene.remove(lastFlower.mesh);
    unregisterFlower(lastFlower.flowerId);

    return lastFlower;
}

/**
 * Czyści wszystkie kwiaty ze sceny
 */
export function clearAllFlowers(scene) {
    flowers.forEach(flower => {
        scene.remove(flower.mesh);
    });
    flowers = [];
    clearAllPlacedFlowers();
    console.log('Wyczyszczono wszystkie kwiaty');
}

/**
 * Generuje pełny bukiet z jednego typu kwiatu
 * Używa circle packing do optymalnego rozmieszczenia
 */
export async function generateFullBouquet(flowerType, scene) {
    clearAllFlowers(scene);

    if (!flowerType) {
        console.error("Nie wybrano typu kwiatu.");
        return;
    }

    // Pobierz bounds
    const bounds = await getModelBounds(flowerType.id, flowerType.modelUrl);
    const radius = bounds.radiusXZ;

    console.log(`Generowanie bukietu z ${flowerType.name} (radius: ${radius.toFixed(3)})...`);

    // Dodawaj kwiaty dopóki jest miejsce
    let addedCount = 0;
    let failedAttempts = 0;
    const maxFailedAttempts = 5;

    while (failedAttempts < maxFailedAttempts) {
        const flower = await addFlower(flowerType, scene);

        if (flower) {
            addedCount++;
            failedAttempts = 0;
        } else {
            failedAttempts++;
        }

        // Bezpiecznik - maksymalna liczba kwiatów
        if (addedCount >= 50) break;
    }

    console.log(`Wygenerowano bukiet z ${addedCount} kwiatami ${flowerType.name}`);
}

/**
 * Generuje SKOMPRESOWANY URL z zakodowanym stanem bukietu
 */
export function getBouquetUrl() {
    if (flowers.length === 0) {
        const url = new URL(window.location.href);
        url.searchParams.delete('b');
        return url.toString();
    }

    // Format: [typeIndex, x, z, y, tilt] dla każdego kwiatu
    const bouquetData = flowers.map(f => {
        const typeIndex = flowerTypes.findIndex(t => t.id === f.mesh.userData.flowerType.id);
        const pos = f.position;
        return [
            typeIndex,
            Math.round(pos.x * 1000) / 1000,
            Math.round(pos.z * 1000) / 1000,
            Math.round(pos.y * 1000) / 1000,
            Math.round(pos.tiltAngle * 1000) / 1000
        ];
    });

    const jsonString = JSON.stringify(bouquetData);
    const encodedData = btoa(jsonString);

    const url = new URL(window.location.href);
    url.searchParams.set('b', encodedData);

    return url.toString();
}

/**
 * Wczytuje bukiet z URL
 */
export async function loadBouquetFromUrl(scene) {
    const params = new URLSearchParams(window.location.search);
    const encodedData = params.get('b');

    if (!encodedData) return;

    try {
        console.log("Wczytywanie bukietu z linku...");
        const jsonString = atob(encodedData);
        const bouquetData = JSON.parse(jsonString);

        clearAllFlowers(scene);

        for (const item of bouquetData) {
            let typeIndex, x, z, y, tiltAngle;

            // Obsługa starego formatu [positionIndex, typeIndex]
            if (item.length === 2) {
                // Stary format - konwertuj na nowy
                typeIndex = item[1];
                const type = flowerTypes[typeIndex];
                if (type) {
                    await addFlower(type, scene);
                }
                continue;
            }

            // Nowy format [typeIndex, x, z, y, tilt]
            [typeIndex, x, z, y, tiltAngle] = item;

            const type = flowerTypes[typeIndex];
            if (!type) continue;

            const bounds = await getModelBounds(type.id, type.modelUrl);
            const radius = bounds.radiusXZ;

            const position = { x, z, y, tiltAngle, radius };
            const flowerId = generateFlowerId();

            const { flower } = await createFlowerFromGLB(type, position, flowerId);
            scene.add(flower);

            registerPlacedFlower(x, z, radius, flowerId);

            flowers.push({
                mesh: flower,
                flowerId,
                radius,
                position
            });
        }

        console.log(`Wczytano bukiet z ${flowers.length} kwiatami z URL.`);

    } catch (error) {
        console.error("Błąd podczas wczytywania bukietu z URL:", error);
    }
}

/**
 * Aktualizuje pozycję kwiatu po edycji w gizmo
 * @param {THREE.Object3D} flowerMesh
 */
export function syncFlowerPositionAfterEdit(flowerMesh) {
    const flowerData = flowers.find(f => f.mesh === flowerMesh);
    if (!flowerData) return;

    const newX = flowerMesh.position.x;
    const newZ = flowerMesh.position.z;

    // Aktualizuj w systemie kolizji
    updateFlowerPosition(flowerData.flowerId, newX, newZ);

    // Aktualizuj lokalną pozycję
    flowerData.position.x = newX;
    flowerData.position.z = newZ;
    flowerData.position.y = flowerMesh.position.y;
}

/**
 * Gettery dla stanu kwiatów
 */
export function getFlowersCount() {
    return flowers.length;
}

/**
 * Zwraca listę wszystkich kwiatów
 */
export function getFlowersList() {
    return [...flowers];
}

export function getAvailablePositionsCount() {
    // Szacuj ile jeszcze kwiatów zmieści się
    const avgRadius = flowers.length > 0
        ? flowers.reduce((sum, f) => sum + f.radius, 0) / flowers.length
        : PLACEMENT_CONFIG.defaultRadius;

    return estimateRemainingCapacity(avgRadius);
}

export function getTotalPositions() {
    // Szacowana maksymalna pojemność
    const avgRadius = 0.08;
    const totalArea = Math.PI * PLACEMENT_CONFIG.bouquetRadius * PLACEMENT_CONFIG.bouquetRadius;
    const avgFlowerArea = Math.PI * avgRadius * avgRadius;
    return Math.floor(totalArea * 0.6 / avgFlowerArea);
}

// ============================================
// LEGACY SUPPORT
// ============================================

/**
 * Legacy: Generuje pozycje kwiatów (dla kompatybilności)
 * W nowym systemie nie używamy stałych pozycji
 */
export function generateFlowerPositions(ringsConfig, includeCenter) {
    console.log('generateFlowerPositions: Legacy function, pozycje są teraz generowane dynamicznie');
    return [];
}