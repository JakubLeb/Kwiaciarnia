// ============================================
// INTERFEJS UŻYTKOWNIKA
// Z obsługą space-aware placement
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
    getBouquetUrl,
    syncFlowerPositionAfterEdit,
    getBouquetContents
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
            btnAddOne.disabled = true;
            const result = await addFlower(flower, scene);

            if (!result) {
                // Pokaż informację że nie ma miejsca
                showTemporaryMessage('Brak miejsca w bukiecie!', 'warning');
            }

            updateUI();
            if (onFlowerChangeCallback) onFlowerChangeCallback();
        });

        const btnAddBouquet = document.createElement('button');
        btnAddBouquet.className = 'flower-action-button btn-add-bouquet';
        btnAddBouquet.textContent = '💐';
        btnAddBouquet.addEventListener('click', async () => {
            btnAddBouquet.disabled = true;
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
 * Pokazuje tymczasową wiadomość
 */
function showTemporaryMessage(text, type = 'info') {
    // Sprawdź czy już istnieje
    let msgEl = document.getElementById('temp-message');
    if (!msgEl) {
        msgEl = document.createElement('div');
        msgEl.id = 'temp-message';
        msgEl.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 500;
            z-index: 9999;
            animation: fadeInOut 2s ease-in-out forwards;
        `;
        document.body.appendChild(msgEl);

        // Dodaj animację
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                15% { opacity: 1; transform: translateX(-50%) translateY(0); }
                85% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            }
        `;
        document.head.appendChild(style);
    }

    msgEl.textContent = text;
    msgEl.style.background = type === 'warning' ? '#f59e0b' : '#3b82f6';
    msgEl.style.color = 'white';
    msgEl.style.animation = 'none';
    msgEl.offsetHeight; // Reflow
    msgEl.style.animation = 'fadeInOut 2s ease-in-out forwards';

    setTimeout(() => {
        if (msgEl.parentNode) {
            msgEl.parentNode.removeChild(msgEl);
        }
    }, 2000);
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
    document.addEventListener('mouseup', (event) => {
        onMouseUp(event);
        // Synchronizuj pozycję po zakończeniu edycji
        const selected = getSelectedFlower();
        if (selected) {
            syncFlowerPositionAfterEdit(selected);
        }
    });

    // Obsługa dotyku
    if (canvasContainer) {
        canvasContainer.addEventListener('touchstart', onTouchStart, { passive: false });
        canvasContainer.addEventListener('touchmove', onTouchMove, { passive: false });
        canvasContainer.addEventListener('touchend', (event) => {
            onTouchEnd(event);
            // Synchronizuj pozycję po zakończeniu edycji
            const selected = getSelectedFlower();
            if (selected) {
                syncFlowerPositionAfterEdit(selected);
            }
        }, { passive: false });
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
        if (getFlowersCount() === 0) {
            alert("Bukiet jest pusty!");
            return;
        }

        let url;
        try {
            url = getBouquetUrl();
        } catch (error) {
            console.error('Błąd generowania URL:', error);
            alert("Wystąpił błąd podczas generowania linku.");
            return;
        }

        const modal = document.getElementById('qr-modal');
        const qrContainer = document.getElementById('qr-code-container');
        const textSummary = document.getElementById('qr-text-summary');

        // Wyczyść poprzedni kod QR
        qrContainer.innerHTML = '';

        // Sprawdź czy URL nie jest zbyt długi
        if (url.length > 2000) {
            console.warn('URL jest bardzo długi:', url.length, 'znaków');
        }

        try {
            // Sprawdź czy biblioteka QRCode jest dostępna
            if (typeof QRCode === 'undefined') {
                throw new Error('Biblioteka QRCode nie jest załadowana');
            }

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
                <small style="word-break: break-all; color: #666;">
                    <a href="${url}" target="_blank" style="color: #7c3aed;">Otwórz link</a>
                </small>
            `;

            modal.style.display = 'flex';
        } catch (error) {
            console.error('Błąd generowania kodu QR:', error);

            // Fallback - pokaż sam link
            qrContainer.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666;">
                    <p>Nie udało się wygenerować kodu QR.</p>
                    <p style="margin-top: 10px;">Użyj linku poniżej:</p>
                </div>
            `;

            textSummary.innerHTML = `
                <div style="word-break: break-all; padding: 10px; background: #f5f5f5; border-radius: 8px; max-height: 100px; overflow-y: auto;">
                    <a href="${url}" target="_blank" style="color: #7c3aed; font-size: 12px;">${url}</a>
                </div>
                <button onclick="navigator.clipboard.writeText('${url.replace(/'/g, "\\'")}').then(() => alert('Link skopiowany!'))" 
                        style="margin-top: 10px; padding: 8px 16px; background: #7c3aed; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    📋 Kopiuj link
                </button>
            `;

            modal.style.display = 'flex';
        }
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
 * Aktualizuje listę zawartości bukietu
 */
function updateBouquetContentsList() {
    const section = document.getElementById('bouquet-contents-section');
    const list = document.getElementById('bouquet-contents-list');
    const emptyMessage = document.getElementById('bouquet-empty-message');

    // Sprawdź czy elementy istnieją
    if (!section || !list) {
        return;
    }

    const contents = getBouquetContents();

    // Sekcja zawsze widoczna
    section.style.display = 'block';

    // Wyczyść listę
    list.innerHTML = '';

    if (contents.length === 0) {
        // Pokaż komunikat o pustym bukiecie
        if (emptyMessage) {
            emptyMessage.style.display = 'block';
        }
        return;
    }

    // Ukryj komunikat o pustym bukiecie
    if (emptyMessage) {
        emptyMessage.style.display = 'none';
    }

    contents.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'bouquet-content-item';

        const colorDiv = document.createElement('div');
        colorDiv.className = 'bouquet-content-color';
        colorDiv.style.backgroundColor = `#${item.color.toString(16).padStart(6, '0')}`;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'bouquet-content-name';
        nameSpan.textContent = item.name;

        const countSpan = document.createElement('span');
        countSpan.className = 'bouquet-content-count';
        countSpan.textContent = `×${item.count}`;

        itemEl.appendChild(colorDiv);
        itemEl.appendChild(nameSpan);
        itemEl.appendChild(countSpan);
        list.appendChild(itemEl);
    });
}

/**
 * Aktualizuje stan interfejsu
 */
export function updateUI() {
    const flowerCount = getFlowersCount();
    const availableCount = getAvailablePositionsCount();
    const maxPositions = getTotalPositions();
    const btnQr = document.getElementById('btn-qr');

    if (btnQr) btnQr.disabled = flowerCount === 0;

    // Pokaż aktualną liczbę i szacowaną pojemność
    document.getElementById('flower-counter').textContent = `${flowerCount} / ~${maxPositions}`;
    document.getElementById('available-text').textContent = `Szacowane wolne miejsca: ~${availableCount}`;

    document.getElementById('btn-remove').disabled = flowerCount === 0;
    document.getElementById('btn-clear').disabled = flowerCount === 0;

    // Aktualizuj listę zawartości bukietu
    updateBouquetContentsList();

    // Przyciski dodawania - wyłącz jeśli mało miejsca
    const addOneButtons = document.querySelectorAll('.btn-add-one');
    addOneButtons.forEach(btn => {
        btn.disabled = availableCount <= 0;
    });

    // Przyciski pełnego bukietu zawsze dostępne (czyszczą poprzedni)
    const addBouquetButtons = document.querySelectorAll('.btn-add-bouquet');
    addBouquetButtons.forEach(btn => {
        btn.disabled = false;
    });
}