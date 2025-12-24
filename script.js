// --- VARIABLES ---
let scene, camera, renderer, controls, composer;
let treeGroup, heartGroup, snowSystem;
let isInside = false;
let isExploding = false;
let isImploding = false;
let explosionProgress = 0;
const TRIGGER_DISTANCE = 60; // CHANGE: Zoom sâu vào mới bung tim (tránh bị bung nhầm ở màn hình dọc)

// Variables for Hand Control
let handGesture = "NONE";
let handX = 0.5; // 0 (Trái) -> 1 (Phải)
let handY = 0.5; // New variable for vertical control
let isHandDetected = false; // Check for hand presence
let isZoomingImage = false;
let isZoomingByHand = false; // New flag to distinguish interaction source



// Interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// --- TOUCH & MOUSE INTERACTION ---
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

function handleInteraction(clientX, clientY) {
    if (!isInside) return;

    // Calculate position relative to canvas
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast
    raycaster.setFromCamera(mouse, camera);

    // Check intersection with Images
    const imageGroup = heartGroup.userData.imageGroup;
    if (imageGroup) {
        const intersects = raycaster.intersectObjects(imageGroup.children);

        if (intersects.length > 0) {
            const hit = intersects[0].object;
            if (hit.userData.isImage && hit.userData.url) {
                // Open Image or Video
                const viewer = document.getElementById('image-viewer');
                const img = document.getElementById('preview-img');
                const vid = document.getElementById('preview-video');

                // Check if we are clicking the same content -> Toggle Close
                const currentSrc = hit.userData.isVideo ? vid.getAttribute('src') : img.getAttribute('src');
                const isSameContent = isZoomingImage && (currentSrc === hit.userData.url || (currentSrc && currentSrc.endsWith(hit.userData.url)));

                if (isSameContent) {
                    viewer.style.display = 'none';
                    vid.pause();
                    isZoomingImage = false;
                    isZoomingByHand = false; // Reset hand flag
                    return;
                }

                if (hit.userData.isVideo) {
                    img.style.display = 'none';
                    vid.src = hit.userData.url;
                    vid.style.display = 'block';
                    vid.play();
                    // Pause Background Music
                    const bgMusic = document.getElementById('bg-music');
                    if (bgMusic) bgMusic.pause();
                } else {
                    vid.style.display = 'none';
                    vid.pause();
                    img.src = hit.userData.url;
                    img.style.display = 'block';
                }

                viewer.style.display = 'flex';
                isZoomingImage = true;
                isZoomingByHand = false; // Mouse interaction takes over
            }
        } else {
            // Click outside -> Close
            if (isZoomingImage) {
                document.getElementById('image-viewer').style.display = 'none';
                document.getElementById('preview-video').pause();
                isZoomingImage = false;
            }
        }
    }
}

function onClick(event) {
    handleInteraction(event.clientX, event.clientY);
}

function onTouchStart(event) {
    if (event.touches.length === 1) {
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        touchStartTime = Date.now();
    }
}

function onTouchEnd(event) {
    if (event.changedTouches.length === 1) {
        const touchEndX = event.changedTouches[0].clientX;
        const touchEndY = event.changedTouches[0].clientY;
        const touchEndTime = Date.now();

        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const duration = touchEndTime - touchStartTime;

        // Detect TAP: Short duration (< 300ms) and short movement (< 10px)
        if (duration < 300 && distance < 10) {
            // It's a TAP!
            event.preventDefault(); // Prevent Mouse Event bubbling (Double tap)
            handleInteraction(touchEndX, touchEndY);
        }
    }
}
// Event listener will be added in init()
let targetLookAt = new THREE.Vector3(0, 15, 0);

// INTRO ANIMATION VARIABLES
let isIntro = true;
let introProgress = 0;

function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000510, 0.002);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, 75.5); // CHANGE: Đẩy ra xa hơn nữa (60 -> 90)

    // FIX 1: Save base distance
    baseCameraDistance = camera.position.distanceTo(new THREE.Vector3(0, 15, 0));

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    document.body.appendChild(renderer.domElement);

    // Bloom
    const renderScene = new THREE.RenderPass(scene, camera);
    // CHANGE: Reduced resolution for performance (Half resolution)
    const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0;
    bloomPass.strength = 0.6;
    bloomPass.radius = 0;

    composer = new THREE.EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    setupControls();

    const ambientLight = new THREE.AmbientLight(0x666666);
    scene.add(ambientLight);

    // Event Listener cho việc đóng ảnh khi click vào overlay
    document.getElementById('image-viewer').addEventListener('click', (e) => {
        if (e.target.id === 'image-viewer') {
            document.getElementById('image-viewer').style.display = 'none';
            document.getElementById('preview-video').pause();
            isZoomingImage = false;
            // Resume Music Logic
            const bgMusic = document.getElementById('bg-music');
            if (bgMusic && bgMusic.paused && !isLetterOpen) {
                bgMusic.play().catch(e => console.log("Audio resume blocked"));
            }
        }
    });

    createTree();
    createHeartAndImages();
    createSnow();
    createStarField(); // Add Background Stars

    // Event Listener for Click (Raycaster)
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: false });

    window.addEventListener('resize', onWindowResize);
    animate();

    // Start AI
    initAI();


    // --- MUSI C & MESSAGE LOGIC ---
    // AGGRESSIVE AUTOPLAY STRATEGY
    const bgMusic = document.getElementById('bg-music');
    if (bgMusic) {
        bgMusic.volume = 0.5; // Set volume

        // Helper to trigger Fullscreen
        const openFullscreen = () => {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) { /* Safari */
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) { /* IE11 */
                elem.msRequestFullscreen();
            }
        };

        const attemptPlay = () => {
            // 1. Try to Enter Fullscreen (First Interaction)
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                openFullscreen();
            }

            // 2. Try to Play Music
            if (bgMusic.paused) {
                bgMusic.play().then(() => {
                    // Success! Remove all listeners
                    ['click', 'touchstart', 'mousemove', 'scroll', 'keydown'].forEach(evt => {
                        window.removeEventListener(evt, attemptPlay);
                        window.removeEventListener(evt, openFullscreen); // Cleanup fullscreen trigger too
                    });
                }).catch(e => {
                    // Auto-play blocked used to fail silently, now we just keep listening
                    console.log("Audio waiting for interaction...");
                });
            }
        };

        // Try immediately (Works if "Lucky")
        attemptPlay();

        // Register AGGRESSIVE listeners (Works on first "breath" of interaction)
        ['click', 'touchstart', 'mousemove', 'scroll', 'keydown'].forEach(evt => {
            window.addEventListener(evt, attemptPlay, { once: false, passive: true });
        });
    }

    document.getElementById('letter-icon').addEventListener('click', openLetter);
    document.getElementById('close-letter').addEventListener('click', closeLetter);
    document.getElementById('letter-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'letter-overlay') closeLetter();
    });
} // END INIT

