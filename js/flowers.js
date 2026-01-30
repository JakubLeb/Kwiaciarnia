// ============================================
// ZARZĄDZANIE KWIATAMI
// ============================================
import { flowerTypes } from './config.js';
import { getModelFromCache } from './modelLoader.js';

let flowers = [];
let availablePositions = [];
let flowerPositions = [];

/**
 * Generuje pozycje kwiatów w układzie pierścieniowym
 */
export function generateFlowerPositions(ringsConfig, includeCenter) {
    const positions = [];

    if (includeCenter) {
        positions.push({
            x: 0,
            z: 0,
            y: 0,
            tiltAngle: 0
        });
    }

    for (const config of ringsConfig) {
        const { count, radius, y, tilt, offset = 0 } = config;
        const tiltInRadians = tilt * Math.PI / 180;

        for (let i = 0; i < count; i++) {
            const rotationAngle = (i / count) * Math.PI * 2 + offset;
            const x = Math.cos(rotationAngle) * radius;
            const z = Math.sin(rotationAngle) * radius;

            positions.push({
                x: x,
                z: z,
                y: y,
                tiltAngle: tiltInRadians
            });
        }
    }

    return positions;
}

/**
 * Tworzy proceduralny kwiat (fallback)
 */
function createProceduralFlower(type, positionIndex) {
    const position = flowerPositions[positionIndex];

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

    flower.position.set(position.x, position.y, position.z);

    if (position.x !== 0 || position.z !== 0) {
        const angleToCenter = Math.atan2(position.x, position.z);
        flower.rotation.y = angleToCenter;
    }

    flower.rotateX(position.tiltAngle);

    return flower;
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
async function createFlowerFromGLB(type, positionIndex) {
    const position = flowerPositions[positionIndex];

    try {
        const model = await getModelFromCache(type.id, type.modelUrl);

        const flower = new THREE.Group();
        flower.add(model);

        cloneMaterials(flower);

        flower.position.set(position.x, position.y, position.z);

        if (position.x !== 0 || position.z !== 0) {
            const angleToCenter = Math.atan2(position.x, position.z);
            flower.rotation.y = angleToCenter;
        }

        flower.rotateX(position.tiltAngle);

        flower.userData.flowerType = type;
        flower.userData.positionIndex = positionIndex;

        return flower;
    } catch (error) {
        console.error('Błąd podczas tworzenia kwiatu z GLB:', error);
        return createProceduralFlower(type, positionIndex);
    }
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

    const positionIndex = flowers[flowerIndex].positionIndex;

    scene.remove(oldFlowerMesh);

    const newFlower = await createFlowerFromGLB(newFlowerType, positionIndex);

    scene.add(newFlower);

    flowers[flowerIndex].mesh = newFlower;

    console.log(`Zamieniono kwiat na ${newFlowerType.name}`);

    return newFlower;
}

/**
 * Inicjalizuje system kwiatów
 */
export function initFlowers(positions) {
    flowerPositions = positions;
    availablePositions = Array.from({ length: positions.length }, (_, i) => i);
    flowers = [];
}

/**
 * Dodaje pojedynczy kwiat do sceny
 */
export async function addFlower(type, scene) {
    if (availablePositions.length === 0) return null;

    const positionIndex = availablePositions[0];
    const flower = await createFlowerFromGLB(type, positionIndex);

    scene.add(flower);
    flowers.push({ mesh: flower, positionIndex });
    availablePositions.shift();

    return flower;
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

    scene.remove(flowerMesh);

    availablePositions.unshift(flower.positionIndex);
    availablePositions.sort((a, b) => a - b);

    flowers.splice(flowerIndex, 1);

    console.log(`Usunięto kwiat z pozycji ${flower.positionIndex}`);
    return true;
}

/**
 * Usuwa ostatni dodany kwiat
 */
export function removeLastFlower(scene) {
    if (flowers.length === 0) return null;

    const lastFlower = flowers.pop();
    scene.remove(lastFlower.mesh);
    availablePositions.unshift(lastFlower.positionIndex);

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
    availablePositions = Array.from({ length: flowerPositions.length }, (_, i) => i);
}

/**
 * Generuje pełny bukiet
 */
export async function generateFullBouquet(flowerType, scene) {
    clearAllFlowers(scene);

    if (!flowerType) {
        console.error("Nie wybrano typu kwiatu.");
        return;
    }

    await createFlowerFromGLB(flowerType, 0);
    console.log(`Model dla ${flowerType.name} jest gotowy w cache.`);

    const totalPositions = flowerPositions.length;
    console.log(`Generowanie ${totalPositions} instancji kwiatów...`);

    for (let i = 0; i < totalPositions; i++) {
        const flower = await createFlowerFromGLB(flowerType, i);
        scene.add(flower);
        flowers.push({ mesh: flower, positionIndex: i });
        availablePositions.shift();
    }

    console.log("Bukiet pomyślnie wygenerowany.");
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

    const bouquetData = flowers.map(f => {
        const typeIndex = flowerTypes.findIndex(t => t.id === f.mesh.userData.flowerType.id);
        return [f.positionIndex, typeIndex];
    });

    const jsonString = JSON.stringify(bouquetData);
    const encodedData = btoa(jsonString);

    const url = new URL(window.location.href);
    url.searchParams.set('b', encodedData);

    return url.toString();
}

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
            const positionIndex = item[0];
            const typeIndex = item[1];

            const type = flowerTypes[typeIndex];

            if (type) {
                const flower = await createFlowerFromGLB(type, positionIndex);
                scene.add(flower);
                flowers.push({ mesh: flower, positionIndex: positionIndex });
                availablePositions = availablePositions.filter(pos => pos !== positionIndex);
            }
        }

        console.log("Wczytano bukiet z URL.");

    } catch (error) {
        console.error("Błąd podczas wczytywania bukietu z URL:", error);
    }
}

/**
 * Gettery dla stanu kwiatów
 */
export function getFlowersCount() {
    return flowers.length;
}

export function getAvailablePositionsCount() {
    return availablePositions.length;
}

export function getTotalPositions() {
    return flowerPositions.length;
}