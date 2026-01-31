// ============================================
// ŁADOWANIE I CACHE MODELI GLB
// Z obliczaniem bounding info dla collision system
// ============================================

const modelCache = new Map();
const boundsCache = new Map();

/**
 * Ładuje model GLB z URL
 */
export async function loadGLBModelFromURL(url) {
    return new Promise(async (resolve, reject) => {
        try {
            const { GLTFLoader } = await import('https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/GLTFLoader.js');
            const loader = new GLTFLoader();

            loader.load(
                url,
                (gltf) => {
                    const model = gltf.scene;

                    // Normalizacja rozmiaru modelu
                    const box = new THREE.Box3().setFromObject(model);
                    const size = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const scale = 1 / maxDim;
                    model.scale.multiplyScalar(scale);

                    // Wyśrodkowanie modelu
                    box.setFromObject(model);
                    const center = box.getCenter(new THREE.Vector3());
                    model.position.sub(center);

                    resolve(model);
                },
                undefined,
                (error) => {
                    console.error('Błąd ładowania modelu GLB:', error);
                    reject(error);
                }
            );
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Oblicza bounds dla modelu po normalizacji
 * Skupia się na górnej części modelu (kwiat) ignorując łodygę
 * @param {THREE.Object3D} model
 * @returns {Object} - { radiusXZ, height, boundingBox, size }
 */
function calculateModelBounds(model) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());

    // Promień w rzucie z góry (XZ) - bierzemy większy z wymiarów
    // Dzielimy przez 2 bo to promień, nie średnica
    const radiusXZ = Math.max(size.x, size.z) / 2;

    // Dla kwiatów: promień główki kwiatu jest zazwyczaj mniejszy niż cały model
    // Szacujemy że "użyteczny" promień to około 60% całkowitego
    // (łodyga jest wąska, główka kwiatu szersza ale nie tak szeroka jak bounding box)
    const effectiveRadius = radiusXZ * 0.6;

    return {
        radiusXZ: effectiveRadius,
        fullRadiusXZ: radiusXZ,
        height: size.y,
        boundingBox: box.clone(),
        size: size.clone()
    };
}

/**
 * Pobiera model z cache lub ładuje i zapisuje do cache
 * Zwraca też informacje o bounds
 */
export async function getModelFromCache(typeId, modelUrl) {
    if (modelCache.has(typeId)) {
        const clonedModel = modelCache.get(typeId).clone();
        const bounds = boundsCache.get(typeId);
        return { model: clonedModel, bounds: { ...bounds } };
    }

    console.log(`Ładowanie modelu: ${typeId}...`);
    const loadedModel = await loadGLBModelFromURL(modelUrl);

    // Oblicz bounds dla oryginalnego modelu
    const bounds = calculateModelBounds(loadedModel);

    // Zapisz do cache
    modelCache.set(typeId, loadedModel);
    boundsCache.set(typeId, bounds);

    console.log(`Model ${typeId} załadowany. Bounds: radiusXZ=${bounds.radiusXZ.toFixed(3)}, height=${bounds.height.toFixed(3)}`);

    return { model: loadedModel.clone(), bounds: { ...bounds } };
}

/**
 * Pobiera tylko bounds dla typu kwiatu (bez klonowania modelu)
 */
export async function getModelBounds(typeId, modelUrl) {
    if (boundsCache.has(typeId)) {
        return { ...boundsCache.get(typeId) };
    }

    // Musimy załadować model żeby obliczyć bounds
    const { bounds } = await getModelFromCache(typeId, modelUrl);
    return bounds;
}

/**
 * Sprawdza czy model jest w cache
 */
export function isModelCached(typeId) {
    return modelCache.has(typeId);
}

/**
 * Pobiera bounds z cache (jeśli model był już załadowany)
 */
export function getCachedBounds(typeId) {
    return boundsCache.has(typeId) ? { ...boundsCache.get(typeId) } : null;
}

/**
 * Preładowuje wszystkie modele i ich bounds
 * @param {Array} flowerTypes - Tablica typów kwiatów z config
 */
export async function preloadAllModels(flowerTypes) {
    console.log('Preładowanie wszystkich modeli...');

    const promises = flowerTypes.map(async (type) => {
        try {
            await getModelFromCache(type.id, type.modelUrl);
            return { id: type.id, success: true };
        } catch (error) {
            console.error(`Błąd preładowania ${type.id}:`, error);
            return { id: type.id, success: false, error };
        }
    });

    const results = await Promise.all(promises);
    const successful = results.filter(r => r.success).length;
    console.log(`Preładowano ${successful}/${flowerTypes.length} modeli`);

    return results;
}

/**
 * Zwraca statystyki bounds dla wszystkich załadowanych modeli
 */
export function getBoundsStatistics() {
    const stats = {
        models: [],
        minRadius: Infinity,
        maxRadius: 0,
        avgRadius: 0
    };

    let totalRadius = 0;

    boundsCache.forEach((bounds, typeId) => {
        stats.models.push({
            id: typeId,
            radiusXZ: bounds.radiusXZ,
            height: bounds.height
        });

        stats.minRadius = Math.min(stats.minRadius, bounds.radiusXZ);
        stats.maxRadius = Math.max(stats.maxRadius, bounds.radiusXZ);
        totalRadius += bounds.radiusXZ;
    });

    if (stats.models.length > 0) {
        stats.avgRadius = totalRadius / stats.models.length;
    }

    return stats;
}

/**
 * Czyści cache modeli
 */
export function clearModelCache() {
    modelCache.clear();
    boundsCache.clear();
}