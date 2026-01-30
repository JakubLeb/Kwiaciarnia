// ============================================
// INTERFEJS UŻYTKOWNIKA
// ============================================

import { flowerTypes } from './config.js';
import {
    addFlower,
    removeLastFlower,
    clearAllFlowers,
    generateFullBouquet,
    getFlowersCount,
    getAvailablePositionsCount,
    getTotalPositions,
    replaceFlower,
    deleteFlower,
    getBouquetUrl
} from './flowers.js';
import {
    getSelectedFlower,
    setNullSelectedFlower,
    updateSelectionAfterReplace,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    unhighlightFlower,
    hideFlowerEditor,
    initGizmos,
    setEditMode,
    getEditMode,
    EDIT_MODES,
    isGizmoDragging
} from './Raycaster.js';

let scene;
let onFlowerChangeCallback = null;

/**
 * Inicjalizuje interfejs użytkownika
 */
export function initUI(sceneObj, onFlowerChange) {
    scene = sceneObj;
    onFlowerChangeCallback = onFlowerChange;

    createFlowersList();
    setupActionButtons();
    setupDeleteCallback();
    updateUI();
}

/**
 * Konfiguruje callback dla usuwania kwiatu z edytora
 */
function setupDeleteCallback() {
    window.deleteSelectedFlowerCallback = (flowerMesh) => {
        deleteFlower(flowerMesh, scene);
        updateUI();
        if (onFlowerChangeCallback) onFlowerChangeCallback();
    };
}

/**
 * Tworzy listę kwiatów
 */
function createFlowersList() {
    const flowersList = document.getElementById('flowers-list');

    flowerTypes.forEach(flower => {
        const container = document.createElement('div');
        container.className = 'flower-item-container';
        container.setAttribute('data-flower-id', flower.id);

        const infoSection = document.createElement('div');
        infoSection.className = 'flower-info';

        const colorDiv = document.createElement('div');
        colorDiv.className = 'flower-color';
        colorDiv.style.backgroundColor = `#${flower.color.toString(16).padStart(6, '0')}`;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'flower-name';
        nameSpan.textContent = flower.name;

        infoSection.appendChild(colorDiv);
        infoSection.appendChild(nameSpan);
        container.appendChild(infoSection);

        const btnAddOne = document.createElement('button');
        btnAddOne.className = 'flower-action-button btn-add-one';
        btnAddOne.textContent = '➕';
        btnAddOne.addEventListener('click', async () => {
            await addFlower(flower, scene);
            updateUI();
            if (onFlowerChangeCallback) onFlowerChangeCallback();
        });

        const btnAddBouquet = document.createElement('button');
        btnAddBouquet.className = 'flower-action-button btn-add-bouquet';
        btnAddBouquet.textContent = '💐';
        btnAddBouquet.addEventListener('click', async () => {
            await generateFullBouquet(flower, scene);
            updateUI();
            if (onFlowerChangeCallback) onFlowerChangeCallback();
        });

        container.appendChild(btnAddOne);
        container.appendChild(btnAddBouquet);
        flowersList.appendChild(container);
    });
}

/**
 * Aktualizuje stan przycisków trybu edycji
 */
function updateEditModeButtons() {
    const currentMode = getEditMode();

    const btnPosition = document.getElementById('btn-edit-position');
    const btnRotation = document.getElementById('btn-edit-rotation');
    const btnScale = document.getElementById('btn-edit-scale');

    [btnPosition, btnRotation, btnScale].forEach(btn => {
        if (btn) btn.classList.remove('active');
    });

    switch (currentMode) {
        case EDIT_MODES.POSITION:
            if (btnPosition) btnPosition.classList.add('active');
            break;
        case EDIT_MODES.ROTATION:
            if (btnRotation) btnRotation.classList.add('active');
            break;
        case EDIT_MODES.SCALE:
            if (btnScale) btnScale.classList.add('active');
            break;
    }
}

/**
 * Tworzy listę kwiatów w edytorze
 */
