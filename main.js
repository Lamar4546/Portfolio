/* ======================================================================
   Lamar's portfolio — a small drivable lot with a signpost per project.
   Drive close to a sign to open its project panel.
   Supports a light "day" mode and a dark "night" mode (toggle in topbar),
   both in the page chrome and in the 3D scene's lighting/sky.
   ====================================================================== */

(function initSceneAndPage() {
  "use strict";

  function hexNum(n) { return "#" + n.toString(16).padStart(6, "0"); }

  /* ---------- populate the plain-list fallback (also used on mobile) --- */
  const listEl = document.getElementById("projectsList");
  PROJECTS.forEach((p) => {
    const row = document.createElement("div");
    row.className = "project-row";
    row.style.setProperty("--row-accent", hexNum(p.color));
    row.innerHTML = `
      <span class="project-row__stop">${p.stop}</span>
      <div>
        <div class="project-row__name">${p.name}</div>
        <div class="project-row__desc">${p.desc}</div>
        ${p.link ? `<a class="project-row__link" href="${p.link}" target="_blank" rel="noopener">View project ↗</a>` : ""}
      </div>
      <div class="project-row__stack">${p.stack.join(" · ")}</div>
    `;
    listEl.appendChild(row);
  });

  document.getElementById("scrollHint").addEventListener("click", () => {
    document.getElementById("about").scrollIntoView({ behavior: "smooth" });
  });

  /* ---------- theme (day/night) ---------- */
  function getStoredTheme() {
    try { return localStorage.getItem("lb-theme"); } catch (e) { return null; }
  }
  function setStoredTheme(t) {
    try { localStorage.setItem("lb-theme", t); } catch (e) { /* ignore */ }
  }
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  }

  let sceneThemeUpdater = null; // wired up later if the 3D scene starts successfully

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (sceneThemeUpdater) sceneThemeUpdater(theme);
  }

  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      setStoredTheme(next);
      applyTheme(next);
    });
  }

  /* ---------- panel logic ---------- */
  const panel = document.getElementById("panel");
  const panelStop = document.getElementById("panelStop");
  const panelName = document.getElementById("panelName");
  const panelDesc = document.getElementById("panelDesc");
  const panelStack = document.getElementById("panelStack");
  const panelNote = document.getElementById("panelNote");
  const panelLink = document.getElementById("panelLink");
  let currentOpenIndex = -1;

  function openPanel(index) {
    if (currentOpenIndex === index) return;
    const p = PROJECTS[index];
    panel.style.setProperty("--panel-accent", hexNum(p.color));
    panelStop.textContent = p.stop;
    panelName.textContent = p.name;
    panelDesc.textContent = p.desc;
    panelNote.textContent = p.note;
    panelStack.innerHTML = "";
    p.stack.forEach((s) => {
      const li = document.createElement("li");
      li.textContent = s;
      panelStack.appendChild(li);
    });
    if (p.link) {
      panelLink.href = p.link;
      panelLink.classList.add("is-visible");
    } else {
      panelLink.classList.remove("is-visible");
      panelLink.removeAttribute("href");
    }
    panel.classList.add("is-open");
    currentOpenIndex = index;
  }

  function closePanel() {
    panel.classList.remove("is-open");
    currentOpenIndex = -1;
  }

  document.querySelector(".panel__close").addEventListener("click", closePanel);

  /* ---------- three.js scene ---------- */
  const canvas = document.getElementById("scene");
  const lotSection = document.getElementById("lot");

  function webglAvailable() {
    try {
      const test = document.createElement("canvas");
      return !!(
        window.WebGLRenderingContext &&
        (test.getContext("webgl") || test.getContext("experimental-webgl"))
      );
    } catch (e) {
      return false;
    }
  }

  function showLotFallback(message) {
    canvas.style.display = "none";
    const hud = document.getElementById("hud");
    if (hud) hud.style.display = "none";
    const note = document.createElement("div");
    note.className = "lot__fallback";
    note.textContent = message;
    lotSection.appendChild(note);
  }

  if (!webglAvailable()) {
    showLotFallback(
      "This browser can't run the 3D lot (no WebGL available). Every project is listed further down the page."
    );
    return; // stop here — skip three.js entirely, rest of the page still works
  }

  try {
    runScene();
  } catch (err) {
    console.error("3D scene failed to start:", err);
    showLotFallback(
      "The 3D lot hit a snag loading. Every project is listed further down the page."
    );
  }

  function runScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0c0a18, 35, 115);

  const camera = new THREE.PerspectiveCamera(
    55,
    lotSection.clientWidth / lotSection.clientHeight,
    0.1,
    500
  );

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      failIfMajorPerformanceCaveat: false,
      powerPreference: "default",
    });
  } catch (e) {
    // some virtualized/software-only GPUs choke on antialias — retry without it
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      failIfMajorPerformanceCaveat: false,
      powerPreference: "default",
    });
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(lotSection.clientWidth, lotSection.clientHeight);
  renderer.shadowMap.enabled = true;

  /* lighting — colors/intensities get swapped per theme in updateSceneTheme() */
  const ambient = new THREE.AmbientLight(0x4a3a7a, 0.55);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0x8a7ad6, 0.55);
  sun.position.set(30, 45, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  scene.add(sun);

  /* a soft glowing disc standing in for the sun (day) / moon (night) */
  function makeGlowTexture(rgba) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, rgba);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const skyGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: makeGlowTexture("rgba(190,160,255,0.9)"), transparent: true, depthWrite: false, fog: false })
  );
  skyGlow.scale.set(46, 46, 1);
  skyGlow.position.set(-65, 50, -85);
  scene.add(skyGlow);

  /* starfield — visible only at night */
  const starCount = 450;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 130 + Math.random() * 60;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.55 + 0.15);
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 18;
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starsGeo = new THREE.BufferGeometry();
  starsGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xe4d9ff, size: 1.3, fog: false }));
  scene.add(stars);

  /* ground */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ color: 0x15102a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* faint grid to sell the "lot" surface — separate day/night helpers, toggled by visibility */
  const gridNight = new THREE.GridHelper(300, 60, 0x4a3a7a, 0x241c40);
  const gridDay = new THREE.GridHelper(300, 60, 0x9fb8c9, 0xc4d7e2);
  gridNight.position.y = 0.01;
  gridDay.position.y = 0.01;
  scene.add(gridNight, gridDay);

  /* ---------- layout: 5 stations around a loop ---------- */
  const LOOP_RADIUS = 26;
  const stationPositions = PROJECTS.map((_, i) => {
    const angle = (i / PROJECTS.length) * Math.PI * 2 - Math.PI / 2;
    return new THREE.Vector3(Math.cos(angle) * LOOP_RADIUS, 0, Math.sin(angle) * LOOP_RADIUS);
  });

  /* dashed ring path (visual guide only) — recolored per theme */
  const ringPts = [];
  const SEG = 96;
  for (let i = 0; i <= SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    ringPts.push(new THREE.Vector3(Math.cos(a) * LOOP_RADIUS, 0.02, Math.sin(a) * LOOP_RADIUS));
  }
  const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
  const ringMat = new THREE.LineDashedMaterial({ color: 0xb48cf5, dashSize: 1.2, gapSize: 0.9, opacity: 0.6, transparent: true });
  const ringLine = new THREE.Line(ringGeo, ringMat);
  ringLine.computeLineDistances();
  scene.add(ringLine);

  /* ---------- signpost text texture helper ---------- */
  function makeLabelTexture(text, hexColor) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#1b1732";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#" + hexColor.toString(16).padStart(6, "0");
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, c.width - 10, c.height - 10);
    ctx.fillStyle = "#ece9f7";
    ctx.font = "bold 46px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    wrapText(ctx, text, c.width / 2, 120, 440, 52);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "", lines = [];
    words.forEach((w) => {
      const test = line + w + " ";
      if (ctx.measureText(test).width > maxWidth && line !== "") {
        lines.push(line); line = w + " ";
      } else { line = test; }
    });
    lines.push(line);
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => ctx.fillText(l.trim(), x, startY + i * lineHeight));
  }

  /* ---------- build each station: pole + sign + low marker block ---------- */
  const stationGroup = new THREE.Group();
  const stationBases = [];
  PROJECTS.forEach((p, i) => {
    const pos = stationPositions[i];
    const group = new THREE.Group();
    group.position.copy(pos);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 4.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a2440 })
    );
    pole.position.y = 2.1;
    pole.castShadow = true;
    group.add(pole);

    const signTex = makeLabelTexture(p.stop + " — " + p.name, p.color);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 1.7),
      new THREE.MeshStandardMaterial({ map: signTex, side: THREE.DoubleSide })
    );
    sign.position.y = 3.6;
    sign.castShadow = true;
    group.add(sign);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 0.25, 16),
      new THREE.MeshStandardMaterial({ color: p.color, emissive: p.color, emissiveIntensity: 0.15 })
    );
    base.position.y = 0.13;
    base.receiveShadow = true;
    group.add(base);
    stationBases.push(base);

    group.userData.index = i;
    stationGroup.add(group);
  });
  scene.add(stationGroup);

  /* ---------- scattered low-poly trees for scale/flavor ---------- */
  function addTree(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 1.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x3a2e22 })
    );
    trunk.position.y = 0.7;
    trunk.castShadow = true;
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 2.2, 7),
      new THREE.MeshStandardMaterial({ color: 0x2f5b3c })
    );
    leaves.position.y = 2.1;
    leaves.castShadow = true;
    g.add(trunk, leaves);
    g.position.set(x, 0, z);
    scene.add(g);
  }
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 36 + Math.random() * 18;
    addTree(Math.cos(a) * r, Math.sin(a) * r);
  }

  /* ---------- the car ---------- */
  const car = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.55, 3.0),
    new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.4, metalness: 0.2 })
  );
  body.position.y = 0.55;
  body.castShadow = true;
  car.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.5, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x1b1732, roughness: 0.3 })
  );
  cabin.position.set(0, 1.05, -0.15);
  cabin.castShadow = true;
  car.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.3, 14);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0a18 });
  const wheelOffsets = [
    [0.85, 0.32, 1.0], [-0.85, 0.32, 1.0],
    [0.85, 0.32, -1.0], [-0.85, 0.32, -1.0],
  ];
  const wheels = wheelOffsets.map(([x, y, z]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    w.castShadow = true;
    car.add(w);
    return w;
  });

  /* headlights (front, +z is the nose — see heading math below) and taillights (rear) */
  const lightGeo = new THREE.SphereGeometry(0.12, 10, 10);
  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff6d8, emissiveIntensity: 1.2 });
  const taillightMat = new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff3b3b, emissiveIntensity: 0.9 });
  const headlights = [-0.55, 0.55].map((x) => {
    const l = new THREE.Mesh(lightGeo, headlightMat);
    l.position.set(x, 0.55, 1.52);
    car.add(l);
    return l;
  });
  const taillights = [-0.55, 0.55].map((x) => {
    const l = new THREE.Mesh(lightGeo, taillightMat);
    l.position.set(x, 0.55, -1.52);
    car.add(l);
    return l;
  });
  /* headlight beams — soft cones, only visible at night */
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.12, depthWrite: false });
  const beams = [-0.55, 0.55].map((x) => {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.4, 5, 16, 1, true), beamMat);
    beam.rotation.x = Math.PI / 2;
    beam.position.set(x, 0.55, 4.2);
    car.add(beam);
    return beam;
  });

  car.position.set(stationPositions[0].x + 6, 0, stationPositions[0].z);
  scene.add(car);

  /* ---------- theme application ---------- */
  function updateSceneTheme(theme) {
    const night = theme !== "light";

    scene.fog.color.set(night ? 0x0c0a18 : 0xcfe3ee);
    scene.fog.near = night ? 35 : 45;
    scene.fog.far = night ? 115 : 155;
    renderer.setClearColor(night ? 0x0c0a18 : 0xcfe3ee, 1);

    ambient.color.set(night ? 0x4a3a7a : 0xcfe0ec);
    ambient.intensity = night ? 0.55 : 0.9;
    sun.color.set(night ? 0x8a7ad6 : 0xfff2d0);
    sun.intensity = night ? 0.55 : 1.2;

    skyGlow.material.map = makeGlowTexture(night ? "rgba(190,160,255,0.9)" : "rgba(255,225,160,1)");
    skyGlow.material.needsUpdate = true;

    stars.visible = night;

    ground.material.color.set(night ? 0x15102a : 0xdce8ef);
    gridNight.visible = night;
    gridDay.visible = !night;

    ringMat.color.set(night ? 0xb48cf5 : 0xd9720c);

    stationBases.forEach((b) => { b.material.emissiveIntensity = night ? 0.4 : 0.1; });

    headlights.forEach((h) => { h.material.emissiveIntensity = night ? 1.3 : 0.15; });
    taillights.forEach((t) => { t.material.emissiveIntensity = night ? 1.0 : 0.3; });
    beams.forEach((b) => { b.material.opacity = night ? 0.14 : 0; });
  }
  sceneThemeUpdater = updateSceneTheme;
  updateSceneTheme(currentTheme());

  /* ---------- controls state ---------- */
  const keys = { fwd: false, back: false, left: false, right: false };

  window.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "w": case "W": case "ArrowUp": keys.fwd = true; break;
      case "s": case "S": case "ArrowDown": keys.back = true; break;
      case "a": case "A": case "ArrowLeft": keys.left = true; break;
      case "d": case "D": case "ArrowRight": keys.right = true; break;
    }
  });
  window.addEventListener("keyup", (e) => {
    switch (e.key) {
      case "w": case "W": case "ArrowUp": keys.fwd = false; break;
      case "s": case "S": case "ArrowDown": keys.back = false; break;
      case "a": case "A": case "ArrowLeft": keys.left = false; break;
      case "d": case "D": case "ArrowRight": keys.right = false; break;
    }
  });

  /* touch pad buttons for mobile */
  function bindPad(id, prop) {
    const el = document.getElementById(id);
    if (!el) return;
    const on = (e) => { e.preventDefault(); keys[prop] = true; };
    const off = (e) => { e.preventDefault(); keys[prop] = false; };
    el.addEventListener("touchstart", on, { passive: false });
    el.addEventListener("touchend", off, { passive: false });
    el.addEventListener("mousedown", on);
    el.addEventListener("mouseup", off);
    el.addEventListener("mouseleave", off);
  }
  bindPad("padUp", "fwd");
  bindPad("padDown", "back");
  bindPad("padLeft", "left");
  bindPad("padRight", "right");

  /* ---------- animation loop ---------- */
  let heading = Math.PI; // facing toward the loop initially
  car.rotation.y = heading;
  let speed = 0;
  const MAX_SPEED = 0.26;
  const ACCEL = 0.014;
  const FRICTION = 0.965;
  const TURN_RATE = 0.032;
  const OPEN_RADIUS = 6.2;
  const CLOSE_RADIUS = 8.5;

  const cameraTarget = new THREE.Vector3();
  const cameraDesired = new THREE.Vector3();

  function animate() {
    requestAnimationFrame(animate);

    if (keys.fwd) speed = Math.min(speed + ACCEL, MAX_SPEED);
    else if (keys.back) speed = Math.max(speed - ACCEL, -MAX_SPEED * 0.6);
    else speed *= FRICTION;

    if (Math.abs(speed) > 0.001) {
      const turnDir = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
      heading += turnDir * TURN_RATE * (speed > 0 ? 1 : -1);
    }

    car.rotation.y = heading;
    car.position.x += Math.sin(heading) * speed;
    car.position.z += Math.cos(heading) * speed;

    // keep on the lot
    const dist = Math.sqrt(car.position.x ** 2 + car.position.z ** 2);
    if (dist > 62) {
      const clampScale = 62 / dist;
      car.position.x *= clampScale;
      car.position.z *= clampScale;
    }

    wheels.forEach((w) => (w.rotation.x -= speed * 1.6));

    // proximity check
    let nearestIndex = -1;
    let nearestDist = Infinity;
    stationPositions.forEach((pos, i) => {
      const d = pos.distanceTo(car.position);
      if (d < nearestDist) { nearestDist = d; nearestIndex = i; }
    });
    if (nearestDist < OPEN_RADIUS) {
      openPanel(nearestIndex);
    } else if (nearestDist > CLOSE_RADIUS && currentOpenIndex !== -1) {
      closePanel();
    }

    // camera follow (third-person, slightly above/behind)
    cameraDesired.set(
      car.position.x - Math.sin(heading) * 8,
      5.2,
      car.position.z - Math.cos(heading) * 8
    );
    camera.position.lerp(cameraDesired, 0.08);
    cameraTarget.set(car.position.x, 1, car.position.z);
    camera.lookAt(cameraTarget);

    renderer.render(scene, camera);
  }
  animate();

  /* ---------- resize ---------- */
  window.addEventListener("resize", () => {
    const w = lotSection.clientWidth, h = lotSection.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  } // end runScene()
})();