const messageText = `Gửi Thảo,

Giáng sinh này không có gì quá lớn lao, chỉ là muốn nói rằng: có em, mọi thứ đều ấm hơn một chút💕.

cây thông này🎄, trái tim này❤️ và cả vũ trụ nhỏ🪐 này là dành riêng cho em.

Mong em luôn bình an và hạnh phúc.

Thương yêu em.

Người thương em
Công Anh`;

let typeIndex = 0;
let isLetterOpen = false;
let lastLetterCloseTime = 0; // Cooldown for Fist gesture

function typeWriter() {
    if (typeIndex < messageText.length) {
        document.getElementById("letter-content").innerHTML += messageText.charAt(typeIndex);
        typeIndex++;
        setTimeout(typeWriter, 50); // Speed
    }
}

function openLetter() {
    const overlay = document.getElementById('letter-overlay');
    overlay.style.display = 'flex';
    isLetterOpen = true; // Flag for logic checks

    // Reset and Start Typewriter
    document.getElementById("letter-content").innerHTML = "";
    typeIndex = 0;
    setTimeout(typeWriter, 500); // Delay start
}

function closeLetter() {
    document.getElementById('letter-overlay').style.display = 'none';
    isLetterOpen = false;
    lastLetterCloseTime = Date.now(); // Set timestamp
}

// Helper: Create Snowflake Texture using Unicode Icon
function createSnowflakeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');

    // Draw ❄ char
    context.font = '48px Arial';
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('❄', 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

function createTree() {
    treeGroup = new THREE.Group();
    treeGroup.position.y = -15;

    const particleCount = 12000;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const color1 = new THREE.Color(0x00ff00);
    const color2 = new THREE.Color(0xff3333);

    // 1. GENERATE STRICT SPIRAL PATH (Chạy theo viền)
    // Create particles along a single spiral line
    let particles = [];

    for (let i = 0; i < particleCount; i++) {
        // T: 0 -> 1 (From Bottom to Top)
        const t = i / particleCount;

        const maxTreeHeight = 60;
        const maxRadius = 25;

        // Spiral Parameters
        const loops = 15; // Increased loops for tighter spiral
        // Angle increases linearly with height: 0 -> Max Angle
        const angle = t * Math.PI * 2 * loops;

        // Height increases linearly: 0 -> Max Height
        const height = t * maxTreeHeight;

        // Radius decreases linearly: Max Radius -> 0
        const currentRadius = (1 - t) * maxRadius;

        // Base Parametric Position (The "Line")
        const baseX = Math.cos(angle) * currentRadius;
        const baseZ = Math.sin(angle) * currentRadius;
        const baseY = height;

        // Add Volume/Thickness properly (Perpendicular random offset)
        // Instead of random sphere, we want a "thick line" effect
        const thickness = 2.0;
        const randR = (Math.random() - 0.5) * thickness;
        const randH = (Math.random() - 0.5) * thickness;
        const randA = (Math.random() - 0.5) * 0.1; // Slight angle jitter

        const finalRadius = Math.max(0, currentRadius + randR);
        const finalAngle = angle + randA;

        const x = Math.cos(finalAngle) * finalRadius;
        const y = baseY + randH;
        const z = Math.sin(finalAngle) * finalRadius;

        const mixedColor = Math.random() > 0.85 ? color2 : color1;

        particles.push({
            x: x, y: y, z: z,
            r: mixedColor.r, g: mixedColor.g, b: mixedColor.b,
            sortKey: t // Critical for drawing order
        });
    }

    // Sort strictly by spiral index (t)
    particles.sort((a, b) => a.sortKey - b.sortKey);

    for (let p of particles) {
        positions.push(p.x, p.y, p.z);
        colors.push(p.r, p.g, p.b);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // IMPORTANT: Start hidden for "Draw" animation
    geometry.setDrawRange(0, 0);

    geometry.userData.originalPositions = new Float32Array(positions);

    const material = new THREE.PointsMaterial({ size: 0.3, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.95 });
    const tree = new THREE.Points(geometry, material);
    treeGroup.add(tree);
    treeGroup.userData.treeMesh = tree;

    // Star (Static at Top)
    const starShape = new THREE.Shape();
    const outerRadius = 2.5, innerRadius = 1.0, points = 5;
    for (let i = 0; i < points * 2; i++) {
        const r = (i % 2 === 0) ? outerRadius : innerRadius;
        const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) starShape.moveTo(x, y); else starShape.lineTo(x, y);
    }
    starShape.closePath();
    const starExtrude = new THREE.ExtrudeGeometry(starShape, { depth: 0.8, bevelEnabled: true, bevelSegments: 2, steps: 2, bevelSize: 0.1, bevelThickness: 0.1 });
    starExtrude.center();
    const tempStarMesh = new THREE.Mesh(starExtrude, new THREE.MeshBasicMaterial());
    const sampler = new THREE.MeshSurfaceSampler(tempStarMesh).build();
    const starCount = 800;
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    const tempVec = new THREE.Vector3();
    for (let i = 0; i < starCount; i++) {
        sampler.sample(tempVec);
        starPos.push(tempVec.x, tempVec.y, tempVec.z);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    starGeo.userData.originalPositions = new Float32Array(starPos);

    const starMesh = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffff00, size: 0.6, transparent: true, blending: THREE.AdditiveBlending }));
    starMesh.userData.isStar = true;
    starMesh.position.y = 63; // Fixed at top
    starMesh.visible = false; // Fade in later

    treeGroup.add(starMesh);
    treeGroup.userData.explosionTargets = [tree, starMesh];

    // Light
    const light = new THREE.PointLight(0xffff00, 1.5, 40);
    light.position.set(0, 63, 0); // Fixed at top
    light.visible = false;
    treeGroup.add(light);
    treeGroup.userData.starLight = light;

    createSnowGround();

    scene.add(treeGroup);
}

