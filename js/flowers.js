// ============================================
// ZARZĄDZANIE KWIATAMI
// Z space-aware placement (circle packing)
// + KOMPRESJA GZIP DLA QR KODÓW
// + ZOPTYMALIZOWANE ŁADOWANIE NA MOBILE
// ============================================
import { flowerTypes } from './config.js';
import { getModelFromCache, getModelBounds, getCachedBounds, getMultipleModelsFromCache } from './modelLoader.js';
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

// Flaga czy pako jest załadowane
let pakoLoaded = false;
let pakoModule = null;

/**
 * Ładuje bibliotekę pako do kompresji
 */
async function loadPako() {
    if (pakoLoaded) return pakoModule;

    try {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js';

        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });

        pakoModule = window.pako;
        pakoLoaded = true;
        console.log('Pako loaded for URL compression');
        return pakoModule;
    } catch (e) {
        console.warn('Could not load pako, using uncompressed URLs', e);
        return null;
    }
}

// Załaduj pako na starcie
loadPako();

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
 * Aplikuje pozycję i rotację do kwiatu - ZOPTYMALIZOWANE
 */
function applyPositionToFlower(flower, position) {
    // Użyj set zamiast osobnych przypisań
    flower.position.set(position.x, position.y, position.z);

    if (position.rotX !== undefined && position.rotY !== undefined && position.rotZ !== undefined) {
        flower.rotation.set(position.rotX, position.rotY, position.rotZ);
    } else {
        if (position.x !== 0 || position.z !== 0) {
            const angleToCenter = Math.atan2(position.x, position.z);
            flower.rotation.y = angleToCenter;
        }
        if (position.tiltAngle) {
            flower.rotateX(position.tiltAngle);
        }
    }

    if (position.scaleX !== undefined && position.scaleY !== undefined && position.scaleZ !== undefined) {
        flower.scale.set(position.scaleX, position.scaleY, position.scaleZ);
    }
}

/**
 * Tworzy kwiat z modelu GLB - ZOPTYMALIZOWANE
 * Przyjmuje opcjonalnie gotowy model (dla batch loading)
 */
