// ============================================
// RAYCASTER - FLOWER EDITOR
// ============================================

import {getCamera, getRenderer, getScene} from "./scene.js";

const raycaster = new THREE.Raycaster();

let selectedFlower = null;
let originalMaterials = new Map(); // Przechowuje oryginalne materiały

// Zmienne do rozróżnienia tap vs drag na dotyku
let touchStartTime = 0;
let touchStartPosition = { x: 0, y: 0 };
let touchMoved = false;
const TAP_THRESHOLD_TIME = 300; // ms
const TAP_THRESHOLD_DISTANCE = 15; // px

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
export function highlightFlower(flower) {
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
export function unhighlightFlower(flower) {
    restoreOriginalMaterials(flower);
}

/**
 * Pokazuje edytor kwiatu
 */
export function showFlowerEditor() {
    const editor = document.getElementById('flower-editor');
    editor.style.display = 'block';

    // Dodaj klasę do body dla mobile - ukrywa sidebar
    document.body.classList.add('editor-active');
}

/**
 * Ukrywa edytor kwiatu
 */
export function hideFlowerEditor() {
    const editor = document.getElementById('flower-editor');
    editor.style.display = 'none';

    // Usuń klasę z body - pokazuje sidebar
    document.body.classList.remove('editor-active');
}

/**
 * Zamienia wybrany kwiat na inny typ
 */
export function replaceSelectedFlower(newFlowerType) {
    if (!selectedFlower) return;

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
 * Przetwarza kliknięcie/dotknięcie i wybiera kwiat
 */
function processClick(clientX, clientY) {
    const renderer = getRenderer();
    const camera = getCamera();
    const scene = getScene();

    if (!renderer || !camera || !scene) {
        console.error('Scene not initialized');
        return;
    }

    // Użyj getBoundingClientRect dla dokładnych współrzędnych canvas
    const canvasRect = renderer.domElement.getBoundingClientRect();

    // Oblicz współrzędne względem canvas
    const canvasX = clientX - canvasRect.left;
    const canvasY = clientY - canvasRect.top;

    // Sprawdź czy kliknięcie jest w obrębie canvas
    if (canvasX < 0 || canvasX > canvasRect.width ||
        canvasY < 0 || canvasY > canvasRect.height) {
        return;
    }

    // Normalizuj współrzędne do zakresu [-1, 1]
    const coords = new THREE.Vector2(
        (canvasX / canvasRect.width) * 2 - 1,
        -(canvasY / canvasRect.height) * 2 + 1
    );

    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(coords, camera);

    const intersections = raycaster.intersectObjects(scene.children, true);

    if (intersections.length > 0) {
        // Znajdź główną grupę kwiatu
        let flowerGroup = intersections[0].object;
        while (flowerGroup.parent && flowerGroup.parent.type !== 'Scene') {
            flowerGroup = flowerGroup.parent;
        }

        // Sprawdź czy to rzeczywiście kwiat
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

        // Powiadom UI o wybraniu kwiatu
        if (window.onFlowerSelected) {
            window.onFlowerSelected(selectedFlower);
        }

        console.log('Wybrany kwiat:', selectedFlower);
    }
}

/**
 * Obsługa kliknięcia myszy
 */
export function onMouseDown(event) {
    // Ignoruj kliknięcia w sidebar i edytorze
    if (event.target.closest('#sidebar') || event.target.closest('#flower-editor')) return;

    // Ignoruj kliknięcia innym niż lewym przyciskiem
    if (event.button !== 0) return;

    processClick(event.clientX, event.clientY);
}

/**
 * Obsługa początku dotyku - zapisuje pozycję startową
 */
export function onTouchStart(event) {
    if (event.touches.length !== 1) return;

    touchStartTime = Date.now();
    touchStartPosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
    };
    touchMoved = false;
}

/**
 * Obsługa ruchu dotyku - sprawdza czy użytkownik przeciąga
 */
export function onTouchMove(event) {
    if (event.touches.length !== 1) {
        touchMoved = true;
        return;
    }

    const dx = event.touches[0].clientX - touchStartPosition.x;
    const dy = event.touches[0].clientY - touchStartPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > TAP_THRESHOLD_DISTANCE) {
        touchMoved = true;
    }
}

/**
 * Obsługa końca dotyku - wykrywa tap i wybiera kwiat
 */
export function onTouchEnd(event) {
    // Ignoruj dotknięcia w sidebar i edytorze
    if (event.target.closest('#sidebar') || event.target.closest('#flower-editor')) return;

    const touchDuration = Date.now() - touchStartTime;

    // Sprawdź czy to był tap (krótkie dotknięcie bez ruchu)
    if (!touchMoved && touchDuration < TAP_THRESHOLD_TIME) {
        console.log('Tap detected at:', touchStartPosition.x, touchStartPosition.y);
        processClick(touchStartPosition.x, touchStartPosition.y);
    }

    touchMoved = false;
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

    if (window.onFlowerSelected) {
        window.onFlowerSelected(selectedFlower);
    }
}

/**
 * Getter dla wybranego kwiatu
 */
export function getSelectedFlower() {
    return selectedFlower;
}

export function setNullSelectedFlower() {
    selectedFlower = null;
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