function createSnowGround() {
    // Ground Particles
    const groundGeo = new THREE.BufferGeometry();
    const groundPos = [];
    const groundColors = [];
    const count = 5000;
    const radius = 50; // Wider radius

    const colorWhite = new THREE.Color(0xffffff);
    const colorCyan = new THREE.Color(0xccffff);

    for (let i = 0; i < count; i++) {
        // Random distribution in a circle
        const r = Math.sqrt(Math.random()) * radius;
        const theta = Math.random() * 2 * Math.PI;

        // Position at base (y=0 relative to treeGroup, which is at -15)
        // Add slight height variation for "drift" effect
        const x = r * Math.cos(theta);
        const y = (Math.random() - 0.5) * 1.5;
        const z = r * Math.sin(theta);

        groundPos.push(x, y, z);

        // Mix colors: Mostly white, some cyan for "ice" feel
        const mixedColor = Math.random() > 0.7 ? colorCyan : colorWhite;
        groundColors.push(mixedColor.r, mixedColor.g, mixedColor.b);
    }

    groundGeo.setAttribute('position', new THREE.Float32BufferAttribute(groundPos, 3));
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(groundColors, 3));

    // Save original positions for explosion effect
    groundGeo.userData.originalPositions = new Float32Array(groundPos);

    const material = new THREE.PointsMaterial({
        size: 0.25,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.8
    });

    const groundMesh = new THREE.Points(groundGeo, material);
    groundMesh.userData.isGround = true; // Flag for special handling if needed

    // Add to tree group so it moves with the tree
    treeGroup.add(groundMesh);

    // Add to explosion targets so it explodes/fades with the tree
    if (treeGroup.userData.explosionTargets) {
        treeGroup.userData.explosionTargets.push(groundMesh);
    }
}

