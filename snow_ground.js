function createSnowGround() {
    // Ground Particles
    const groundGeo = new THREE.BufferGeometry();
    const groundPos = [];
    const groundColors = [];
    const count = 3000;
    const radius = 35; // Slightly larger than tree base

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
