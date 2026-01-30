// ============================================
// RAYCASTER - FLOWER EDITOR Z WIZUALNYMI KONTROLKAMI
// ============================================

import { getCamera, getRenderer, getScene } from "./scene.js";

const raycaster = new THREE.Raycaster();

let selectedFlower = null;
let originalMaterials = new Map();

// Przechowywanie oryginalnych materiałów innych kwiatów (dla przezroczystości)
let otherFlowersMaterials = new Map();

// Tryby edycji
export const EDIT_MODES = {
    NONE: 'none',
    POSITION: 'position',
    ROTATION: 'rotation',
    SCALE: 'scale'
};

let currentEditMode = EDIT_MODES.NONE;

// Kontrolki 3D
let positionGizmo = null;
let rotationGizmo = null;
let scaleGizmo = null;

// Aktywna oś przeciągania
let activeAxis = null;
let isDraggingGizmo = false;
let dragStartPoint = new THREE.Vector3();
let dragStartValue = null;

// Zmienne do rozróżnienia tap vs drag na dotyku
let touchStartTime = 0;
let touchStartPosition = { x: 0, y: 0 };
let touchMoved = false;
const TAP_THRESHOLD_TIME = 300;
const TAP_THRESHOLD_DISTANCE = 15;

// Kolory osi
const AXIS_COLORS = {
    x: 0xff4444,
    y: 0x44ff44,
    z: 0x4444ff,
    hover: 0xffff00
};

// ============================================
// ZARZĄDZANIE PRZEZROCZYSTOŚCIĄ INNYCH KWIATÓW
// ============================================

/**
 * Pobiera wszystkie kwiaty ze sceny
 */
function getAllFlowers() {
    const scene = getScene();
    if (!scene) return [];

    const flowers = [];
    scene.children.forEach(child => {
        if (child.userData && child.userData.flowerType) {
            flowers.push(child);
        }
    });
    return flowers;
}

/**
 * Zapisuje oryginalne materiały kwiatu przed zmianą przezroczystości
 */
function saveFlowerMaterials(flower) {
    if (otherFlowersMaterials.has(flower)) return;

    const materials = [];
    flower.traverse((child) => {
        if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
                materials.push({
                    mesh: child,
                    materials: child.material.map(mat => ({
                        transparent: mat.transparent,
                        opacity: mat.opacity,
                        depthWrite: mat.depthWrite
                    }))
                });
            } else {
                materials.push({
                    mesh: child,
                    materials: [{
                        transparent: child.material.transparent,
                        opacity: child.material.opacity,
                        depthWrite: child.material.depthWrite
                    }]
                });
            }
        }
    });
    otherFlowersMaterials.set(flower, materials);
}

/**
 * Ustawia przezroczystość kwiatu
 */
function setFlowerTransparency(flower, opacity) {
    flower.traverse((child) => {
        if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                    mat.transparent = true;
                    mat.opacity = opacity;
                    mat.depthWrite = opacity >= 1;
                });
            } else {
                child.material.transparent = true;
                child.material.opacity = opacity;
                child.material.depthWrite = opacity >= 1;
            }
        }
    });
}

/**
 * Przywraca oryginalne materiały kwiatu
 */
function restoreFlowerMaterials(flower) {
    if (!otherFlowersMaterials.has(flower)) return;

    const savedMaterials = otherFlowersMaterials.get(flower);

    savedMaterials.forEach(({ mesh, materials }) => {
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat, index) => {
                if (materials[index]) {
                    mat.transparent = materials[index].transparent;
                    mat.opacity = materials[index].opacity;
                    mat.depthWrite = materials[index].depthWrite;
                }
            });
        } else if (materials[0]) {
            mesh.material.transparent = materials[0].transparent;
            mesh.material.opacity = materials[0].opacity;
            mesh.material.depthWrite = materials[0].depthWrite;
        }
    });

    otherFlowersMaterials.delete(flower);
}

/**
 * Włącza tryb edycji - inne kwiaty stają się półprzezroczyste
 */
