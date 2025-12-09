// ============================================
// RAYCASTER - FLOWER EDITOR
// ============================================

import {getCamera, getRenderer, getScene} from "./scene.js";

const raycaster = new THREE.Raycaster();
const container = document.getElementById('sidebar');

let selectedFlower = null;
let originalMaterials = new Map(); // Przechowuje oryginalne materiały

/**
 * Zapisuje oryginalne materiały obiektu
 */
function saveOriginalMaterials(object) {
    const materials = [];
    object.traverse((child) => {
        if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
                materials.push(...child.material.map(mat => ({
                    mesh: child,
                    material: mat.clone()
                })));
            } else {
                materials.push({
                    mesh: child,
                    material: child.material.clone()
                });
            }
        }
    });
    return materials;
}

/**
 * Przywraca oryginalne materiały obiektu
 */
function restoreOriginalMaterials(object) {
    if (!originalMaterials.has(object)) return;

    const materials = originalMaterials.get(object);
    const meshMaterialMap = new Map();

    materials.forEach(({mesh, material}) => {
        if (!meshMaterialMap.has(mesh)) {
            meshMaterialMap.set(mesh, []);
        }
        meshMaterialMap.get(mesh).push(material);
    });

    meshMaterialMap.forEach((mats, mesh) => {
        if (mats.length === 1) {
            mesh.material = mats[0];
        } else {
            mesh.material = mats;
        }
    });

    originalMaterials.delete(object);
}

/**
 * Podświetla wybrany kwiat
 */
function highlightFlower(flower) {
    if (!originalMaterials.has(flower)) {
        originalMaterials.set(flower, saveOriginalMaterials(flower));
    }

    flower.traverse((child) => {
        if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                    mat.emissive = new THREE.Color(0x44ff44);
                    mat.emissiveIntensity = 0.3;
                });
            } else {
                child.material.emissive = new THREE.Color(0x44ff44);
                child.material.emissiveIntensity = 0.3;
            }
        }
    });
}

/**
 * Usuwa podświetlenie kwiatu
 */
function unhighlightFlower(flower) {
    restoreOriginalMaterials(flower);
}

/**
 * Pokazuje edytor kwiatu
 */
function showFlowerEditor() {
    const editor = document.getElementById('flower-editor');
    editor.style.display = 'block';
}

/**
 * Ukrywa edytor kwiatu
 */
function hideFlowerEditor() {
    const editor = document.getElementById('flower-editor');
    editor.style.display = 'none';
}

/**
 * Inicjalizuje edytor kwiatu
 */
export function initFlowerEditor() {
    document.addEventListener('mousedown', onMouseDown);

    const closeBtn = document.getElementById('close-editor');
    closeBtn.addEventListener('click', () => {
        if (selectedFlower) {
            unhighlightFlower(selectedFlower);
            selectedFlower = null;
        }
        hideFlowerEditor();
    });

    const deleteBtn = document.getElementById('delete-flower');
    deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation(); // Zapobiega propagacji eventu
        if (selectedFlower) {
            console.log('Usuwanie kwiatu:', selectedFlower);
            // Wywołaj funkcję usuwania kwiatu
            if (window.deleteSelectedFlowerCallback) {
                window.deleteSelectedFlowerCallback(selectedFlower);
            }
            selectedFlower = null;
            hideFlowerEditor();
        } else {
            console.log('Brak wybranego kwiatu do usunięcia');
        }
    });
}

/**
 * Zamienia wybrany kwiat na inny typ
 */
export function replaceSelectedFlower(newFlowerType) {
    if (!selectedFlower) return;

    // Tutaj dodaj funkcję zamiany kwiatu w flowers.js
    // Na razie tylko zmiana koloru jako placeholder
    selectedFlower.traverse((child) => {
        if (child.isMesh && child.material) {
            const color = new THREE.Color(newFlowerType.color);
            if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.color.set(color));
            } else {
                child.material.color.set(color);
            }
        }
    });
}

/**
 * Sprawdza czy obiekt jest kwiatem (nie podłogą ani innym elementem)
 */
function isFlower(object) {
    // Sprawdź czy obiekt ma userData.flowerType (ustawiane w flowers.js)
    let current = object;
    while (current) {
        if (current.userData && current.userData.flowerType) {
            return true;
        }
        if (current.parent && current.parent.type !== 'Scene') {
            current = current.parent;
        } else {
            break;
        }
    }
    return false;
}

/**
 * Obsługa kliknięcia myszy
 */
function onMouseDown(event) {
    // Ignoruj kliknięcia w sidebar i edytorze
    if (event.target.closest('#sidebar') || event.target.closest('#flower-editor')) return;

    // Ignoruj kliknięcia środkowym przyciskiem myszy (scroll wheel)
    if (event.button !== 0) return;

    const coords = new THREE.Vector2(
        ((event.clientX - container.clientWidth) / getRenderer().domElement.clientWidth) * 2 - 1,
        -(event.clientY / getRenderer().domElement.clientHeight) * 2 + 1,
    );

    getScene().updateMatrixWorld(true);
    raycaster.setFromCamera(coords, getCamera());

    const intersections = raycaster.intersectObjects(getScene().children, true);

    if (intersections.length > 0) {
        // Znajdź główną grupę kwiatu (nie mesh, ale parent group)
        let flowerGroup = intersections[0].object;
        while (flowerGroup.parent && flowerGroup.parent.type !== 'Scene') {
            flowerGroup = flowerGroup.parent;
        }

        // Sprawdź czy to rzeczywiście kwiat (nie podłoga)
        if (!isFlower(intersections[0].object)) {
            console.log('Kliknięto na obiekt, który nie jest kwiatem');
            return;
        }

        // Jeśli to ten sam kwiat, nie rób nic
        if (selectedFlower === flowerGroup) return;

        // Usuń podświetlenie poprzedniego kwiatu
        if (selectedFlower) {
            unhighlightFlower(selectedFlower);
        }

        // Wybierz nowy kwiat
        selectedFlower = flowerGroup;
        highlightFlower(selectedFlower);
        showFlowerEditor();

        console.log('Wybrany kwiat:', selectedFlower);
    }
}

/**
 * Aktualizuje zaznaczenie po zamianie kwiatu
 */
export function updateSelectionAfterReplace(newFlowerMesh) {
    if (selectedFlower) {
        unhighlightFlower(selectedFlower);
    }
    selectedFlower = newFlowerMesh;
    highlightFlower(selectedFlower);
}

/**
 * Getter dla wybranego kwiatu
 */
export function getSelectedFlower() {
    return selectedFlower;
}

/**
 * Czyści zaznaczenie
 */
export function clearSelection() {
    if (selectedFlower) {
        unhighlightFlower(selectedFlower);
        selectedFlower = null;
    }
    hideFlowerEditor();
}