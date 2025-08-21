const sceneContainer = document.getElementById('scene-container');
const kSlider = document.getElementById('k-slider');
const kValueDisplay = document.getElementById('k-value-display');
const numPointsInput = document.getElementById('num-points');
const generateDataBtn = document.getElementById('generate-data');
const startBtn = document.getElementById('start-algorithm');
const nextStepBtn = document.getElementById('next-step');
const iterationInfo = document.getElementById('iteration-info');

let scene, camera, renderer, points, centroids, lines;
let data = [];
let clusters = [];
let k = parseInt(kSlider.value);
let numPoints = parseInt(numPointsInput.value);
let iteration = 0;
let algorithmState = 'initial'; // initial, started, step, finished

const colors = ['#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4'];

// --- Event Listeners ---
generateDataBtn.addEventListener('click', () => {
    reset();
    generateData();
});

startBtn.addEventListener('click', () => {
    if (points.length === 0) {
        alert("Please generate data first.");
        return;
    }
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
});

kSlider.addEventListener('change', () => {
    k = parseInt(kSlider.value);
    if (data.length > 0) {
        resetClustering();
    }
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


// --- Core Functions ---

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    camera = new THREE.PerspectiveCamera(75, sceneContainer.clientWidth / sceneContainer.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 6);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
    sceneContainer.innerHTML = '';
    sceneContainer.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.2);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    window.addEventListener('resize', onWindowResize, false);
    
    animate();
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
    algorithmState = 'initial';
    iteration = 0;
    updateIterationInfo();
    draw();
}

function startAlgorithm() {
    iteration = 0;
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
    draw();

    if (!centroidsMoved) {
        algorithmState = 'finished';
        updateButtons();
        alert(`Clustering converged after ${iteration} iterations.`);
    }
}

function reset() {
    data = [];
    centroids = [];
    clusters = [];
    iteration = 0;
    algorithmState = 'initial';
    if (scene) {
         while(scene.children.length > 0){ 
            scene.remove(scene.children[0]); 
        }
    }
    init();
}

function resetClustering() {
    centroids = [];
    clusters = [];
    iteration = 0;
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
        const randomIndex = Math.floor(Math.random() * data.length);
        clusters.push({
            x: data[randomIndex].x,
            y: data[randomIndex].y,
            z: data[randomIndex].z,
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
    startBtn.disabled = algorithmState !== 'initial';
    nextStepBtn.disabled = algorithmState === 'finished';
    generateDataBtn.disabled = algorithmState === 'started' || algorithmState === 'step';
}

function onWindowResize() {
    camera.aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

// --- Initial Setup ---
init();