function enableEditingMode() {
    if (!selectedFlower) return;

    const allFlowers = getAllFlowers();

    allFlowers.forEach(flower => {
        if (flower !== selectedFlower) {
            saveFlowerMaterials(flower);
            setFlowerTransparency(flower, 0.3);
        }
    });
}

/**
 * Wyłącza tryb edycji - przywraca normalne materiały
 */
function disableEditingMode() {
    const allFlowers = getAllFlowers();

    allFlowers.forEach(flower => {
        if (flower !== selectedFlower) {
            restoreFlowerMaterials(flower);
        }
    });
}

// ============================================
// TWORZENIE GIZMO DLA POZYCJI (strzałki)
// ============================================
function createPositionGizmo() {
    const gizmo = new THREE.Group();
    gizmo.name = 'positionGizmo';

    const arrowLength = 0.8;
    const coneRadius = 0.08;
    const coneHeight = 0.2;
    const lineRadius = 0.02;

    function createArrow(axis, color) {
        const arrow = new THREE.Group();
        arrow.name = `arrow_${axis}`;
        arrow.userData.axis = axis;
        arrow.userData.gizmoType = 'position';

        const lineGeometry = new THREE.CylinderGeometry(lineRadius, lineRadius, arrowLength, 8);
        const lineMaterial = new THREE.MeshBasicMaterial({ color: color });
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.position.y = arrowLength / 2;
        line.userData.axis = axis;
        line.userData.gizmoType = 'position';
        arrow.add(line);

        const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 16);
        const coneMaterial = new THREE.MeshBasicMaterial({ color: color });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        cone.position.y = arrowLength + coneHeight / 2;
        cone.userData.axis = axis;
        cone.userData.gizmoType = 'position';
        arrow.add(cone);

        return arrow;
    }

    const arrowX = createArrow('x', AXIS_COLORS.x);
    arrowX.rotation.z = -Math.PI / 2;
    gizmo.add(arrowX);

    const arrowY = createArrow('y', AXIS_COLORS.y);
    gizmo.add(arrowY);

    const arrowZ = createArrow('z', AXIS_COLORS.z);
    arrowZ.rotation.x = Math.PI / 2;
    gizmo.add(arrowZ);

    const centerGeometry = new THREE.SphereGeometry(0.06, 16, 16);
    const centerMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const center = new THREE.Mesh(centerGeometry, centerMaterial);
    center.userData.axis = 'all';
    center.userData.gizmoType = 'position';
    gizmo.add(center);

    gizmo.visible = false;
    return gizmo;
}

// ============================================
// TWORZENIE GIZMO DLA ROTACJI (pierścienie)
// ============================================
function createRotationGizmo() {
    const gizmo = new THREE.Group();
    gizmo.name = 'rotationGizmo';

    const ringRadius = 0.7;
    const tubeRadius = 0.03;

    function createRing(axis, color) {
        const geometry = new THREE.TorusGeometry(ringRadius, tubeRadius, 8, 48);
        const material = new THREE.MeshBasicMaterial({ color: color });
        const ring = new THREE.Mesh(geometry, material);
        ring.name = `ring_${axis}`;
        ring.userData.axis = axis;
        ring.userData.gizmoType = 'rotation';
        return ring;
    }

    const ringX = createRing('x', AXIS_COLORS.x);
    ringX.rotation.y = Math.PI / 2;
    gizmo.add(ringX);

    const ringY = createRing('y', AXIS_COLORS.y);
    ringY.rotation.x = Math.PI / 2;
    gizmo.add(ringY);

    const ringZ = createRing('z', AXIS_COLORS.z);
    gizmo.add(ringZ);

    gizmo.visible = false;
    return gizmo;
}

