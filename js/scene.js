// ============================================
// ZARZĄDZANIE SCENĄ 3D
// ============================================

import { SCENE_CONFIG } from './config.js';

let scene, camera, renderer;

/**
 * Inicjalizuje scenę 3D
 */
export function initScene(containerId) {
    const container = document.getElementById(containerId);

    // Scena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_CONFIG.backgroundColor);
    // Kamera
    camera = new THREE.PerspectiveCamera(
        SCENE_CONFIG.cameraFov,
        container.clientWidth / container.clientHeight,
        SCENE_CONFIG.cameraNear,
        SCENE_CONFIG.cameraFar
    );
    const { x, y, z } = SCENE_CONFIG.cameraInitialPosition;
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Oświetlenie
    setupLighting();

    // Podłoga
    setupFloor();

    // Obsługa resize
    window.addEventListener('resize', () => onWindowResize(container));


    return { scene, camera, renderer };
}

/**
 * Konfiguruje oświetlenie sceny
 */
function setupLighting() {
    const ambientLight = new THREE.AmbientLight(
        0xffffff,
        SCENE_CONFIG.ambientLightIntensity
    );
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(
        0xffffff,
        SCENE_CONFIG.directionalLightIntensity
    );
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(
        0xffffff,
        SCENE_CONFIG.pointLightIntensity
    );
    pointLight.position.set(-5, 5, -5);
    scene.add(pointLight);
}

/**
 * Tworzy podłogę
 */
function setupFloor() {
    const floorGeometry = new THREE.CircleGeometry(5, 33);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.8
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    floor.receiveShadow = true;
    scene.add(floor);
}

/**
 * Obsługuje zmianę rozmiaru okna
 */
function onWindowResize(container) {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

/**
 * Uruchomienie całego renderu sceny
 */
export function startAnimation() {

    function animate() {
        renderer.render(scene, camera);
    }

    renderer.setAnimationLoop(animate);
}


/**
 * Gettery dla obiektów sceny
 */
export function getScene() {
    return scene;
}

export function getCamera() {
    return camera;
}

export function getRenderer() {
    return renderer;
}