function createHeartAndImages() {
    heartGroup = new THREE.Group();
    heartGroup.visible = false;
    heartGroup.position.y = 15;

    // --- HEART PARTICLES ---
    const heartShape = new THREE.Shape();
    heartShape.moveTo(25, 25);
    heartShape.bezierCurveTo(25, 25, 20, 0, 0, 0);
    heartShape.bezierCurveTo(-30, 0, -30, 35, -30, 35);
    heartShape.bezierCurveTo(-30, 55, -10, 77, 25, 95);
    heartShape.bezierCurveTo(60, 77, 80, 55, 80, 35);
    heartShape.bezierCurveTo(80, 35, 80, 0, 50, 0);
    heartShape.bezierCurveTo(35, 0, 25, 25, 25, 25);
    const solidGeometry = new THREE.ExtrudeGeometry(heartShape, { depth: 15, bevelEnabled: true, bevelSegments: 20, steps: 4, bevelSize: 5, bevelThickness: 5 });
    solidGeometry.center();
    const sampler = new THREE.MeshSurfaceSampler(new THREE.Mesh(solidGeometry, new THREE.MeshBasicMaterial())).build();

    const particleCount = 3500;
    const particlesGeometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const colorCore = new THREE.Color(0xd60036);
    const colorEdge = new THREE.Color(0xff80ab);
    const tempPosition = new THREE.Vector3();

    for (let i = 0; i < particleCount; i++) {
        sampler.sample(tempPosition);
        const distXY = Math.sqrt(tempPosition.x * tempPosition.x + tempPosition.y * tempPosition.y);
        const maxRad = 60;
        let ratio = Math.min(1, distXY / maxRad);
        let bulge = Math.pow(Math.cos(ratio * Math.PI * 0.5), 1.2);
        tempPosition.z *= (1 + bulge * 1.5);
        positions.push(tempPosition.x, tempPosition.y, tempPosition.z);
        const colorRatio = Math.min(1, distXY / 50);
        const mixedColor = new THREE.Color().lerpColors(colorCore, colorEdge, colorRatio);
        colors.push(mixedColor.r, mixedColor.g, mixedColor.b);
    }
    particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    particlesGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const heartParticles = new THREE.Points(particlesGeometry, new THREE.PointsMaterial({ size: 0.25, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8 }));
    heartParticles.rotation.z = Math.PI;
    heartParticles.scale.set(0, 0, 0);
    heartParticles.userData.targetScale = 0.15;
    heartGroup.add(heartParticles);
    heartGroup.userData.heartMesh = heartParticles; // Save Ref

    // --- IMAGES (Create separate group for Rotation Control) ---
    const imageGroup = new THREE.Group();
    imageGroup.userData.isImageGroup = true;
    heartGroup.add(imageGroup);
    heartGroup.userData.imageGroup = imageGroup; // Save Ref

    const textureLoader = new THREE.TextureLoader();

    // LIST OF UNIQUE IMAGES
    // Anh thay link ảnh của anh vào đây nhé (Bao nhiêu ảnh cũng được, càng nhiều càng kín quả cầu)
    const imageUrls = [
        'image/355121643_1308807656377292_7146403328794275479_n.jpg',
        'image/4051819307472771538864501313601213323407258n.mp4',
        'image/FDownloader.net-1150920942580314-(1080p).mp4',
        'image/Screenshot_2023-11-30-00-30-15-178_com.facebook.orca.jpg',
        'image/lv_7248418720052251906_20240210012727.mp4',
        'image/received_1972754559785576.mp4',
        'image/received_670710238543214.mp4',
        'image/z4836458933553_706edd3d67a0d8feb587b0251f78913b.jpg',
        'image/2024-01-20-190239980.mp4',
        'image/5628195924203.mp4',
        'image/received_692688482611408.jpeg',
        'image/z7352422130204_3e7b3e3f7fcc9b513952014163f68ef2.jpg',
        'image/7353092487292.mp4',
        'image/received_365549549289470.mp4'
    ];
    // const imageUrls = [...baseUrls, ...baseUrls, ...baseUrls, ...baseUrls]; // REMOVED DUPLICATION

    const radius = 22; // Increase radius slightly for sphere

    imageUrls.forEach((url, i) => {
        const isVideo = url.toLowerCase().endsWith('.mp4') || url.toLowerCase().endsWith('.webm');

        if (isVideo) {
            const video = document.createElement('video');
            video.src = url;
            video.crossOrigin = 'anonymous';
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.autoplay = true;
            video.play();

            const texture = new THREE.VideoTexture(video);

            video.addEventListener('loadedmetadata', () => {
                const aspect = video.videoWidth / video.videoHeight;
                const planeGeo = new THREE.PlaneGeometry(9 * aspect, 9);
                const plane = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));

                setupPlane(plane, i, imageUrls.length, radius, url, true);
                imageGroup.add(plane);
            });
        } else {
            textureLoader.load(url, (texture) => {
                const imgAspect = texture.image.width / texture.image.height;
                const planeGeo = new THREE.PlaneGeometry(9 * imgAspect, 9);
                const plane = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));

                setupPlane(plane, i, imageUrls.length, radius, url, false);
                imageGroup.add(plane);
            });
        }
    });

    function setupPlane(plane, i, total, radius, url, isVideo) {
        // FIBONACCI SPHERE DISTRIBUTION with RANDOMNESS
        const phi = Math.acos(-1 + (2 * i) / total);
        const theta = Math.sqrt(total * Math.PI) * phi;

        // Random radius to make it "rời rạc" (scattered)
        const randomRadius = radius + (Math.random() * 15 - 5); // 17 -> 32 range

        const x = randomRadius * Math.cos(theta) * Math.sin(phi);
        const y = randomRadius * Math.cos(phi);
        const z = randomRadius * Math.sin(theta) * Math.sin(phi);

        plane.position.set(x, y, z);

        // Look at center but with slight randomness so it's not perfect
        const randomLookAt = new THREE.Vector3(
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5
        );
        plane.lookAt(randomLookAt.x, randomLookAt.y, randomLookAt.z);

        plane.scale.set(0, 0, 0);
        plane.userData.targetScale = 0.8 + Math.random() * 0.5; // Random scale too
        plane.userData.isImage = true;
        plane.userData.url = url;
        plane.userData.isVideo = isVideo;
    }

    scene.add(heartGroup);
}

function createSnow() {
    const snowGeo = new THREE.BufferGeometry();
    const snowPos = [];
    const count = 2500; // Increased count for denser snow

    for (let i = 0; i < count; i++) {
        snowPos.push(
            Math.random() * 200 - 100,
            Math.random() * 200 - 100,
            Math.random() * 200 - 100
        );
    }

    snowGeo.setAttribute('position', new THREE.Float32BufferAttribute(snowPos, 3));

    const snowflakeTexture = createSnowflakeTexture();

    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.5, // Bigger size to see the icon
        map: snowflakeTexture,
        transparent: true,
        opacity: 0.8,
        alphaTest: 0.5 // Cut out the transparent parts of the char
    });

    snowSystem = new THREE.Points(snowGeo, material);
    scene.add(snowSystem);
}

function createStarField() {
    const starsGeo = new THREE.BufferGeometry();
    const starsPos = [];

    // Create 1500 static background stars
    for (let i = 0; i < 800; i++) {
        const r = 200 + Math.random() * 300; // Far away
        const theta = 2 * Math.PI * Math.random();
        const phi = Math.acos(2 * Math.random() - 1);

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        starsPos.push(x, y, z);
    }

    starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starsPos, 3));

    // Varied point sizes for depth
    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.8,
        transparent: true,
        opacity: 0.8
    });

    const starField = new THREE.Points(starsGeo, material);
    scene.add(starField);
}