// ============================================
// TWORZENIE GIZMO DLA SKALI (sześciany)
// ============================================
function createScaleGizmo() {
    const gizmo = new THREE.Group();
    gizmo.name = 'scaleGizmo';

    const lineLength = 0.6;
    const cubeSize = 0.1;
    const lineRadius = 0.015;

    function createScaleHandle(axis, color) {
        const handle = new THREE.Group();
        handle.name = `scale_${axis}`;
        handle.userData.axis = axis;
        handle.userData.gizmoType = 'scale';

        const lineGeometry = new THREE.CylinderGeometry(lineRadius, lineRadius, lineLength, 8);
        const lineMaterial = new THREE.MeshBasicMaterial({ color: color });
        const line = new THREE.Mesh(lineGeometry, lineMaterial);
        line.position.y = lineLength / 2;
        line.userData.axis = axis;
        line.userData.gizmoType = 'scale';
        handle.add(line);

        const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        const cubeMaterial = new THREE.MeshBasicMaterial({ color: color });
        const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
        cube.position.y = lineLength + cubeSize / 2;
        cube.userData.axis = axis;
        cube.userData.gizmoType = 'scale';
        handle.add(cube);

        return handle;
    }

    const handleX = createScaleHandle('x', AXIS_COLORS.x);
    handleX.rotation.z = -Math.PI / 2;
    gizmo.add(handleX);

    const handleY = createScaleHandle('y', AXIS_COLORS.y);
    gizmo.add(handleY);

    const handleZ = createScaleHandle('z', AXIS_COLORS.z);
    handleZ.rotation.x = Math.PI / 2;
    gizmo.add(handleZ);

    const centerGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const centerMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const center = new THREE.Mesh(centerGeometry, centerMaterial);
    center.userData.axis = 'all';
    center.userData.gizmoType = 'scale';
    gizmo.add(center);

    gizmo.visible = false;
    return gizmo;
}

// ============================================
// INICJALIZACJA GIZMO
// ============================================
export function initGizmos() {
    const scene = getScene();
    if (!scene) return;

    positionGizmo = createPositionGizmo();
    rotationGizmo = createRotationGizmo();
    scaleGizmo = createScaleGizmo();

    scene.add(positionGizmo);
    scene.add(rotationGizmo);
    scene.add(scaleGizmo);
}

// ============================================
// AKTUALIZACJA POZYCJI GIZMO
// ============================================
function updateGizmoPosition() {
    if (!selectedFlower) return;

    const position = selectedFlower.position.clone();

    if (positionGizmo) positionGizmo.position.copy(position);
    if (rotationGizmo) rotationGizmo.position.copy(position);
    if (scaleGizmo) scaleGizmo.position.copy(position);
}

// ============================================
// ZMIANA TRYBU EDYCJI
// ============================================
export function setEditMode(mode) {
    const previousMode = currentEditMode;
    currentEditMode = mode;

    if (positionGizmo) positionGizmo.visible = false;
    if (rotationGizmo) rotationGizmo.visible = false;
    if (scaleGizmo) scaleGizmo.visible = false;

    // Zarządzanie przezroczystością
    if (previousMode === EDIT_MODES.NONE && mode !== EDIT_MODES.NONE) {
        enableEditingMode();
    } else if (previousMode !== EDIT_MODES.NONE && mode === EDIT_MODES.NONE) {
        disableEditingMode();
    }

    if (selectedFlower) {
        updateGizmoPosition();

        switch (mode) {
            case EDIT_MODES.POSITION:
                if (positionGizmo) positionGizmo.visible = true;
                break;
            case EDIT_MODES.ROTATION:
                if (rotationGizmo) rotationGizmo.visible = true;
                break;
            case EDIT_MODES.SCALE:
                if (scaleGizmo) scaleGizmo.visible = true;
                break;
        }
    }

    return currentEditMode;
}

export function getEditMode() {
    return currentEditMode;
}

// ============================================
// MATERIAŁY I PODŚWIETLENIE
// ============================================
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

