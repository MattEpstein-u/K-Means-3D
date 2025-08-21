// DOM Elements
const kValueInput = document.getElementById('k-value');
const pointsValueInput = document.getElementById('points-value');
const initBtn = document.getElementById('init-btn');
const stepBtn = document.getElementById('step-btn');
const resetBtn = document.getElementById('reset-btn');
const container = document.getElementById('container');

// Scene setup
let scene, camera, renderer, points, centroids, lines;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.innerHTML = ''; // Clear previous renderer
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;

    window.addEventListener('resize', onWindowResize, false);

    generateData();
    animate();
}

function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

let data = [];
let clusters = [];
let k = 3;
let numPoints = 300;

function generateData() {
    if (points) scene.remove(points);
    if (centroids) scene.remove(centroids);
    if (lines) scene.remove(lines);

    data = [];
    for (let i = 0; i < numPoints; i++) {
        data.push({
            x: Math.random() * 4 - 2,
            y: Math.random() * 4 - 2,
            z: Math.random() * 4 - 2,
            cluster: -1
        });
    }
    drawPoints();
    initBtn.style.display = 'inline-block';
    stepBtn.style.display = 'none';
}

function drawPoints() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const color = new THREE.Color();

    const clusterColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0x00ffff, 0xff00ff];

    data.forEach(p => {
        positions.push(p.x, p.y, p.z);
        if (p.cluster === -1) {
            color.set(0x808080); // Grey for unassigned
        } else {
            color.set(clusterColors[p.cluster % clusterColors.length]);
        }
        colors.push(color.r, color.g, color.b);
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({ size: 0.1, vertexColors: true });
    
    if (points) scene.remove(points);
    points = new THREE.Points(geometry, material);
    scene.add(points);
}

function initializeCentroids() {
    k = parseInt(kValueInput.value);
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
    drawCentroids();
    initBtn.style.display = 'none';
    stepBtn.style.display = 'inline-block';
}

function drawCentroids() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    clusters.forEach(c => positions.push(c.x, c.y, c.z));
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({ color: 0x000000, size: 0.2, sizeAttenuation: true });

    if (centroids) scene.remove(centroids);
    centroids = new THREE.Points(geometry, material);
    scene.add(centroids);
}

function kMeansStep() {
    // 1. Assign points to clusters
    clusters.forEach(c => c.points = []);
    data.forEach(p => {
        let minDistance = Infinity;
        let closestCluster = -1;
        clusters.forEach((c, index) => {
            const distance = Math.sqrt(Math.pow(p.x - c.x, 2) + Math.pow(p.y - c.y, 2) + Math.pow(p.z - c.z, 2));
            if (distance < minDistance) {
                minDistance = distance;
                closestCluster = index;
            }
        });
        p.cluster = closestCluster;
        clusters[closestCluster].points.push(p);
    });

    // 2. Update centroid positions
    clusters.forEach(c => {
        if (c.points.length > 0) {
            let sumX = 0, sumY = 0, sumZ = 0;
            c.points.forEach(p => {
                sumX += p.x;
                sumY += p.y;
                sumZ += p.z;
            });
            c.x = sumX / c.points.length;
            c.y = sumY / c.points.length;
            c.z = sumZ / c.points.length;
        }
    });

    // 3. Redraw
    drawPoints();
    drawCentroids();
    drawLines();
}

function drawLines() {
    if(lines) scene.remove(lines);

    const material = new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.5 });
    const geometry = new THREE.BufferGeometry();
    const linePoints = [];

    data.forEach(p => {
        if (p.cluster !== -1) {
            const centroid = clusters[p.cluster];
            linePoints.push(p.x, p.y, p.z);
            linePoints.push(centroid.x, centroid.y, centroid.z);
        }
    });

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePoints, 3));
    lines = new THREE.LineSegments(geometry, material);
    scene.add(lines);
}

// Event Listeners
initBtn.addEventListener('click', initializeCentroids);
stepBtn.addEventListener('click', kMeansStep);
resetBtn.addEventListener('click', () => {
    numPoints = parseInt(pointsValueInput.value);
    k = parseInt(kValueInput.value);
    generateData();
});

// Initial setup
kValueInput.value = k;
pointsValueInput.value = numPoints;
init();
