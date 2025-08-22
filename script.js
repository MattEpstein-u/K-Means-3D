const sceneContainer = document.getElementById('scene-container');
const kSlider = document.getElementById('k-slider');
const kValueDisplay = document.getElementById('k-value-display');
const numPointsInput = document.getElementById('num-points');
const generateDataPointsBtn = document.getElementById('generate-data-points');
const initializeCentroidsBtn = document.getElementById('initialize-centroids');
const nextStepBtn = document.getElementById('next-step');
const iterationInfo = document.getElementById('iteration-info');
const camAngleX = document.getElementById('cam-angle-x');
const camAngleY = document.getElementById('cam-angle-y');
const camAngleZ = document.getElementById('cam-angle-z');
const camZoom = document.getElementById('cam-zoom');
const resetCameraBtn = document.getElementById('reset-camera');
const currentZoomSpan = document.getElementById('current-zoom');

let scene, camera, renderer, points, centroids, lines, controls;
let data = [];
let clusters = [];
let k = parseInt(kSlider.value);
let runningK = -1; // The actual K value the algorithm is running with
let numPoints = parseInt(numPointsInput.value);
let iteration = 0;
let algorithmState = 'initial'; // initial, started, step, finished

const colors = ['#4363d8', '#e6194B', '#f58231', '#3cb44b', '#ffe119', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4'];

// --- Event Listeners ---
generateDataPointsBtn.addEventListener('click', () => {
    reset();
    generateData();
});

initializeCentroidsBtn.addEventListener('click', () => {
    if (data.length === 0) {
        alert("Please generate data points first.");
        return;
    }
    resetClustering();
    startAlgorithm();
});

nextStepBtn.addEventListener('click', () => {
    if (data.length === 0) {
        alert("Please generate data first.");
        return;
    }
    if (algorithmState === 'initial') {
        startAlgorithm();
    }
    runSingleStep();
});

kSlider.addEventListener('input', () => {
    kValueDisplay.textContent = kSlider.value;
    updateButtons();
});

kSlider.addEventListener('change', () => {
    // This listener is intentionally left blank. 
    // The 'k' value is now read directly when 'Start' is clicked,
    // and the button state is updated by the 'input' event listener.
});

numPointsInput.addEventListener('change', () => {
    let value = parseInt(numPointsInput.value);
    if (isNaN(value) || value < 10) {
        value = 10;
    } else if (value > 1000) {
        value = 1000;
    }
    numPointsInput.value = value;
    numPoints = value;
    if (data.length > 0) {
        reset();
        generateData();
    }
});

resetCameraBtn.addEventListener('click', () => {
    setDefaultCameraView();
});


// --- Core Functions ---

function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    camera = new THREE.PerspectiveCamera(75, sceneContainer.clientWidth / sceneContainer.clientHeight, 0.1, 1000);
    // Use the same logic as setDefaultCameraView for initial camera setup
    const defaultZoom = getDefaultZoom();
    const defaultAngleX = -24 * (Math.PI / 180);
    const defaultAngleY = 24 * (Math.PI / 180);
    const verticalOffset = -0.6;
    const target = new THREE.Vector3(0, verticalOffset, 0);
    const cameraOffset = new THREE.Vector3(0, 0, defaultZoom);
    const euler = new THREE.Euler(defaultAngleX, defaultAngleY, 0, 'YXZ');
    cameraOffset.applyEuler(euler);
    camera.position.copy(target.clone().add(cameraOffset));

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
    sceneContainer.innerHTML = '';
    sceneContainer.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.2);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    // Set controls target and camera lookAt to the offset
    controls.target.set(0, -0.6, 0);
    camera.lookAt(0, -0.6, 0);
    controls.update();

    window.addEventListener('resize', onWindowResize, false);
    
    animate();
}

function init() {
    generateData();
    updateButtons();
}

function generateData() {
    data = [];
    for (let i = 0; i < numPoints; i++) {
        data.push({
            x: (Math.random() - 0.5) * 8,
            y: (Math.random() - 0.5) * 8,
            z: (Math.random() - 0.5) * 8,
            cluster: -1
        });
    }
    resetClustering; // Reset algorithm state but not camera
}

function startAlgorithm() {
    iteration = 0;
    k = parseInt(kSlider.value); // Read k value at the start
    runningK = k;
    initializeCentroids();
    assignPointsToClusters();
    algorithmState = 'step';
    updateIterationInfo();
    updateButtons();
    draw();
}

function runSingleStep() {
    if (algorithmState !== 'step') return;

    iteration++;
    updateIterationInfo();

    const centroidsMoved = updateCentroids();
    assignPointsToClusters();
    updateButtons(); // Update button state after a step
    draw();

    if (!centroidsMoved) {
        algorithmState = 'finished';
        updateButtons();
        alert(`Clustering converged after ${iteration} iterations.`);
    }
}

function reset() {
    // Clear scene objects
    if (points) scene.remove(points);
    if (centroids) scene.remove(centroids);
    if (lines) scene.remove(lines);
    
    // Reset data arrays
    data = [];
    clusters = [];
    
    // Reset algorithm state
    iteration = 0;
    runningK = -1;
    algorithmState = 'initial';
    
    updateIterationInfo();
    updateButtons();
}

