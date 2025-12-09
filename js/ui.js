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
    deleteFlower
} from './flowers.js';
import { getSelectedFlower, clearSelection, updateSelectionAfterReplace } from './Raycaster.js';

let scene;
let onFlowerChangeCallback = null;

/**
 * Inicjalizuje interfejs użytkownika
 */
export function initUI(sceneObj, onFlowerChange) {
    scene = sceneObj;
    onFlowerChangeCallback = onFlowerChange;

    createFlowersList();
    createFlowerEditorList();
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
function createFlowerEditorList() {
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
            event.stopPropagation(); // Zapobiega propagacji eventu
            const selectedFlower = getSelectedFlower();
            if (selectedFlower) {
                console.log('Zamiana kwiatu na:', flower.name);
                const newFlower = await replaceFlower(selectedFlower, flower, scene);
                if (newFlower) {
                    // Zaktualizuj zaznaczenie na nowy kwiat
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
}

/**
 * Aktualizuje stan interfejsu
 */
export function updateUI() {
    const flowerCount = getFlowersCount();
    const maxPositions = getTotalPositions();
    const availableCount = getAvailablePositionsCount();

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