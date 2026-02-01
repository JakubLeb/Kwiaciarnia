// ============================================
// GŁÓWNY PLIK APLIKACJI
// Z nowym systemem space-aware placement
// ============================================

import { flowerTypes } from './config.js';
import { initScene, startAnimation } from './scene.js';
import { setupCameraControls } from './camera.js';
import { initFlowers, loadBouquetFromUrl } from './flowers.js';
import { initUI, updateUI, initFlowerEditor } from './ui.js';
import { preloadAllModels, getBoundsStatistics } from './modelLoader.js';


/**
 * Inicjalizacja aplikacji
 */
window.addEventListener('DOMContentLoaded', async () => {
    console.log('🌸 Inicjalizacja Kreatora Bukietów (Space-Aware Placement)');

    // 1. Inicjalizacja sceny 3D
    const { scene, camera, renderer } = initScene('canvas-container');
    console.log('✓ Scena 3D zainicjalizowana');

    // 2. Konfiguracja kontrolek kamery
    setupCameraControls(camera, renderer.domElement);
    console.log('✓ Kontrolki kamery skonfigurowane');

    // 3. Preładowanie modeli i obliczenie bounds - PRZED ładowaniem z URL!
    console.log('⏳ Preładowanie modeli kwiatów...');
    await preloadAllModels(flowerTypes);

    // Wyświetl statystyki bounds
    const stats = getBoundsStatistics();
    console.log('📊 Statystyki modeli:');
    stats.models.forEach(m => {
        console.log(`   ${m.id}: radius=${m.radiusXZ.toFixed(3)}, height=${m.height.toFixed(3)}`);
    });
    console.log(`   Min radius: ${stats.minRadius.toFixed(3)}, Max: ${stats.maxRadius.toFixed(3)}, Avg: ${stats.avgRadius.toFixed(3)}`);

    // 4. Inicjalizacja systemu kwiatów (space-aware)
    initFlowers();
    console.log('✓ System kwiatów zainicjalizowany');

    // 5. Inicjalizacja interfejsu użytkownika
    initUI(scene, () => {
        console.log('Bukiet zaktualizowany');
    });
    console.log('✓ Interfejs użytkownika zainicjalizowany');

    // 6. Inicjalizacja edytora kwiatów (raycaster + gizmo)
    initFlowerEditor();
    console.log('✓ Edytor kwiatów zainicjalizowany');

    // 7. Wczytaj bukiet z URL (jeśli jest) - TERAZ modele są już w cache!
    await loadBouquetFromUrl(scene);

    // 8. Start animacji
    startAnimation();
    console.log('✓ Animacja uruchomiona');

    // 9. Początkowa aktualizacja UI
    updateUI();

    console.log('✅ Aplikacja gotowa do użycia!');
    console.log('ℹ️  Nowy system: kwiaty są rozmieszczane dynamicznie z uwzględnieniem ich rzeczywistych rozmiarów');
});