const shootingStars = [];
function createShootingStar() {
    if (!isInside || Math.random() > 0.05) return;
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-20, 10, 0)]);
    const star = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 }));
    star.position.set(Math.random() * 200 - 100, Math.random() * 100 + 50, Math.random() * 100 - 200);
    star.rotation.z = Math.random() * Math.PI;
    scene.add(star);
    shootingStars.push({ mesh: star, speed: Math.random() * 2 + 1 });
}
function updateShootingStars() {
    for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.mesh.position.x -= s.speed * 2;
        s.mesh.position.y -= s.speed;
        s.mesh.material.opacity -= 0.02;
        if (s.mesh.material.opacity <= 0) {
            scene.remove(s.mesh);
            s.mesh.geometry.dispose();
            s.mesh.material.dispose();
            shootingStars.splice(i, 1);
        }
    }
}

let resizeTimeout;
function onWindowResize() {
    // 1. Immediate update for responsiveness
    handleResize();

    // 2. Debounced update for stability (wait for mobile UI bars to settle)
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        handleResize();
        // Double check after a longer delay for slow rotation animations
        setTimeout(handleResize, 300);
    }, 100);
}



function setupControls() {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false; // Disable Panning to keep tree centered
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;
    controls.minDistance = 2;
    controls.maxDistance = 500;
    controls.target.set(0, 15, 0);
}

// FIX 4.1: SCORCHED EARTH + DEBUG + ROBUST CHECK
function handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (!width || !height) return;

    // FIX VIEWPORT: Force reset scroll to avoid zoom artifacts
    window.scrollTo(0, 0);
    document.body.style.height = window.innerHeight + 'px';

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (composer) composer.setSize(width, height);

    // DEBUG: Show status on screen
    const mode = width < height ? "PORTRAIT" : "LANDSCAPE";
    const debugMsg = `Res: ${width}x${height} | Mode: ${mode}`;
    // document.getElementById('hint-msg').innerText = debugMsg; // Uncomment if needed for persistent debug

    // CHỈ CẬP NHẬT VỊ TRÍ KHI ĐANG Ở NGOÀI
    if (!isInside && !isExploding) {

        // 1. DESTROY OLD CONTROLS
        if (controls) controls.dispose();

        // 2. CHECK ORIENTATION (Consistent with Aspect Ratio)
        const isPortrait = width < height;

        // 3. APPLY PRESETS (CỐ ĐỊNH)
        if (isPortrait) {
            // Màn hình dọc: Xa hơn (140)
            camera.position.set(0, 15, 140);
        } else {
            // Màn hình ngang: Gần hơn (80)
            camera.position.set(0, 15, 80);
        }

        // 4. LOOK AT CENTER
        camera.lookAt(0, 15, 0);

        // 5. CREATE NEW CONTROLS
        setupControls();
        controls.update(); // FORCE UPDATE IMMEDIATE
    }
}