function restoreOriginalMaterials(object) {
    if (!originalMaterials.has(object)) return;

    const materials = originalMaterials.get(object);
    const meshMaterialMap = new Map();

    materials.forEach(({ mesh, material }) => {
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

export function unhighlightFlower(flower) {
    restoreOriginalMaterials(flower);
}

// ============================================
// PRZEŁĄCZANIE WIDOKÓW W SIDEBARZE
// ============================================
export function showFlowerEditor() {
    const mainView = document.getElementById('main-view');
    const editor = document.getElementById('flower-editor');

    if (mainView) mainView.style.display = 'none';
    if (editor) editor.style.display = 'block';
}

export function hideFlowerEditor() {
    const mainView = document.getElementById('main-view');
    const editor = document.getElementById('flower-editor');

    if (mainView) mainView.style.display = 'block';
    if (editor) editor.style.display = 'none';

    if (currentEditMode !== EDIT_MODES.NONE) {
        disableEditingMode();
    }
    setEditMode(EDIT_MODES.NONE);
}

// ============================================
// SPRAWDZANIE CZY OBIEKT TO KWIAT
// ============================================
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

function findFlowerGroup(object) {
    let current = object;
    while (current) {
        if (current.userData && current.userData.flowerType) {
            return current;
        }
        if (current.parent && current.parent.type !== 'Scene') {
            current = current.parent;
        } else {
            break;
        }
    }
    return null;
}

// ============================================
// SPRAWDZANIE CZY OBIEKT TO GIZMO
// ============================================
function isGizmo(object) {
    let current = object;
    while (current) {
        if (current.userData && current.userData.gizmoType) {
            return { axis: current.userData.axis, type: current.userData.gizmoType };
        }
        if (current.parent) {
            current = current.parent;
        } else {
            break;
        }
    }
    return null;
}

// ============================================
// OBSŁUGA PRZECIĄGANIA GIZMO
// ============================================
function startGizmoDrag(gizmoInfo, clientX, clientY) {
    if (!selectedFlower) return;

    activeAxis = gizmoInfo.axis;
    isDraggingGizmo = true;

    const renderer = getRenderer();
    const canvasRect = renderer.domElement.getBoundingClientRect();

    dragStartPoint.set(
        ((clientX - canvasRect.left) / canvasRect.width) * 2 - 1,
        -((clientY - canvasRect.top) / canvasRect.height) * 2 + 1,
        0
    );

    switch (gizmoInfo.type) {
        case 'position':
            dragStartValue = selectedFlower.position.clone();
            break;
        case 'rotation':
            dragStartValue = selectedFlower.rotation.clone();
            break;
        case 'scale':
            dragStartValue = selectedFlower.scale.clone();
            break;
    }
}

function updateGizmoDrag(clientX, clientY) {
    if (!isDraggingGizmo || !selectedFlower || !activeAxis) return;

    const renderer = getRenderer();
    const canvasRect = renderer.domElement.getBoundingClientRect();

    const currentPoint = new THREE.Vector2(
        ((clientX - canvasRect.left) / canvasRect.width) * 2 - 1,
        -((clientY - canvasRect.top) / canvasRect.height) * 2 + 1
    );

    const deltaX = (currentPoint.x - dragStartPoint.x) * 3;
    const deltaY = (currentPoint.y - dragStartPoint.y) * 3;

    switch (currentEditMode) {
        case EDIT_MODES.POSITION:
            updatePosition(deltaX, deltaY);
            break;
        case EDIT_MODES.ROTATION:
            updateRotation(deltaX, deltaY);
            break;
        case EDIT_MODES.SCALE:
            updateScale(deltaX, deltaY);
            break;
    }

    updateGizmoPosition();
}

function updatePosition(deltaX, deltaY) {
    if (!dragStartValue) return;

    switch (activeAxis) {
        case 'x':
            selectedFlower.position.x = dragStartValue.x + deltaX;
            break;
        case 'y':
            selectedFlower.position.y = dragStartValue.y + deltaY;
            break;
        case 'z':
            selectedFlower.position.z = dragStartValue.z - deltaX;
            break;
        case 'all':
            selectedFlower.position.x = dragStartValue.x + deltaX;
            selectedFlower.position.y = dragStartValue.y + deltaY;
            break;
    }
}

function updateRotation(deltaX, deltaY) {
    if (!dragStartValue) return;

    const rotationSpeed = 2;

    switch (activeAxis) {
        case 'x':
            selectedFlower.rotation.x = dragStartValue.x + deltaY * rotationSpeed;
            break;
        case 'y':
            selectedFlower.rotation.y = dragStartValue.y + deltaX * rotationSpeed;
            break;
        case 'z':
            selectedFlower.rotation.z = dragStartValue.z + deltaX * rotationSpeed;
            break;
    }
}

function updateScale(deltaX, deltaY) {
    if (!dragStartValue) return;

    const scaleSpeed = 2;
    const delta = (deltaX + deltaY) * scaleSpeed;

    switch (activeAxis) {
        case 'x':
            selectedFlower.scale.x = Math.max(0.1, dragStartValue.x + deltaX * scaleSpeed);
            break;
        case 'y':
            selectedFlower.scale.y = Math.max(0.1, dragStartValue.y + deltaY * scaleSpeed);
            break;
        case 'z':
            selectedFlower.scale.z = Math.max(0.1, dragStartValue.z - deltaX * scaleSpeed);
            break;
        case 'all':
            const uniformScale = Math.max(0.1, dragStartValue.x + delta);
            selectedFlower.scale.set(uniformScale, uniformScale, uniformScale);
            break;
    }
}

function endGizmoDrag() {
    isDraggingGizmo = false;
    activeAxis = null;
    dragStartValue = null;
}

// ============================================
// PRZETWARZANIE KLIKNIĘCIA
// ============================================
function processClick(clientX, clientY) {
    const renderer = getRenderer();
    const camera = getCamera();
    const scene = getScene();

    if (!renderer || !camera || !scene) return;

    const canvasRect = renderer.domElement.getBoundingClientRect();
    const canvasX = clientX - canvasRect.left;
    const canvasY = clientY - canvasRect.top;

    if (canvasX < 0 || canvasX > canvasRect.width ||
        canvasY < 0 || canvasY > canvasRect.height) {
        return;
    }

    const coords = new THREE.Vector2(
        (canvasX / canvasRect.width) * 2 - 1,
        -(canvasY / canvasRect.height) * 2 + 1
    );

    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(coords, camera);

    // Jeśli jesteśmy w trybie edycji, najpierw sprawdź TYLKO gizmo
    if (currentEditMode !== EDIT_MODES.NONE) {
        // Pobierz aktywne gizmo
        let activeGizmo = null;
        switch (currentEditMode) {
            case EDIT_MODES.POSITION:
                activeGizmo = positionGizmo;
                break;
            case EDIT_MODES.ROTATION:
                activeGizmo = rotationGizmo;
                break;
            case EDIT_MODES.SCALE:
                activeGizmo = scaleGizmo;
                break;
        }

        if (activeGizmo) {
            // Sprawdź przecięcie TYLKO z gizmo (ignorując inne obiekty)
            const gizmoIntersections = raycaster.intersectObjects(activeGizmo.children, true);

            if (gizmoIntersections.length > 0) {
                const gizmoInfo = isGizmo(gizmoIntersections[0].object);
                if (gizmoInfo) {
                    startGizmoDrag(gizmoInfo, clientX, clientY);
                    return;
                }
            }
        }

        // W trybie edycji nie pozwalamy na wybór innych kwiatów
        return;
    }

    // Normalne sprawdzanie wszystkich obiektów (gdy nie jesteśmy w trybie edycji)
    const intersections = raycaster.intersectObjects(scene.children, true);

    if (intersections.length > 0) {
        const hit = intersections[0].object;

        // Sprawdź czy kliknięto kwiat
        if (!isFlower(hit)) {
            return;
        }

        // Znajdź główną grupę kwiatu
        const flowerGroup = findFlowerGroup(hit);
        if (!flowerGroup) return;

        // Jeśli kliknięto ten sam kwiat, nic nie rób
        if (selectedFlower === flowerGroup) return;

        // Usuń podświetlenie poprzedniego kwiatu
        if (selectedFlower) {
            unhighlightFlower(selectedFlower);
        }

        selectedFlower = flowerGroup;
        highlightFlower(selectedFlower);
        showFlowerEditor();

        // Reset trybu edycji
        setEditMode(EDIT_MODES.NONE);

        if (window.onFlowerSelected) {
            window.onFlowerSelected(selectedFlower);
        }
    }
}

// ============================================
// OBSŁUGA MYSZY
// ============================================
export function onMouseDown(event) {
    if (event.target.closest('#sidebar')) return;
    if (event.button !== 0) return;

    processClick(event.clientX, event.clientY);
}

export function onMouseMove(event) {
    if (isDraggingGizmo) {
        event.preventDefault();
        updateGizmoDrag(event.clientX, event.clientY);
    }
}

export function onMouseUp(event) {
    if (isDraggingGizmo) {
        endGizmoDrag();
    }
}

// ============================================
// OBSŁUGA DOTYKU
// ============================================
export function onTouchStart(event) {
    if (event.touches.length !== 1) return;

    touchStartTime = Date.now();
    touchStartPosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
    };
    touchMoved = false;

    // Sprawdź czy dotknięto gizmo (priorytet nad innymi obiektami)
    if (currentEditMode !== EDIT_MODES.NONE) {
        const renderer = getRenderer();
        const camera = getCamera();

        if (renderer && camera) {
            const canvasRect = renderer.domElement.getBoundingClientRect();
            const coords = new THREE.Vector2(
                ((touchStartPosition.x - canvasRect.left) / canvasRect.width) * 2 - 1,
                -((touchStartPosition.y - canvasRect.top) / canvasRect.height) * 2 + 1
            );

            raycaster.setFromCamera(coords, camera);

            // Pobierz aktywne gizmo
            let activeGizmo = null;
            switch (currentEditMode) {
                case EDIT_MODES.POSITION:
                    activeGizmo = positionGizmo;
                    break;
                case EDIT_MODES.ROTATION:
                    activeGizmo = rotationGizmo;
                    break;
                case EDIT_MODES.SCALE:
                    activeGizmo = scaleGizmo;
                    break;
            }

            if (activeGizmo) {
                // Sprawdź przecięcie TYLKO z gizmo
                const gizmoIntersections = raycaster.intersectObjects(activeGizmo.children, true);

                if (gizmoIntersections.length > 0) {
                    const gizmoInfo = isGizmo(gizmoIntersections[0].object);
                    if (gizmoInfo) {
                        startGizmoDrag(gizmoInfo, touchStartPosition.x, touchStartPosition.y);
                    }
                }
            }
        }
    }
}

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

    if (isDraggingGizmo) {
        event.preventDefault();
        updateGizmoDrag(event.touches[0].clientX, event.touches[0].clientY);
    }
}

export function onTouchEnd(event) {
    if (event.target.closest('#sidebar')) return;

    if (isDraggingGizmo) {
        endGizmoDrag();
        return;
    }

    const touchDuration = Date.now() - touchStartTime;

    if (!touchMoved && touchDuration < TAP_THRESHOLD_TIME) {
        processClick(touchStartPosition.x, touchStartPosition.y);
    }

    touchMoved = false;
}

// ============================================
// AKTUALIZACJA ZAZNACZENIA
// ============================================
export function updateSelectionAfterReplace(newFlowerMesh) {
    if (selectedFlower) {
        unhighlightFlower(selectedFlower);
    }
    selectedFlower = newFlowerMesh;
    highlightFlower(selectedFlower);
    updateGizmoPosition();

    if (window.onFlowerSelected) {
        window.onFlowerSelected(selectedFlower);
    }
}

// ============================================
// GETTERY I SETTERY
// ============================================
export function getSelectedFlower() {
    return selectedFlower;
}

export function setNullSelectedFlower() {
    selectedFlower = null;
}

export function clearSelection() {
    if (selectedFlower) {
        unhighlightFlower(selectedFlower);
        selectedFlower = null;
    }

    disableEditingMode();
    setEditMode(EDIT_MODES.NONE);
    hideFlowerEditor();
}

export function isGizmoDragging() {
    return isDraggingGizmo;
}