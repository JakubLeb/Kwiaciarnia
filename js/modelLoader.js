// ============================================
// ŁADOWANIE I CACHE MODELI GLB
// ============================================

const modelCache = new Map();



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
 * Pobiera model z cache lub ładuje i zapisuje do cache
 */
export async function getModelFromCache(typeId, modelUrl) {
    if (modelCache.has(typeId)) {
        return modelCache.get(typeId).clone();
    }

    console.log(`Ładowanie modelu: ${typeId}...`);
    const loadedModel = await loadGLBModelFromURL(modelUrl);
    modelCache.set(typeId, loadedModel);
    return loadedModel.clone();
}

/**
 * Sprawdza czy model jest w cache
 */
export function isModelCached(typeId) {
    return modelCache.has(typeId);
}

/**
 * Czyści cache modeli
 */
export function clearModelCache() {
    modelCache.clear();
}