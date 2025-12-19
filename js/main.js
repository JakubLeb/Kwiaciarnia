// ============================================
// GŁÓWNY PLIK APLIKACJI
// ============================================

import { BOUQUET_RINGS_CONFIG, INCLUDE_CENTER_FLOWER } from './config.js';
import { initScene, startAnimation} from './scene.js';
import { setupCameraControls } from './camera.js';
import { generateFlowerPositions, initFlowers,loadBouquetFromUrl } from './flowers.js';
import { initUI, updateUI,initFlowerEditor } from './ui.js';


/**
 * Inicjalizacja aplikacji
 */
window.addEventListener('DOMContentLoaded', async () => {
    // 1. Generowanie pozycji kwiatów
    const positions = generateFlowerPositions(BOUQUET_RINGS_CONFIG, INCLUDE_CENTER_FLOWER);
    console.log(`Wygenerowano ${positions.length} pozycji dla kwiatów`);

    // 2. Inicjalizacja systemu kwiatów
    initFlowers(positions);

    // 3. Inicjalizacja sceny 3D
    const {scene, camera, renderer} = initScene('canvas-container');
    console.log('Scena 3D zainicjalizowana');

    // 4. Konfiguracja kontrolek kamery
    setupCameraControls(camera, renderer.domElement);
    console.log('Kontrolki kamery skonfigurowane');

    // 5. Inicjalizacja interfejsu użytkownika
    initUI(scene, () => {
        // Callback wywoływany po każdej zmianie kwiatów
        console.log('Bukiet zaktualizowany');
    });
    console.log('Interfejs użytkownika zainicjalizowany');

    // 6. Inicjalizacja edytora kwiatów (raycaster)
    initFlowerEditor();
    console.log('Edytor kwiatów zainicjalizowany');

    await loadBouquetFromUrl(scene);

    // 7. Start animacji
    startAnimation();
    console.log('Animacja uruchomiona');

    // 8. Początkowa aktualizacja UI
    updateUI();

    console.log('✅ Aplikacja gotowa do użycia!');
});