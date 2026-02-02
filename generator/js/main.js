// ============================================
// GŁÓWNY PLIK APLIKACJI
// Z nowym systemem space-aware placement
// ZOPTYMALIZOWANY - ładuje TYLKO potrzebne modele
// ============================================

import { flowerTypes } from './config.js';
import { initScene, startAnimation } from './scene.js';
import { setupCameraControls } from './camera.js';
import { initFlowers, loadBouquetFromUrl } from './flowers.js';
import { initUI, updateUI, initFlowerEditor } from './ui.js';
import { getModelFromCache } from './modelLoader.js';

let loadingOverlay = null;
let progressBar = null;
let progressText = null;
let loadingText = null;

/**
 * Tworzy loading overlay z paskiem postępu
 */
function createLoadingOverlay() {
    if (loadingOverlay) return;

    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="loading-content">
            <div class="loading-icon">🌸</div>
            <p class="loading-text">Ładowanie...</p>
            <div class="progress-container">
                <div class="progress-bar"></div>
            </div>
            <p class="progress-text">0%</p>
        </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
        #loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #fef3f5 0%, #f3e8ff 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            transition: opacity 0.4s ease;
        }
        .loading-content {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(124, 58, 237, 0.15);
            min-width: 280px;
        }
        .loading-icon {
            font-size: 48px;
            margin-bottom: 16px;
            animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        .loading-text {
            color: #7c3aed;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 20px;
        }
        .progress-container {
            width: 100%;
            height: 12px;
            background: #f3e8ff;
            border-radius: 6px;
            overflow: hidden;
            margin-bottom: 12px;
        }
        .progress-bar {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #7c3aed, #a855f7);
            border-radius: 6px;
            transition: width 0.3s ease;
        }
        .progress-text {
            color: #6b7280;
            font-size: 14px;
            font-weight: 500;
            margin: 0;
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(loadingOverlay);

    progressBar = loadingOverlay.querySelector('.progress-bar');
    progressText = loadingOverlay.querySelector('.progress-text');
    loadingText = loadingOverlay.querySelector('.loading-text');
}

/**
 * Aktualizuje pasek postępu
 */
function updateProgress(percent, message = null) {
    if (!loadingOverlay) createLoadingOverlay();

    const clampedPercent = Math.min(100, Math.max(0, Math.round(percent)));

    if (progressBar) {
        progressBar.style.width = `${clampedPercent}%`;
    }
    if (progressText) {
        progressText.textContent = `${clampedPercent}%`;
    }
    if (loadingText && message) {
        loadingText.textContent = message;
    }
}

/**
 * Pokazuje loading overlay
 */
function showLoading(message = 'Ładowanie...') {
    if (!loadingOverlay) createLoadingOverlay();

    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.opacity = '1';
    updateProgress(0, message);
}

/**
 * Ukrywa loading overlay
 */
function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
        }, 400);
    }
}

/**
 * Pomocnicza funkcja sleep
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parsuje URL i zwraca indeksy typów kwiatów w bukiecie
 */
function getFlowerTypesFromUrl() {
    const params = new URLSearchParams(window.location.search);
    let encodedData = params.get('c') || params.get('b');

    if (!encodedData) return null;

    try {
        // Dekoduj base64
        let str = encodedData.replace(/-/g, '+').replace(/_/g, '/');
        while (str.length % 4) str += '=';
        const binary = atob(str);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        // Sprawdź czy skompresowane (parametr 'c')
        let data = bytes;
        if (params.has('c') && window.pako) {
            try {
                data = window.pako.inflate(bytes);
            } catch (e) {
                // Może nie być skompresowane
            }
        }

        // Wersja 2 = binarny format
        if (data[0] !== 2) return null;

        // Zbierz unikalne indeksy typów
        const typeIndices = new Set();
        let offset = 1;

        while (offset < data.length) {
            const flags = data[offset];
            const typeIndex = data[offset + 1];
            typeIndices.add(typeIndex);

            // Przeskocz do następnego kwiatu
            offset += 2 + 4; // flags + type + x + z
            if (flags & 1) offset += 2; // y
            if (flags & 2) offset += 6; // rotation
            if (flags & 4) offset += 3; // scale
        }

        return Array.from(typeIndices);
    } catch (e) {
        console.warn('Nie można sparsować URL:', e);
        return null;
    }
}

/**
 * Sprawdza czy w URL jest bukiet do załadowania
 */
function hasBouquetInUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.has('c') || params.has('b');
}

/**
 * Preładowuje tylko wybrane modele z raportowaniem postępu
 */
async function preloadModelsWithProgress(typeIndices, onProgress) {
    const typesToLoad = typeIndices
        ? typeIndices.map(i => flowerTypes[i]).filter(Boolean)
        : flowerTypes; // Załaduj wszystkie jeśli nie ma URL

    let loaded = 0;
    const total = typesToLoad.length;

    console.log(`📦 Ładowanie ${total} modeli:`, typesToLoad.map(t => t.name).join(', '));

    for (const type of typesToLoad) {
        try {
            await getModelFromCache(type.id, type.modelUrl);
        } catch (error) {
            console.error(`Błąd ładowania ${type.id}:`, error);
        }

        loaded++;
        onProgress(loaded / total, type.name);

        await sleep(10);
    }

    return typesToLoad.length;
}