// --- HAND LOGIC PROCESSOR ---
function processHandGestures() {
    // 1. XOAY TRÁI PHẢI & LÊN XUỐNG (WAVE & TILT)
    const threshold = 0.2;
    // Removed !isZoomingImage check to allow hand control always
    if (isHandDetected) {
        // Xoay Ngang (Y-axis) -> CHỈ XOAY KHI KHÔNG ZOOM ẢNH VÀ KHÔNG MỞ THƯ
        if (!isZoomingImage && !isLetterOpen) {
            if (handX < 0.5 - threshold) { // Tay trái
                scene.rotation.y -= 0.01;
            } else if (handX > 0.5 + threshold) { // Tay phải
                scene.rotation.y += 0.01;
            }

            // Xoay Dọc (X-axis) - "Xéo lên xéo xuống" -> CHỈ XOAY ẢNH
            // Tìm group ảnh trong heartGroup
            const imgGroup = heartGroup.userData.imageGroup;

            if (imgGroup) {
                // Tay lên cao -> Xoay ảnh lên
                if (handY < 0.5 - threshold) {
                    imgGroup.rotation.x -= 0.02;
                } else if (handY > 0.5 + threshold) { // Tay xuống -> Xoay ảnh xuống
                    imgGroup.rotation.x += 0.02;
                }
            }
        }
    } else {
        // Tự động trả về vị trí cân bằng
        // CHỈ RESET SCENE Y (Xoay ngang), KHÔNG RESET ẢNH (để giữ vị trí chọn)
        // if (Math.abs(scene.rotation.x) > 0.001) ... -> REMOVED
    }
    if (handGesture === "HEART" && !isLetterOpen && (Date.now() - lastLetterCloseTime > 1000)) {
        openLetter();
        document.getElementById('hint-msg').innerText = "Running Open Letter..."; // Debug
    }

    // 2. BUNG TIM & ĐÓNG THƯ (🖐️ OPEN)
    if (handGesture === "OPEN") {
        // PRIORITY 2: BUNG TIM (Explode Tree)
        if (!isInside && !isExploding && !isImploding) {
            isExploding = true;
            explosionProgress = 0;
            document.getElementById('message-container').style.opacity = 0;
            heartGroup.visible = true;
            heartGroup.children.forEach(child => { if (child.userData.targetScale) child.scale.set(0, 0, 0); });

            // CHANGE: Kéo camera vào trong (< 60) để tránh bị logic Zoom Out tự kích hoạt trả lại
            const activeDist = 40;
            if (camera.position.distanceTo(new THREE.Vector3(0, 15, 0)) > activeDist) {
                const dir = new THREE.Vector3().subVectors(camera.position, new THREE.Vector3(0, 15, 0)).normalize();
                const targetPos = new THREE.Vector3(0, 15, 0).add(dir.multiplyScalar(activeDist));
                camera.position.lerp(targetPos, 0.05);
            }
        }
    }

    // 3. THU VỀ (✊ FIST)
    if (handGesture === "FIST" && (isInside || isExploding) && !isImploding) {
        // PRIORITY 1: ĐÓNG THƯ (Close Letter)
        if (isLetterOpen) {
            const overlay = document.getElementById('letter-overlay');
            if (overlay.style.display !== 'none') {
                closeLetter();
                document.getElementById('hint-msg').innerText = "Running Close Letter..."; // Debug
                return; // Stop here
            }
        }
        isImploding = true;
        isInside = false;
        isExploding = false;
        isZoomingImage = false;
        controls.autoRotateSpeed = 1.0;
        document.getElementById('message-container').style.opacity = 1;
        document.getElementById('hint-msg').innerText = "🖐️ BUNG | ✊ THU | 👋 XOAY";
        controls.target.lerp(new THREE.Vector3(0, 15, 0), 0.1);

        // CHANGE: Đẩy camera ra xa (> 60) để tránh bị tự động bung lại khi rút tay
        const safeDist = 120;
        if (camera.position.distanceTo(new THREE.Vector3(0, 15, 0)) < safeDist) {
            const dir = new THREE.Vector3().subVectors(camera.position, new THREE.Vector3(0, 15, 0)).normalize();
            const targetPos = new THREE.Vector3(0, 15, 0).add(dir.multiplyScalar(safeDist));
            camera.position.lerp(targetPos, 0.05);
        }
    }

    // 4. MỞ ẢNH (👌 OK) - Popup Overlay
    if (handGesture === "OK" && isInside) {
        let minDist = Infinity;
        let nearestImage = null;

        // Tìm ảnh gần camera nhất
        const candidates = [...heartGroup.children]; // Start with direct children
        if (heartGroup.userData.imageGroup) {
            candidates.push(...heartGroup.userData.imageGroup.children); // Add images
        }

        candidates.forEach(child => {
            if (child.userData.isImage) {
                const worldPos = new THREE.Vector3();
                child.getWorldPosition(worldPos);
                const d = camera.position.distanceTo(worldPos);
                if (d < minDist) {
                    minDist = d;
                    nearestImage = child;
                }
            }
        });

        if (nearestImage && nearestImage.userData.url) {


            // Chỉ update nếu đang ẩn hoặc src khác nhau để tránh lag
            const viewer = document.getElementById('image-viewer');
            const img = document.getElementById('preview-img');
            const vid = document.getElementById('preview-video');

            if (viewer.style.display !== 'flex' || (nearestImage.userData.isVideo ? vid.getAttribute('src') : img.src) !== nearestImage.userData.url) {
                if (nearestImage.userData.isVideo) {
                    img.style.display = 'none';
                    vid.src = nearestImage.userData.url;
                    vid.style.display = 'block';
                    vid.play();
                    // Pause Background Music
                    const bgMusic = document.getElementById('bg-music');
                    if (bgMusic) bgMusic.pause();
                } else {
                    vid.style.display = 'none';
                    vid.pause();
                    img.src = nearestImage.userData.url;
                    img.style.display = 'block';
                }
                viewer.style.display = 'flex';
            }
            isZoomingImage = true;
            isZoomingByHand = true; // Mark as Hand Interaction
        }
    } else {
        // Tắt Popup khi thả tay (CHỈ NẾU ĐANG ZOOM BẰNG TAY)
        if (isZoomingByHand) {
            document.getElementById('image-viewer').style.display = 'none';
            document.getElementById('preview-video').pause();
            isZoomingImage = false;
            isZoomingByHand = false;

            // Resume Music Logic
            const bgMusic = document.getElementById('bg-music');
            if (bgMusic && bgMusic.paused && isInside) {
                bgMusic.play().catch(e => { });
            }

            if (isInside) {
                // Trả về tâm 
                controls.target.lerp(new THREE.Vector3(0, 15, 0), 0.05);
            }
        }
        // Nếu Zoom bằng Click (isZoomingImage == true nhưng isZoomingByHand == false) -> KHÔNG CAN THIỆP
    }
}