async function createFlowerFromGLB(type, position, flowerId, preloadedModel = null) {
    try {
        let model, bounds;

        if (preloadedModel) {
            model = preloadedModel.model;
            bounds = preloadedModel.bounds;
        } else {
            const result = await getModelFromCache(type.id, type.modelUrl);
            model = result.model;
            bounds = result.bounds;
        }

        const flower = new THREE.Group();
        flower.add(model);

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
 */
export function initFlowers(positions = []) {
    flowers = [];
    flowerIdCounter = 0;
    clearAllPlacedFlowers();
    console.log('System kwiatów zainicjalizowany (space-aware placement)');
}

/**
 * Dodaje pojedynczy kwiat do sceny
 */
export async function addFlower(type, scene) {
    const bounds = await getModelBounds(type.id, type.modelUrl);
    const radius = bounds.radiusXZ;

    const position = findBestPosition(radius);

    if (!position) {
        console.warn(`Nie można znaleźć miejsca dla kwiatu ${type.name} (radius: ${radius.toFixed(3)})`);
        return null;
    }

    const flowerId = generateFlowerId();

    const { flower } = await createFlowerFromGLB(type, position, flowerId);

    scene.add(flower);

    registerPlacedFlower(position.x, position.z, position.radius, flowerId);

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

    unregisterFlower(oldFlowerId);

    const newBounds = await getModelBounds(newFlowerType.id, newFlowerType.modelUrl);
    const newRadius = newBounds.radiusXZ * PLACEMENT_CONFIG.radiusScale;

    let newPosition = { ...oldPosition, radius: newRadius };

    scene.remove(oldFlowerMesh);

    const newFlowerId = generateFlowerId();
    const { flower: newFlower } = await createFlowerFromGLB(newFlowerType, newPosition, newFlowerId);

    scene.add(newFlower);

    registerPlacedFlower(newPosition.x, newPosition.z, newRadius, newFlowerId);

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

    scene.remove(flowerMesh);
    unregisterFlower(flower.flowerId);
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
 */
export async function generateFullBouquet(flowerType, scene) {
    clearAllFlowers(scene);

    if (!flowerType) {
        console.error("Nie wybrano typu kwiatu.");
        return;
    }

    const bounds = await getModelBounds(flowerType.id, flowerType.modelUrl);
    const radius = bounds.radiusXZ;

    console.log(`Generowanie bukietu z ${flowerType.name} (radius: ${radius.toFixed(3)})...`);

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

        if (addedCount >= 50) break;
    }

    console.log(`Wygenerowano bukiet z ${addedCount} kwiatami ${flowerType.name}`);
}

// ============================================
// ULTRA-KOMPRESJA URL DLA QR KODÓW
// ============================================

/**
 * Pakuje dane kwiatu do binarnego formatu
 */
function packFlowerBinary(typeIndex, x, z, y, rotX, rotY, rotZ, scaleX, scaleY, scaleZ) {
    const hasY = Math.abs(y) > 0.05;
    const hasRot = Math.abs(rotX) > 0.05 || Math.abs(rotY) > 0.05 || Math.abs(rotZ) > 0.05;
    const hasScale = Math.abs(scaleX - 1) > 0.05 || Math.abs(scaleY - 1) > 0.05 || Math.abs(scaleZ - 1) > 0.05;

    let flags = 0;
    if (hasY) flags |= 1;
    if (hasRot) flags |= 2;
    if (hasScale) flags |= 4;

    const bytes = [flags, typeIndex];

    const xInt = Math.round(x * 100);
    const zInt = Math.round(z * 100);
    bytes.push(xInt & 0xFF, (xInt >> 8) & 0xFF);
    bytes.push(zInt & 0xFF, (zInt >> 8) & 0xFF);

    if (hasY) {
        const yInt = Math.round(y * 100);
        bytes.push(yInt & 0xFF, (yInt >> 8) & 0xFF);
    }

    if (hasRot) {
        const rxInt = Math.round(rotX * 100);
        const ryInt = Math.round(rotY * 100);
        const rzInt = Math.round(rotZ * 100);
        bytes.push(rxInt & 0xFF, (rxInt >> 8) & 0xFF);
        bytes.push(ryInt & 0xFF, (ryInt >> 8) & 0xFF);
        bytes.push(rzInt & 0xFF, (rzInt >> 8) & 0xFF);
    }

    if (hasScale) {
        bytes.push(Math.round(scaleX * 50));
        bytes.push(Math.round(scaleY * 50));
        bytes.push(Math.round(scaleZ * 50));
    }

    return bytes;
}

/**
 * Rozpakowuje dane kwiatu z binarnego formatu
 */
function unpackFlowerBinary(bytes, offset) {
    const flags = bytes[offset];
    const typeIndex = bytes[offset + 1];

    let pos = offset + 2;

    let xInt = bytes[pos] | (bytes[pos + 1] << 8);
    if (xInt > 32767) xInt -= 65536;
    const x = xInt / 100;
    pos += 2;

    let zInt = bytes[pos] | (bytes[pos + 1] << 8);
    if (zInt > 32767) zInt -= 65536;
    const z = zInt / 100;
    pos += 2;

    let y = 0;
    if (flags & 1) {
        let yInt = bytes[pos] | (bytes[pos + 1] << 8);
        if (yInt > 32767) yInt -= 65536;
        y = yInt / 100;
        pos += 2;
    }

    let rotX = 0, rotY = 0, rotZ = 0;
    if (flags & 2) {
        let rxInt = bytes[pos] | (bytes[pos + 1] << 8);
        if (rxInt > 32767) rxInt -= 65536;
        rotX = rxInt / 100;
        pos += 2;

        let ryInt = bytes[pos] | (bytes[pos + 1] << 8);
        if (ryInt > 32767) ryInt -= 65536;
        rotY = ryInt / 100;
        pos += 2;

        let rzInt = bytes[pos] | (bytes[pos + 1] << 8);
        if (rzInt > 32767) rzInt -= 65536;
        rotZ = rzInt / 100;
        pos += 2;
    }

    let scaleX = 1, scaleY = 1, scaleZ = 1;
    if (flags & 4) {
        scaleX = bytes[pos++] / 50;
        scaleY = bytes[pos++] / 50;
        scaleZ = bytes[pos++] / 50;
    }

    return {
        data: { typeIndex, x, z, y, rotX, rotY, rotZ, scaleX, scaleY, scaleZ },
        nextOffset: pos
    };
}

/**
 * Koduje Uint8Array do URL-safe base64
 */
function uint8ToBase64Url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Dekoduje URL-safe base64 do Uint8Array
 */
function base64UrlToUint8(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';

    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Generuje ULTRA-SKOMPRESOWANY URL z zakodowanym stanem bukietu
 */
export function getBouquetUrl() {
    if (flowers.length === 0) {
        const url = new URL(window.location.href);
        url.searchParams.delete('b');
        return url.toString();
    }

    const allBytes = [];
    allBytes.push(2); // Wersja 2 = binarny format

    for (const f of flowers) {
        const mesh = f.mesh;
        const typeIndex = flowerTypes.findIndex(t => t.id === mesh.userData.flowerType.id);

        const flowerBytes = packFlowerBinary(
            typeIndex,
            mesh.position.x,
            mesh.position.z,
            mesh.position.y,
            mesh.rotation.x,
            mesh.rotation.y,
            mesh.rotation.z,
            mesh.scale.x,
            mesh.scale.y,
            mesh.scale.z
        );

        allBytes.push(...flowerBytes);
    }

    const uint8Data = new Uint8Array(allBytes);

    let finalData = uint8Data;
    let useCompression = false;

    if (pakoModule && flowers.length > 10) {
        try {
            const compressed = pakoModule.deflate(uint8Data, { level: 9 });
            if (compressed.length < uint8Data.length) {
                finalData = compressed;
                useCompression = true;
            }
        } catch (e) {
            console.warn('Compression failed, using raw data', e);
        }
    }

    const encodedData = uint8ToBase64Url(finalData);

    const url = new URL(window.location.href);
    url.searchParams.set(useCompression ? 'c' : 'b', encodedData);
    url.searchParams.delete(useCompression ? 'b' : 'c');

    console.log(`URL: ${url.toString().length} chars (${flowers.length} flowers, ${useCompression ? 'compressed' : 'uncompressed'})`);

    return url.toString();
}

/**
 * ZOPTYMALIZOWANE ładowanie bukietu z URL
 * Używa batch processing i progresywnego dodawania do sceny
 */
export async function loadBouquetFromUrl(scene) {
    const params = new URLSearchParams(window.location.search);

    let encodedData = params.get('c');
    let isCompressed = true;

    if (!encodedData) {
        encodedData = params.get('b');
        isCompressed = false;
    }

    if (!encodedData) return;

    try {
        console.log("Wczytywanie bukietu z linku...");
        const startTime = performance.now();

        // Dekoduj base64
        let bytes;
        try {
            bytes = base64UrlToUint8(encodedData);
        } catch (e) {
            const decoded = atob(encodedData);
            if (decoded.startsWith('[') || decoded.includes(',')) {
                return await loadLegacyFormat(scene, decoded);
            }
            throw e;
        }

        // Dekompresuj jeśli potrzeba
        if (isCompressed) {
            if (!pakoModule) {
                await loadPako();
            }
            if (pakoModule) {
                bytes = pakoModule.inflate(bytes);
            } else {
                console.error('Cannot decompress - pako not available');
                return;
            }
        }

        const version = bytes[0];

        if (version !== 2) {
            const decoded = new TextDecoder().decode(bytes);
            return await loadLegacyFormat(scene, decoded);
        }

        clearAllFlowers(scene);

        // FAZA 1: Parsuj wszystkie dane kwiatów (szybkie)
        const flowerDataList = [];
        let offset = 1;

        while (offset < bytes.length) {
            const { data, nextOffset } = unpackFlowerBinary(bytes, offset);
            offset = nextOffset;
            flowerDataList.push(data);
        }

        console.log(`Parsed ${flowerDataList.length} flowers from URL`);

        // FAZA 2: Grupuj kwiaty według typu
        const flowersByType = new Map();
        flowerDataList.forEach((data, index) => {
            const type = flowerTypes[data.typeIndex];
            if (!type) return;

            if (!flowersByType.has(type.id)) {
                flowersByType.set(type.id, []);
            }
            flowersByType.get(type.id).push({ data, index, type });
        });

        // FAZA 3: Twórz kwiaty batch'ami według typu (efektywniejsze klonowanie)
        const allFlowerResults = new Array(flowerDataList.length);

        for (const [typeId, flowerGroup] of flowersByType) {
            const type = flowerGroup[0].type;

            // Pobierz wiele modeli naraz z cache
            const models = getMultipleModelsFromCache(typeId, flowerGroup.length);

            if (models) {
                // Użyj pre-klonowanych modeli
                for (let i = 0; i < flowerGroup.length; i++) {
                    const { data, index } = flowerGroup[i];
                    const bounds = models[i].bounds;
                    const radius = bounds.radiusXZ;

                    const position = {
                        x: data.x,
                        z: data.z,
                        y: data.y,
                        rotX: data.rotX,
                        rotY: data.rotY,
                        rotZ: data.rotZ,
                        scaleX: data.scaleX,
                        scaleY: data.scaleY,
                        scaleZ: data.scaleZ,
                        radius
                    };

                    const flowerId = generateFlowerId();
                    const { flower } = await createFlowerFromGLB(type, position, flowerId, models[i]);

                    allFlowerResults[index] = { flower, flowerId, radius, position };
                }
            } else {
                // Fallback: ładuj pojedynczo
                for (const { data, index, type } of flowerGroup) {
                    const bounds = getCachedBounds(type.id) || await getModelBounds(type.id, type.modelUrl);
                    const radius = bounds.radiusXZ;

                    const position = {
                        x: data.x,
                        z: data.z,
                        y: data.y,
                        rotX: data.rotX,
                        rotY: data.rotY,
                        rotZ: data.rotZ,
                        scaleX: data.scaleX,
                        scaleY: data.scaleY,
                        scaleZ: data.scaleZ,
                        radius
                    };

                    const flowerId = generateFlowerId();
                    const { flower } = await createFlowerFromGLB(type, position, flowerId);

                    allFlowerResults[index] = { flower, flowerId, radius, position };
                }
            }
        }

        // FAZA 4: Dodaj wszystkie kwiaty do sceny (batch add)
        for (const result of allFlowerResults) {
            if (!result) continue;

            scene.add(result.flower);
            registerPlacedFlower(result.position.x, result.position.z, result.radius, result.flowerId);
            flowers.push({
                mesh: result.flower,
                flowerId: result.flowerId,
                radius: result.radius,
                position: result.position
            });
        }

        const loadTime = performance.now() - startTime;
        console.log(`Wczytano bukiet z ${flowers.length} kwiatami z URL w ${loadTime.toFixed(0)}ms`);

    } catch (error) {
        console.error("Błąd podczas wczytywania bukietu z URL:", error);
    }
}

/**
 * Wczytuje stary format (JSON lub tekstowy) - ZOPTYMALIZOWANA WERSJA
 */
async function loadLegacyFormat(scene, decoded) {
    let bouquetData;

    try {
        bouquetData = JSON.parse(decoded);
    } catch (e) {
        bouquetData = decoded.split(';').map(s => s.split(',').map(Number));
    }

    clearAllFlowers(scene);

    // Grupuj według typu
    const flowersByType = new Map();
    bouquetData.forEach((item, index) => {
        if (item.length < 3) return;
        const typeIndex = item[0];
        const type = flowerTypes[typeIndex];
        if (!type) return;

        if (!flowersByType.has(type.id)) {
            flowersByType.set(type.id, []);
        }
        flowersByType.get(type.id).push({ item, index, type });
    });

    const allFlowerResults = new Array(bouquetData.length);

    for (const [typeId, flowerGroup] of flowersByType) {
        const type = flowerGroup[0].type;
        const models = getMultipleModelsFromCache(typeId, flowerGroup.length);

        for (let i = 0; i < flowerGroup.length; i++) {
            const { item, index } = flowerGroup[i];
            const preloadedModel = models ? models[i] : null;

            const bounds = preloadedModel?.bounds || getCachedBounds(type.id) || await getModelBounds(type.id, type.modelUrl);
            const radius = bounds.radiusXZ;

            const position = {
                x: item[1],
                z: item[2],
                y: item[3] || 0,
                rotX: item[4] || 0,
                rotY: item[5] || 0,
                rotZ: item[6] || 0,
                scaleX: item[7] || 1,
                scaleY: item[8] || 1,
                scaleZ: item[9] || 1,
                radius
            };

            const flowerId = generateFlowerId();
            const { flower } = await createFlowerFromGLB(type, position, flowerId, preloadedModel);

            allFlowerResults[index] = { flower, flowerId, radius, position };
        }
    }

    for (const result of allFlowerResults) {
        if (!result) continue;

        scene.add(result.flower);
        registerPlacedFlower(result.position.x, result.position.z, result.radius, result.flowerId);
        flowers.push({
            mesh: result.flower,
            flowerId: result.flowerId,
            radius: result.radius,
            position: result.position
        });
    }

    console.log(`Wczytano bukiet z ${flowers.length} kwiatami (legacy format).`);
}

/**
 * Aktualizuje pozycję kwiatu po edycji w gizmo
 */
export function syncFlowerPositionAfterEdit(flowerMesh) {
    const flowerData = flowers.find(f => f.mesh === flowerMesh);
    if (!flowerData) return;

    const newX = flowerMesh.position.x;
    const newZ = flowerMesh.position.z;

    updateFlowerPosition(flowerData.flowerId, newX, newZ);

    flowerData.position.x = newX;
    flowerData.position.z = newZ;
    flowerData.position.y = flowerMesh.position.y;
    flowerData.position.rotX = flowerMesh.rotation.x;
    flowerData.position.rotY = flowerMesh.rotation.y;
    flowerData.position.rotZ = flowerMesh.rotation.z;
    flowerData.position.scaleX = flowerMesh.scale.x;
    flowerData.position.scaleY = flowerMesh.scale.y;
    flowerData.position.scaleZ = flowerMesh.scale.z;
}

/**
 * Zwraca zawartość bukietu (podsumowanie typów kwiatów)
 */
export function getBouquetContents() {
    const contents = new Map();

    flowers.forEach(flower => {
        const type = flower.mesh.userData.flowerType;
        if (type) {
            if (contents.has(type.id)) {
                contents.get(type.id).count++;
            } else {
                contents.set(type.id, {
                    id: type.id,
                    name: type.name,
                    color: type.color,
                    count: 1
                });
            }
        }
    });

    return Array.from(contents.values());
}

/**
 * Gettery dla stanu kwiatów
 */
export function getFlowersCount() {
    return flowers.length;
}

export function getAvailablePositionsCount() {
    const avgRadius = flowers.length > 0
        ? flowers.reduce((sum, f) => sum + f.radius, 0) / flowers.length
        : PLACEMENT_CONFIG.defaultRadius;

    return estimateRemainingCapacity(avgRadius);
}

export function getTotalPositions() {
    const avgRadius = 0.08;
    const totalArea = Math.PI * PLACEMENT_CONFIG.bouquetRadius * PLACEMENT_CONFIG.bouquetRadius;
    const avgFlowerArea = Math.PI * avgRadius * avgRadius;
    return Math.floor(totalArea * 0.6 / avgFlowerArea);
}

/**
 * Legacy: Generuje pozycje kwiatów (dla kompatybilności)
 */
export function generateFlowerPositions(ringsConfig, includeCenter) {
    console.log('generateFlowerPositions: Legacy function, pozycje są teraz generowane dynamicznie');
    return [];
}