export function initFlowerEditor() {
    // Inicjalizuj gizmo 3D
    initGizmos();

    const canvasContainer = document.getElementById('canvas-container');

    // Obsługa myszy
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Obsługa dotyku
    if (canvasContainer) {
        canvasContainer.addEventListener('touchstart', onTouchStart, { passive: false });
        canvasContainer.addEventListener('touchmove', onTouchMove, { passive: false });
        canvasContainer.addEventListener('touchend', onTouchEnd, { passive: false });
    }

    // Przycisk zamknięcia edytora
    const closeBtn = document.getElementById('close-editor');
    closeBtn.addEventListener('click', () => {
        if (getSelectedFlower()) {
            unhighlightFlower(getSelectedFlower());
            setNullSelectedFlower();
        }
        hideFlowerEditor();
    });

    // Przycisk usuwania kwiatu
    const deleteBtn = document.getElementById('delete-flower');
    deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (getSelectedFlower()) {
            if (window.deleteSelectedFlowerCallback) {
                window.deleteSelectedFlowerCallback(getSelectedFlower());
            }
            setNullSelectedFlower();
            hideFlowerEditor();
        }
    });

    // Przyciski trybu edycji
    const btnPosition = document.getElementById('btn-edit-position');
    const btnRotation = document.getElementById('btn-edit-rotation');
    const btnScale = document.getElementById('btn-edit-scale');

    btnPosition.addEventListener('click', () => {
        const currentMode = getEditMode();
        if (currentMode === EDIT_MODES.POSITION) {
            setEditMode(EDIT_MODES.NONE);
        } else {
            setEditMode(EDIT_MODES.POSITION);
        }
        updateEditModeButtons();
    });

    btnRotation.addEventListener('click', () => {
        const currentMode = getEditMode();
        if (currentMode === EDIT_MODES.ROTATION) {
            setEditMode(EDIT_MODES.NONE);
        } else {
            setEditMode(EDIT_MODES.ROTATION);
        }
        updateEditModeButtons();
    });

    btnScale.addEventListener('click', () => {
        const currentMode = getEditMode();
        if (currentMode === EDIT_MODES.SCALE) {
            setEditMode(EDIT_MODES.NONE);
        } else {
            setEditMode(EDIT_MODES.SCALE);
        }
        updateEditModeButtons();
    });

    // Callback po wybraniu kwiatu
    window.onFlowerSelected = (flower) => {
        if (!flower) return;
        updateEditModeButtons();
    };

    // Lista kwiatów do zamiany
    const editorList = document.getElementById('flower-replace-list');

    flowerTypes.forEach(flower => {
        const button = document.createElement('button');
        button.className = 'editor-flower-button';

        const colorDiv = document.createElement('div');
        colorDiv.className = 'editor-flower-color';
        colorDiv.style.backgroundColor = `#${flower.color.toString(16).padStart(6, '0')}`;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = flower.name;

        button.appendChild(colorDiv);
        button.appendChild(nameSpan);

        button.addEventListener('click', async (event) => {
            event.stopPropagation();
            const selectedFlower = getSelectedFlower();
            if (selectedFlower) {
                const newFlower = await replaceFlower(selectedFlower, flower, scene);
                if (newFlower) {
                    updateSelectionAfterReplace(newFlower);
                }
                updateUI();
                if (onFlowerChangeCallback) onFlowerChangeCallback();
            }
        });

        editorList.appendChild(button);
    });
}

/**
 * Konfiguruje przyciski akcji
 */
function setupActionButtons() {
    document.getElementById('btn-remove').addEventListener('click', () => {
        removeLastFlower(scene);
        updateUI();
        if (onFlowerChangeCallback) onFlowerChangeCallback();
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
        clearAllFlowers(scene);
        updateUI();
        if (onFlowerChangeCallback) onFlowerChangeCallback();
    });

    document.getElementById('btn-qr').addEventListener('click', () => {
        const url = getBouquetUrl();

        if (getFlowersCount() === 0) {
            alert("Bukiet jest pusty!");
            return;
        }

        const modal = document.getElementById('qr-modal');
        const qrContainer = document.getElementById('qr-code-container');
        const textSummary = document.getElementById('qr-text-summary');

        qrContainer.innerHTML = '';

        new QRCode(qrContainer, {
            text: url,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.L
        });

        textSummary.innerHTML = `
            <strong>Zeskanuj, aby otworzyć ten bukiet.</strong><br><br>
        `;

        modal.style.display = 'flex';
    });

    document.getElementById('close-qr').addEventListener('click', () => {
        document.getElementById('qr-modal').style.display = 'none';
    });

    document.getElementById('qr-modal').addEventListener('click', (e) => {
        if (e.target.id === 'qr-modal') {
            document.getElementById('qr-modal').style.display = 'none';
        }
    });
}

/**
 * Aktualizuje stan interfejsu
 */
export function updateUI() {
    const flowerCount = getFlowersCount();
    const maxPositions = getTotalPositions();
    const availableCount = getAvailablePositionsCount();
    const btnQr = document.getElementById('btn-qr');

    if (btnQr) btnQr.disabled = flowerCount === 0;

    document.getElementById('flower-counter').textContent = `${flowerCount} / ${maxPositions}`;
    document.getElementById('available-text').textContent = `Dostępne miejsca: ${availableCount}`;

    document.getElementById('btn-remove').disabled = flowerCount === 0;
    document.getElementById('btn-clear').disabled = flowerCount === 0;

    const addOneButtons = document.querySelectorAll('.btn-add-one');
    addOneButtons.forEach(btn => {
        btn.disabled = availableCount === 0;
    });
}