function resetClustering() {
    // Clear visual elements related to clustering
    if (centroids) scene.remove(centroids);
    if (lines) scene.remove(lines);

    clusters = [];
    iteration = 0;
    runningK = -1;
    algorithmState = 'initial';
    for (const point of data) {
        point.cluster = -1;
    }
    updateIterationInfo();
    updateButtons();
    draw();
}

function initializeCentroids() {
    clusters = [];
    for (let i = 0; i < k; i++) {
        clusters.push({
            x: (Math.random() - 0.5) * 8,
            y: (Math.random() - 0.5) * 8,
            z: (Math.random() - 0.5) * 8,
            points: []
        });
    }
}

function assignPointsToClusters() {
    clusters.forEach(c => c.points = []);
    data.forEach(p => {
        let minDistance = Infinity;
        let closestCluster = -1;
        clusters.forEach((c, index) => {
            const dist = distance(p, c);
            if (dist < minDistance) {
                minDistance = dist;
                closestCluster = index;
            }
        });
        p.cluster = closestCluster;
        if (closestCluster !== -1) {
            clusters[closestCluster].points.push(p);
        }
    });
}

function updateCentroids() {
    let moved = false;
    clusters.forEach((c, index) => {
        if (c.points.length > 0) {
            let sumX = 0, sumY = 0, sumZ = 0;
            c.points.forEach(p => {
                sumX += p.x;
                sumY += p.y;
                sumZ += p.z;
            });
            const newCentroid = {
                x: sumX / c.points.length,
                y: sumY / c.points.length,
                z: sumZ / c.points.length
            };

            if (distance(clusters[index], newCentroid) > 0.01) {
                moved = true;
            }
            clusters[index].x = newCentroid.x;
            clusters[index].y = newCentroid.y;
            clusters[index].z = newCentroid.z;
        }
    });
    return moved;
}

// --- Drawing Functions ---

function draw() {
    if (points) scene.remove(points);
    if (centroids) scene.remove(centroids);
    if (lines) scene.remove(lines);

    // Draw points
    points = new THREE.Group();
    const sphereGeometry = new THREE.SphereGeometry(0.1, 16, 8);
    data.forEach(p => {
        const color = p.cluster === -1 ? '#000000' : colors[p.cluster % colors.length];
        const material = new THREE.MeshBasicMaterial({ color: color });
        const sphere = new THREE.Mesh(sphereGeometry, material);
        sphere.position.set(p.x, p.y, p.z);
        points.add(sphere);
    });
    scene.add(points);

    // Draw centroids
    centroids = new THREE.Group();
    const boxGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    clusters.forEach((c, i) => {
        const material = new THREE.MeshBasicMaterial({ color: colors[i % colors.length] });
        const cube = new THREE.Mesh(boxGeometry, material);
        cube.position.set(c.x, c.y, c.z);
        centroids.add(cube);
    });
    scene.add(centroids);
    
    // Draw lines
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.5 });
    const linePoints = [];
    data.forEach(p => {
        if (p.cluster !== -1) {
            const centroid = clusters[p.cluster];
            linePoints.push(new THREE.Vector3(p.x, p.y, p.z));
            linePoints.push(new THREE.Vector3(centroid.x, centroid.y, centroid.z));
        }
    });
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lines);
}

// --- Utility Functions ---

function distance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
}

function updateIterationInfo() {
    iterationInfo.textContent = `Iteration: ${iteration}`;
}

function updateButtons() {
    // All buttons are always enabled, except for 'Next Step' which depends on the algorithm state.
    initializeCentroidsBtn.disabled = false;
    nextStepBtn.disabled = algorithmState !== 'step';
    generateDataPointsBtn.disabled = false;
}

function onWindowResize() {
    camera.aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
}

function updateCameraInfo() {
    if (camera && controls) {
        const zoomLevel = camera.position.distanceTo(controls.target);
        if (currentZoomSpan) {
            currentZoomSpan.textContent = zoomLevel.toFixed(1);
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Required for damping
    updateCameraInfo();
    renderer.render(scene, camera);
}

// --- Initial Setup ---
setupScene();
generateData();
draw();
updateButtons();

function getDefaultZoom() {
    // Use zoom 11 for mobile, 9 for desktop
    return window.innerWidth > 768 ? 9 : 11;
}

function setDefaultCameraView() {
    if (!camera || !controls) return; // Ensure camera and controls are initialized
    const defaultZoom = getDefaultZoom();
    const defaultAngleX = -24 * (Math.PI / 180); // Convert to radians
    const defaultAngleY = 24 * (Math.PI / 180); // Convert to radians
    const verticalOffset = -0.6;

    // The target is where the camera should look
    const target = new THREE.Vector3(0, verticalOffset, 0);

    // Start with a vector pointing along the Z axis for zoom
    const cameraOffset = new THREE.Vector3(0, 0, defaultZoom);
    // Rotate it to the desired angle
    const euler = new THREE.Euler(defaultAngleX, defaultAngleY, 0, 'YXZ');
    cameraOffset.applyEuler(euler);

    // Position the camera relative to the target
    camera.position.copy(target.clone().add(cameraOffset));
    controls.target.copy(target);
    camera.lookAt(target);
    controls.update();
}

window.addEventListener('resize', () => {
    if (camera && renderer) {
        camera.aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
    }
});