function animate() {
    requestAnimationFrame(animate);
    processHandGestures(); // Check cử chỉ tay

    // Rotate Snow
    if (snowSystem) {
        snowSystem.rotation.y -= 0.002;
    }

    // FORCE CENTER: Prevent user from panning away (redundant safety)
    if (!isInside && !isExploding) {
        controls.target.set(0, 15, 0);
    }
    controls.update();
    const time = Date.now() * 0.001;
    const distance = camera.position.distanceTo(controls.target);

    // --- INTRO ANIMATION (SPIRAL DRAW - SEQUENTIAL) ---
    if (isIntro) {
        // Linear Reveal: "Drawing" the tree along the spiral path
        introProgress += 0.0007; // CRAWLING PACE (Was 0.0015)
        if (introProgress > 1.0) {
            introProgress = 1.0;
            isIntro = false;
        }

        const ease = 1 - Math.pow(1 - introProgress, 3); // Cubic Ease Out or Linear

        const treeMesh = treeGroup.userData.treeMesh;
        if (treeMesh) {
            const total = treeMesh.geometry.attributes.position.count;
            const count = Math.floor(total * ease);
            treeMesh.geometry.setDrawRange(0, count);
        }

        // Show Star/Light at very end
        const targets = treeGroup.userData.explosionTargets;
        const starMesh = targets.find(t => t.userData.isStar);
        const light = treeGroup.userData.starLight;

        if (starMesh) starMesh.visible = (introProgress > 0.95);
        if (light) light.visible = (introProgress > 0.95);

        // Gentle Spin: Rotate along with drawing action
        // Reduced from 4*PI (2 spins) to 0.5*PI (1/4 spin) for very calm effect
        treeGroup.rotation.y = -Math.PI * 0.5 + introProgress * Math.PI * 0.5;
    }

    // --- Logic chuyển cảnh bằng Chuột (Giữ lại để backup) ---
    if (distance < TRIGGER_DISTANCE && !isInside && !isExploding && !isImploding) {
        // Nếu dùng chuột zoom vào cũng kích hoạt nổ
        isExploding = true;
        explosionProgress = 0;
        document.getElementById('message-container').style.opacity = 0;
        heartGroup.visible = true;
        heartGroup.children.forEach(child => { if (child.userData.targetScale) child.scale.set(0, 0, 0); });
    } else if (distance > TRIGGER_DISTANCE && (isInside || isExploding) && !isImploding) {
        // CHANGE: Thêm logic Zoom Out bằng chuột để thu về cây
        isImploding = true;
        isInside = false;
        isExploding = false;
        isZoomingImage = false;
        controls.autoRotateSpeed = 1.0;
        document.getElementById('message-container').style.opacity = 1;
        document.getElementById('hint-msg').innerText = "🖐️ BUNG | ✊ THU | 👋 XOAY";
        controls.target.lerp(new THREE.Vector3(0, 15, 0), 0.1);
    }

    // --- ANIMATION EXPLODE/IMPLODE ---
    if (isExploding) {
        explosionProgress += 0.02;
        if (explosionProgress >= 1) {
            explosionProgress = 1;
            isExploding = false;
            isInside = true;
            document.getElementById('hint-msg').innerHTML = "👋 Lướt & Xoay | 👌 Xem Ảnh | ✊ Thu Về";
        }
    } else if (isImploding) {
        explosionProgress -= 0.03;
        if (explosionProgress <= 0) { explosionProgress = 0; isImploding = false; isInside = false; heartGroup.visible = false; }

        // SHRINK HEART & IMAGES
        heartGroup.children.forEach(child => {
            child.scale.lerp(new THREE.Vector3(0, 0, 0), 0.1);
            if (child.userData.isImageGroup) {
                child.children.forEach(img => img.scale.lerp(new THREE.Vector3(0, 0, 0), 0.1));
            }
        });
    }

    if (isExploding || isImploding || isInside) {
        const targets = treeGroup.userData.explosionTargets || [];
        targets.forEach(mesh => {
            const pos = mesh.geometry.attributes.position.array;
            const orig = mesh.geometry.userData.originalPositions;
            let centerY = mesh.userData.isStar ? -40 : 25;

            // CHANGE: Reduced expansion factor to keep particles close
            // Was: 5.0 + (300 / (distance + 10)) -> Very far
            // Now: Fixed smaller range + gentle pulse
            // Giữ lại gần trái tim (Galaxy effect)
            const expandFactor = 3.5 + Math.sin(time * 0.5) * 0.5;

            const ease = 1 - Math.pow(1 - explosionProgress, 3);

            // Add subtle floating movement
            const floatScale = isInside ? 0.5 : 0;

            for (let i = 0; i < pos.length; i += 3) {
                // Original Expansion
                let dx = orig[i] * expandFactor;
                let dy = (orig[i + 1] - centerY) * expandFactor;
                let dz = orig[i + 2] * expandFactor;

                // Add random float (simple noise mock)
                if (isInside) {
                    dx += Math.sin(time + orig[i] * 0.1) * floatScale;
                    dy += Math.cos(time + orig[i + 1] * 0.1) * floatScale;
                    dz += Math.sin(time + orig[i + 2] * 0.1) * floatScale;
                }

                pos[i] = orig[i] + dx * ease;
                pos[i + 1] = orig[i + 1] + dy * ease;
                pos[i + 2] = orig[i + 2] + dz * ease;
            }
            mesh.geometry.attributes.position.needsUpdate = true;
            mesh.material.opacity = mesh.userData.isStar ? (1 - explosionProgress * 0.3) : (0.9 - explosionProgress * 0.4);
        });
    }

    // --- INSIDE HEART LOGIC ---
    if (isInside) {
        // CONTINUOUS ZOOM IN LOGIC (Fix one-frame bug)
        // Zoom vào sát (activeDist = 20)
        if (isHandDetected) {
            const activeDist = 50;
            const center = new THREE.Vector3(0, 15, 0);
            if (camera.position.distanceTo(center) > activeDist) {
                const dir = new THREE.Vector3().subVectors(camera.position, center).normalize();
                const targetPos = center.clone().add(dir.multiplyScalar(activeDist));
                camera.position.lerp(targetPos, 0.05);
            }
        }
        // Xoay chậm lại (0.2) khi không tương tác tay
        controls.autoRotateSpeed = isZoomingImage ? 0.0 : 0.2;
        // Bung tim ra
        heartGroup.children.forEach(child => {
            if (child.userData.targetScale) {
                const t = child.userData.targetScale;
                child.scale.lerp(new THREE.Vector3(t, t, t), 0.05);
            }
            // Handle Image Group Children
            if (child.userData.isImageGroup) {
                // IMPORTANT: Reset Group Scale to 1 (it was shrunk to 0 on implode)
                child.scale.set(1, 1, 1);

                child.children.forEach(img => {
                    if (img.userData.targetScale) {
                        const t = img.userData.targetScale;
                        img.scale.lerp(new THREE.Vector3(t, t, t), 0.05);
                    }
                });
            }
        });

        // --- PINKBOARD RHYTHM (1 -> 0.8 -> 1.2 -> 1) ---
        if (!isZoomingImage && !isLetterOpen) {
            const heartMesh = heartGroup.userData.heartMesh;
            const baseScale = heartMesh.userData.targetScale; // 0.15

            // Cycle duration: 1.3s
            const duration = 1.3;
            const t = (time % duration) / duration; // 0 -> 1

            let scaleMult = 1;

            if (t < 0.3) {
                // 0% -> 30%: Scale 1 -> 0.8
                // Normalize t from 0-0.3 to 0-1
                const localT = t / 0.3;
                scaleMult = 1 - (0.2 * localT);
            } else if (t < 0.6) {
                // 30% -> 60%: Scale 0.8 -> 1.2
                // Normalize t from 0.3-0.6 to 0-1
                const localT = (t - 0.3) / 0.3;
                scaleMult = 0.8 + (0.4 * localT);
            } else {
                // 60% -> 100%: Scale 1.2 -> 1
                // Normalize t from 0.6-1.0 to 0-1
                const localT = (t - 0.6) / 0.4;
                scaleMult = 1.2 - (0.2 * localT);
            }

            const currentScale = baseScale * scaleMult;
            heartMesh.scale.set(currentScale, currentScale, currentScale);

            // Rotate & Effects (Giữ nguyên)
            treeGroup.rotation.y += 0.0002;
            heartGroup.rotation.y -= 0.0002;
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.002;

            createShootingStar();
            updateShootingStars();
        } else {
            controls.autoRotate = false; // Turn off when viewing image or letter
        }
    } else {
        treeGroup.rotation.y += 0.0005; // Slower tree rotation
    }

    // Snow
    if (!isZoomingImage && !isLetterOpen) {
        const snPos = snowSystem.geometry.attributes.position.array;
        for (let i = 1; i < snPos.length; i += 3) {
            snPos[i] -= 0.1;
            if (snPos[i] < -100) snPos[i] = 100;
        }
        snowSystem.geometry.attributes.position.needsUpdate = true;
    }

    composer.render();
}

