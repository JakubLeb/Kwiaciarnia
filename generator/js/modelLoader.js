// ============================================
// ŁADOWANIE I CACHE MODELI GLB
// Z obliczaniem bounding info dla collision system
// ZOPTYMALIZOWANE dla szybkiego ładowania
// ============================================

const modelCache = new Map();
const boundsCache = new Map();
const clonedMaterialsCache = new Map(); // Cache dla sklonowanych materiałów

// Flaga czy GLTFLoader jest załadowany
let gltfLoaderPromise = null;
let GLTFLoaderClass = null;

/**
 * Lazy load GLTFLoader - ładuj tylko raz
 */
async function getGLTFLoader() {
    if (GLTFLoaderClass) return new GLTFLoaderClass();

    if (!gltfLoaderPromise) {
        gltfLoaderPromise = import('https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/GLTFLoader.js')
            .then(module => {
                GLTFLoaderClass = module.GLTFLoader;
                return new GLTFLoaderClass();
            });
    }

    return gltfLoaderPromise.then(() => new GLTFLoaderClass());
}

/**
 * Ładuje model GLB z URL
 */
export async function loadGLBModelFromURL(url) {
    const loader = await getGLTFLoader();

    return new Promise((resolve, reject) => {
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
    });
}

/**
 * Oblicza bounds dla modelu po normalizacji
 */
function calculateModelBounds(model) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());

    const radiusXZ = Math.max(size.x, size.z) / 2;
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
 * Szybkie klonowanie modelu - używa SkeletonUtils jeśli dostępne
 * lub zoptymalizowane klonowanie
 */
function fastCloneModel(model) {
    const clone = model.clone(true);

    // Klonuj materiały tylko dla głównych meshów
    clone.traverse((child) => {
        if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
                child.material = child.material.map(mat => mat.clone());
            } else {
                child.material = child.material.clone();
            }
        }
    });

    return clone;
}

/**
 * Pobiera model z cache lub ładuje i zapisuje do cache
 * Zwraca też informacje o bounds
 */
export async function getModelFromCache(typeId, modelUrl) {
    if (modelCache.has(typeId)) {
        const clonedModel = fastCloneModel(modelCache.get(typeId));
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

    return { model: fastCloneModel(loadedModel), bounds: { ...bounds } };
}

/**
 * NOWA FUNKCJA: Szybkie tworzenie wielu klonów modelu
 * Używana przy ładowaniu bukietu z URL
 */
export function getMultipleModelsFromCache(typeId, count) {
    if (!modelCache.has(typeId)) {
        return null;
    }

    const baseModel = modelCache.get(typeId);
    const bounds = boundsCache.get(typeId);
    const models = [];

    for (let i = 0; i < count; i++) {
        models.push({
            model: fastCloneModel(baseModel),
            bounds: { ...bounds }
        });
    }

    return models;
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
    const startTime = performance.now();

    // Ładuj wszystkie modele równolegle
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
    const loadTime = performance.now() - startTime;

    console.log(`Preładowano ${successful}/${flowerTypes.length} modeli w ${loadTime.toFixed(0)}ms`);

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
    clonedMaterialsCache.clear();
}