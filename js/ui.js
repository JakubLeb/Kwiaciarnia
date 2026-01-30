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
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    unhighlightFlower,
    hideFlowerEditor
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

        // Sekcja informacyjna
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

        // Przycisk dodania jednego kwiatu
        const btnAddOne = document.createElement('button');
        btnAddOne.className = 'flower-action-button btn-add-one';
        btnAddOne.textContent = '➕';
        btnAddOne.addEventListener('click', async () => {
            await addFlower(flower, scene);
            updateUI();
            if (onFlowerChangeCallback) onFlowerChangeCallback();
        });

        // Przycisk generowania bukietu
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
 * Tworzy listę kwiatów w edytorze
 */
export function initFlowerEditor() {
    const canvasContainer = document.getElementById('canvas-container');

    // Obsługa myszy - na całym dokumencie
    document.addEventListener('mousedown', onMouseDown);

    // Obsługa dotyku dla urządzeń mobilnych - na kontenerze canvas
    if (canvasContainer) {
        canvasContainer.addEventListener('touchstart', onTouchStart, { passive: true });
        canvasContainer.addEventListener('touchmove', onTouchMove, { passive: true });
        canvasContainer.addEventListener('touchend', onTouchEnd, { passive: false });
    }

    const closeBtn = document.getElementById('close-editor');
    closeBtn.addEventListener('click', () => {
        if (getSelectedFlower()) {
            unhighlightFlower(getSelectedFlower());
            setNullSelectedFlower();
        }
        hideFlowerEditor();
    });

    const deleteBtn = document.getElementById('delete-flower');
    deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (getSelectedFlower()) {
            console.log('Usuwanie kwiatu:', getSelectedFlower());
            if (window.deleteSelectedFlowerCallback) {
                window.deleteSelectedFlowerCallback(getSelectedFlower());
            }
            setNullSelectedFlower();
            hideFlowerEditor();
        } else {
            console.log('Brak wybranego kwiatu do usunięcia');
        }
    });

    // --- OBSŁUGA POZYCJI I ROTACJI ---
    const inputs = {
        posX: document.getElementById('pos-x'),
        posY: document.getElementById('pos-y'),
        posZ: document.getElementById('pos-z'),
        rotX: document.getElementById('rot-x'),
        rotY: document.getElementById('rot-y'),
        rotZ: document.getElementById('rot-z'),
    };

    // Funkcja aktualizująca kwiat na podstawie inputów
    const updateFlowerFromInputs = () => {
        const flower = getSelectedFlower();
        if (!flower) return;

        flower.position.set(
            parseFloat(inputs.posX.value) || 0,
            parseFloat(inputs.posY.value) || 0,
            parseFloat(inputs.posZ.value) || 0
        );

        // Konwersja stopni na radiany
        flower.rotation.set(
            THREE.MathUtils.degToRad(parseFloat(inputs.rotX.value) || 0),
            THREE.MathUtils.degToRad(parseFloat(inputs.rotY.value) || 0),
            THREE.MathUtils.degToRad(parseFloat(inputs.rotZ.value) || 0)
        );
    };

    // Dodaj nasłuchiwacze do wszystkich inputów
    Object.values(inputs).forEach(input => {
        if (input) {
            input.addEventListener('input', updateFlowerFromInputs);
            input.addEventListener('change', updateFlowerFromInputs);
        }
    });

    // Zdefiniuj globalną funkcję, którą Raycaster wywoła po kliknięciu kwiata
    window.onFlowerSelected = (flower) => {
        if (!flower) return;

        // Wypełnij pola wartościami z kwiata
        inputs.posX.value = flower.position.x.toFixed(2);
        inputs.posY.value = flower.position.y.toFixed(2);
        inputs.posZ.value = flower.position.z.toFixed(2);

        // Konwersja radianów na stopnie dla użytkownika
        inputs.rotX.value = THREE.MathUtils.radToDeg(flower.rotation.x).toFixed(0);
        inputs.rotY.value = THREE.MathUtils.radToDeg(flower.rotation.y).toFixed(0);
        inputs.rotZ.value = THREE.MathUtils.radToDeg(flower.rotation.z).toFixed(0);
    };
    // ----------------------------------------

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
                console.log('Zamiana kwiatu na:', flower.name);
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

    // Zamykanie modala
    document.getElementById('close-qr').addEventListener('click', () => {
        document.getElementById('qr-modal').style.display = 'none';
    });

    // Zamykanie modala po kliknięciu w tło
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

    // Aktualizacja liczników
    document.getElementById('flower-counter').textContent = `${flowerCount} / ${maxPositions}`;
    document.getElementById('available-text').textContent = `Dostępne miejsca: ${availableCount}`;

    // Aktualizacja przycisków akcji
    document.getElementById('btn-remove').disabled = flowerCount === 0;
    document.getElementById('btn-clear').disabled = flowerCount === 0;

    // Aktualizacja przycisków dodawania
    const addOneButtons = document.querySelectorAll('.btn-add-one');
    addOneButtons.forEach(btn => {
        btn.disabled = availableCount === 0;
    });
}