// --- AI SETUP ---
// --- AI SETUP ---
function initAI() {
    const videoElement = document.getElementsByClassName('input_video')[0];
    const canvasElement = document.getElementsByClassName('output_canvas')[0];
    const canvasCtx = canvasElement.getContext('2d');
    let cameraAI = null;

    function onResults(results) {
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            isHandDetected = true;
            const landmarks = results.multiHandLandmarks[0];
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
            drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1 });

            // 1. Get Position (0 -> 1)
            handX = landmarks[9].x;
            handY = landmarks[9].y; // Capture Y

            // 2. Count Fingers
            let fingersUp = 0;
            const tips = [8, 12, 16, 20];
            const pips = [6, 10, 14, 18];
            tips.forEach((tip, i) => { if (landmarks[tip].y < landmarks[pips[i]].y) fingersUp++; });

            // 3. Detect Gestures
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const indexMcp = landmarks[5]; // Thêm khớp ngón trỏ
            const wrist = landmarks[0];    // Thêm cổ tay
            const middleMcp = landmarks[9]; // Thêm khớp ngón giữa

            // Tính tỉ lệ bàn tay (để so sánh)
            const palmSize = Math.hypot(wrist.x - middleMcp.x, wrist.y - middleMcp.y);
            // Tính độ duỗi ngón trỏ
            const indexExt = Math.hypot(indexTip.x - indexMcp.x, indexTip.y - indexMcp.y);

            const distOK = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);

            if (distOK < 0.1) { // Ngón cái & trỏ chạm nhau
                // Đếm số ngón tay còn lại (ngón 3,4,5) đang giơ lên
                let otherFingersUp = 0;
                [12, 16, 20].forEach(tip => {
                    if (landmarks[tip].y < landmarks[tip - 2].y) otherFingersUp++;
                });

                if (otherFingersUp >= 2) {
                    handGesture = "OK";
                } else {
                    // Logic phân biệt Nắm Đấm vs Tim
                    // Nếu ngón trỏ duỗi ra dài (> 0.6 bàn tay) -> Tim
                    if (indexExt > 0.6 * palmSize) {
                        handGesture = "HEART"; // 🫰 Tim
                    } else {
                        // Nếu ngón trỏ co lại (Ext nhỏ) VÀ các ngón khác cũng co -> NẮM ĐẤM
                        handGesture = "FIST";
                    }
                }
            } else if (fingersUp >= 4) {
                handGesture = "OPEN";
            } else if (fingersUp === 0) {
                handGesture = "FIST";
            } else {
                handGesture = "NONE";
            }

            // Simple Status Display
            let statusText = "🖐️ Đã thấy tay";
            if (handGesture !== "NONE") {
                statusText += ` | ${handGesture}`;
            }
            document.getElementById('ai-status').innerText = statusText;
        } else {
            isHandDetected = false;
            handGesture = "NONE";
            document.getElementById('ai-status').innerText = "⚫ Đang tìm tay...";
        }
        canvasCtx.restore();
    }

    const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
    // CHANGE: modelComplexity 0 (Lite) for speed
    hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    hands.onResults(onResults);

    // Debug: Update status
    document.getElementById('ai-status').innerText = "🟡 Đang mở Camera...";

    let frameCount = 0;
    const cameraAIObj = new Camera(videoElement, {
        onFrame: async () => {
            // CHANGE: Throttling - Only process every 3rd frame (20 FPS Max)
            frameCount++;
            if (frameCount % 3 === 0) {
                await hands.send({ image: videoElement });
            }
        },
        width: 320, height: 240
    });

    cameraAIObj.start()
        .then(() => {
            document.getElementById('ai-status').innerText = "🟢 Camera đã mở. Đang đợi tay...";
        })
        .catch(err => {
            console.error(err);
            document.getElementById('ai-status').innerText = "🔴 Lỗi Camera: " + err;
        });
}

init();