/**
 * Inicjalizacja aplikacji z paskiem postępu
 */
window.addEventListener('DOMContentLoaded', async () => {
    const hasUrlBouquet = hasBouquetInUrl();

    showLoading('Inicjalizacja...');

    console.log('🌸 Inicjalizacja Kreatora Bukietów');
    const totalStartTime = performance.now();

    try {
        // ETAP 1: Inicjalizacja sceny (10%)
        updateProgress(5, 'Tworzenie sceny 3D...');
        await sleep(50);

        const { scene, camera, renderer } = initScene('canvas-container');
        console.log('✓ Scena 3D zainicjalizowana');
        updateProgress(10);

        // ETAP 2: Kontrolki kamery (15%)
        updateProgress(12, 'Konfiguracja kamery...');
        setupCameraControls(camera, renderer.domElement);
        console.log('✓ Kontrolki kamery skonfigurowane');
        updateProgress(15);

        // ETAP 3: Analiza URL - które modele potrzebujemy?
        let flowerTypeIndices = null;
        if (hasUrlBouquet) {
            updateProgress(18, 'Analiza bukietu...');
            flowerTypeIndices = getFlowerTypesFromUrl();

            if (flowerTypeIndices && flowerTypeIndices.length > 0) {
                console.log(`🎯 Bukiet zawiera ${flowerTypeIndices.length} typ(ów) kwiatów (zamiast ${flowerTypes.length})`);
            }
        }

        // ETAP 4: Preładowanie TYLKO potrzebnych modeli (15% -> 60%)
        updateProgress(20, 'Ładowanie modeli kwiatów...');
        console.log('⏳ Preładowanie modeli kwiatów...');

        const preloadStart = performance.now();
        const modelsCount = await preloadModelsWithProgress(flowerTypeIndices, (progress, name) => {
            const totalProgress = 20 + (progress * 40);
            updateProgress(totalProgress, `Ładowanie: ${name}...`);
        });

        const preloadTime = performance.now() - preloadStart;
        console.log(`📊 Załadowano ${modelsCount} modeli w ${preloadTime.toFixed(0)}ms`);
        updateProgress(60);

        // ETAP 5: System kwiatów (65%)
        updateProgress(62, 'Inicjalizacja systemu...');
        initFlowers();
        console.log('✓ System kwiatów zainicjalizowany');
        updateProgress(65);

        // ETAP 6: Interfejs użytkownika (75%)
        updateProgress(68, 'Ładowanie interfejsu...');
        initUI(scene, () => {
            console.log('Bukiet zaktualizowany');
        });
        console.log('✓ Interfejs użytkownika zainicjalizowany');
        updateProgress(75);

        // ETAP 7: Edytor kwiatów (80%)
        updateProgress(78, 'Inicjalizacja edytora...');
        initFlowerEditor();
        console.log('✓ Edytor kwiatów zainicjalizowany');
        updateProgress(80);

        // ETAP 8: Ładowanie bukietu z URL (80% -> 95%)
        if (hasUrlBouquet) {
            updateProgress(80, 'Tworzenie bukietu...');
            const loadStart = performance.now();

            let fakeProgress = 0;
            const progressInterval = setInterval(() => {
                fakeProgress += 0.08;
                if (fakeProgress < 0.9) {
                    const totalProgress = 80 + (fakeProgress * 15);
                    updateProgress(totalProgress, `Tworzenie bukietu...`);
                }
            }, 80);

            try {
                await loadBouquetFromUrl(scene);
                clearInterval(progressInterval);
                updateProgress(95, 'Bukiet gotowy!');
            } catch (e) {
                clearInterval(progressInterval);
                console.error('Błąd ładowania bukietu:', e);
            }

            const loadTime = performance.now() - loadStart;
            console.log(`✓ Bukiet załadowany w ${loadTime.toFixed(0)}ms`);
        }
        updateProgress(95);

        // ETAP 9: Finalizacja (100%)
        updateProgress(97, 'Uruchamianie...');
        startAnimation();
        console.log('✓ Animacja uruchomiona');

        updateUI();
        updateProgress(100, 'Gotowe! 🎉');

        const totalTime = performance.now() - totalStartTime;
        console.log(`✅ Aplikacja gotowa w ${totalTime.toFixed(0)}ms!`);

        // Doładuj pozostałe modele w tle (dla edytora)
        if (hasUrlBouquet && flowerTypeIndices && flowerTypeIndices.length < flowerTypes.length) {
            console.log('🔄 Doładowuję pozostałe modele w tle...');
            setTimeout(async () => {
                const remainingTypes = flowerTypes.filter((_, i) => !flowerTypeIndices.includes(i));
                for (const type of remainingTypes) {
                    try {
                        await getModelFromCache(type.id, type.modelUrl);
                    } catch (e) {}
                }
                console.log('✓ Wszystkie modele załadowane');
            }, 1000);
        }

        await sleep(500);

    } catch (error) {
        console.error('❌ Błąd podczas inicjalizacji:', error);
        updateProgress(100, 'Wystąpił błąd');
        await sleep(1000);
    } finally {
        hideLoading();
    }
});