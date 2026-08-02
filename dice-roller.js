import * as THREE from "./node_modules/three/build/three.module.min.js";
import * as CANNON from "./node_modules/cannon-es/dist/cannon-es.js";

const UP = new THREE.Vector3(0, 1, 0);

function randomUnit() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] / 4294967296;
}

function randomBetween(min, max) {
  return min + (max - min) * randomUnit();
}

function generatedThrow(index = 0, count = 1) {
  const columns = Math.min(4, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  const laneX = (column - (columns - 1) / 2) * 1.45;
  const laneZ = (row - (rows - 1) / 2) * 1.28;
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    randomBetween(-Math.PI, Math.PI),
    randomBetween(-Math.PI, Math.PI),
    randomBetween(-Math.PI, Math.PI),
  )).normalize();
  return {
    position: [laneX + randomBetween(-0.2, 0.2), randomBetween(2.45, 3.25), laneZ + randomBetween(-0.22, 0.22)],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
    velocity: [-laneX * 0.38 + randomBetween(-0.45, 0.45), randomBetween(-0.35, 0.1), -laneZ * 0.28 + randomBetween(-0.55, 0.55)],
    angularVelocity: [randomBetween(-11, 11), randomBetween(-11, 11), randomBetween(-11, 11)],
  };
}

function numberTexture(value, accent) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, 512, 512);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `900 ${String(value).length > 1 ? 300 : 390}px "Arial Black", Impact, sans-serif`;
  context.lineWidth = 30;
  context.strokeStyle = "rgba(1, 5, 10, .98)";
  context.strokeText(String(value), 256, 270);
  context.fillStyle = accent;
  context.shadowColor = accent;
  context.shadowBlur = 28;
  context.fillText(String(value), 256, 270);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function faceLabel(value, normal, position, accent, size) {
  const material = new THREE.MeshBasicMaterial({
    map: numberTexture(value, accent),
    transparent: true,
    depthWrite: false,
    alphaTest: 0.04,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.position.copy(position).addScaledVector(normal, 0.025);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  mesh.renderOrder = 4;
  mesh.userData.baseScale = size;
  return mesh;
}

function materialFor(color, emissive) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.3,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    emissive,
    emissiveIntensity: 0.68,
    transparent: true,
  });
}

function d6Visual({ color = 0x18354e, accent = "#b9f4ff" } = {}) {
  const group = new THREE.Group();
  const die = new THREE.Mesh(new THREE.BoxGeometry(1.48, 1.48, 1.48, 2, 2, 2), materialFor(color, 0x071725));
  group.add(die);
  const faces = [
    { value: 1, normal: new THREE.Vector3(1, 0, 0) },
    { value: 6, normal: new THREE.Vector3(-1, 0, 0) },
    { value: 2, normal: new THREE.Vector3(0, 1, 0) },
    { value: 5, normal: new THREE.Vector3(0, -1, 0) },
    { value: 3, normal: new THREE.Vector3(0, 0, 1) },
    { value: 4, normal: new THREE.Vector3(0, 0, -1) },
  ].map((face) => {
    const label = faceLabel(face.value, face.normal, face.normal.clone().multiplyScalar(0.755), accent, 1.05);
    group.add(label);
    return { ...face, label };
  });
  return {
    group,
    normals: faces,
    shape: new CANNON.Box(new CANNON.Vec3(0.74, 0.74, 0.74)),
  };
}

function orientFace(indices, vertices) {
  const a = vertices[indices[0]];
  const b = vertices[indices[1]];
  const c = vertices[indices[2]];
  const normal = new THREE.Vector3().crossVectors(
    new THREE.Vector3().subVectors(b, a),
    new THREE.Vector3().subVectors(c, a),
  );
  const center = indices.reduce((sum, index) => sum.add(vertices[index]), new THREE.Vector3()).multiplyScalar(1 / indices.length);
  return normal.dot(center) < 0 ? [...indices].reverse() : indices;
}

function d10Definition() {
  const radius = 1;
  const height = 1.08;
  const ringY = height * (1 - Math.cos(Math.PI / 5)) / (3 - Math.cos(Math.PI / 5));
  const vertices = [new THREE.Vector3(0, height, 0), new THREE.Vector3(0, -height, 0)];
  for (let index = 0; index < 10; index += 1) {
    const angle = Math.PI * 2 * index / 10;
    vertices.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      index % 2 === 0 ? ringY : -ringY,
      Math.sin(angle) * radius,
    ));
  }
  const faces = [];
  for (let index = 0; index < 10; index += 2) faces.push(orientFace([0, 2 + index, 2 + (index + 1) % 10, 2 + (index + 2) % 10], vertices));
  for (let index = 1; index < 10; index += 2) faces.push(orientFace([1, 2 + index, 2 + (index + 1) % 10, 2 + (index + 2) % 10], vertices));
  return { vertices, faces };
}

function d10Visual({ color = 0x17354e, alternate = 0x10283d, accent = "#b9f4ff" } = {}) {
  const { vertices, faces } = d10Definition();
  const group = new THREE.Group();
  const normals = [];
  faces.forEach((face, index) => {
    const points = face.map((vertexIndex) => vertices[vertexIndex]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      ...points[0].toArray(), ...points[1].toArray(), ...points[2].toArray(),
      ...points[0].toArray(), ...points[2].toArray(), ...points[3].toArray(),
    ], 3));
    geometry.computeVertexNormals();
    group.add(new THREE.Mesh(geometry, materialFor(index % 2 ? alternate : color, 0x07111e)));
    const edgeGeometry = new THREE.BufferGeometry().setFromPoints([...points, points[0]]);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(accent), transparent: true });
    group.add(new THREE.Line(edgeGeometry, edgeMaterial));

    const normal = new THREE.Vector3().crossVectors(
      new THREE.Vector3().subVectors(points[1], points[0]),
      new THREE.Vector3().subVectors(points[2], points[0]),
    ).normalize();
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(0.25);
    const value = index + 1;
    const label = faceLabel(value === 10 ? 0 : value, normal, center, accent, 0.78);
    group.add(label);
    normals.push({ value, normal, label });
  });
  return {
    group,
    normals,
    shape: new CANNON.ConvexPolyhedron({
      vertices: vertices.map((vertex) => new CANNON.Vec3(vertex.x, vertex.y, vertex.z)),
      faces,
    }),
  };
}

function geometryDefinition(geometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const position = source.getAttribute("position");
  const vertices = [];
  const vertexMap = new Map();
  const faces = [];
  const faceData = [];
  const vertexIndex = (point) => {
    const key = `${point.x.toFixed(5)}:${point.y.toFixed(5)}:${point.z.toFixed(5)}`;
    if (!vertexMap.has(key)) {
      vertexMap.set(key, vertices.length);
      vertices.push(point.clone());
    }
    return vertexMap.get(key);
  };
  for (let offset = 0; offset < position.count; offset += 3) {
    const points = [0, 1, 2].map((step) => new THREE.Vector3().fromBufferAttribute(position, offset + step));
    const indices = orientFace(points.map(vertexIndex), vertices);
    const ordered = indices.map((index) => vertices[index]);
    const normal = new THREE.Vector3().crossVectors(
      new THREE.Vector3().subVectors(ordered[1], ordered[0]),
      new THREE.Vector3().subVectors(ordered[2], ordered[0]),
    ).normalize();
    const center = ordered.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / 3);
    faces.push(indices);
    faceData.push({ normal, center, points: ordered });
  }
  return { source, vertices, faces, faceData };
}

function groupedFaceData(faceData) {
  const groups = [];
  for (const face of faceData) {
    const plane = face.normal.dot(face.center);
    let group = groups.find((candidate) => candidate.normal.dot(face.normal) > 0.999 && Math.abs(candidate.plane - plane) < 0.012);
    if (!group) {
      group = { normal: face.normal.clone(), plane, points: [] };
      groups.push(group);
    }
    face.points.forEach((point) => {
      if (!group.points.some((entry) => entry.distanceToSquared(point) < 0.00001)) group.points.push(point);
    });
  }
  return groups.map((group) => ({
    normal: group.normal,
    center: group.points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / group.points.length),
  }));
}

function polyVisual(sides, { color = 0x17354e, accent = "#b9f4ff" } = {}) {
  const geometryBySides = {
    4: () => new THREE.TetrahedronGeometry(1.02, 0),
    8: () => new THREE.OctahedronGeometry(1.02, 0),
    12: () => new THREE.DodecahedronGeometry(1.02, 0),
    20: () => new THREE.IcosahedronGeometry(1.04, 0),
  };
  const geometry = geometryBySides[sides]();
  const definition = geometryDefinition(geometry);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, materialFor(color, 0x071725)));
  group.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 18),
    new THREE.LineBasicMaterial({ color: new THREE.Color(accent), transparent: true, opacity: 0.72 }),
  ));
  const labelSize = { 4: 0.86, 8: 0.72, 12: 0.58, 20: 0.46 }[sides];
  const normals = groupedFaceData(definition.faceData).map((face, index) => {
    const value = index + 1;
    const label = faceLabel(value, face.normal, face.center, accent, labelSize);
    group.add(label);
    return { value, normal: face.normal, label };
  });
  definition.source.dispose();
  return {
    group,
    normals,
    shape: new CANNON.ConvexPolyhedron({
      vertices: definition.vertices.map((vertex) => new CANNON.Vec3(vertex.x, vertex.y, vertex.z)),
      faces: definition.faces,
    }),
  };
}

function visualFor(spec) {
  if (spec.sides === 10) return d10Visual(spec);
  if (spec.sides === 6) return d6Visual(spec);
  return polyVisual(spec.sides, spec);
}

function matchingPairs(results) {
  const groups = new Map();
  results.forEach((value, index) => {
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(index);
  });
  const pairs = [];
  groups.forEach((indices, value) => {
    for (let offset = 0; offset + 1 < indices.length; offset += 2) {
      pairs.push({ indices: [indices[offset], indices[offset + 1]], sourceValue: value, value: value * 2 });
    }
  });
  return pairs;
}

function fusedResultVisual(value) {
  const group = new THREE.Group();
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xff54e8,
    emissive: 0x6f0fff,
    emissiveIntensity: 2.2,
    metalness: 0.2,
    roughness: 0.08,
    clearcoat: 1,
    transparent: true,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 1), material);
  group.add(core);
  const label = faceLabel(value, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0.5, 0), "#ffffff", 0.5);
  group.add(label);
  return { group, material, label };
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => {
        material.map?.dispose?.();
        material.dispose?.();
      });
    } else {
      child.material?.map?.dispose?.();
      child.material?.dispose?.();
    }
  });
}

function topFace(visual, body) {
  const quaternion = new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
  let best = visual.normals[0];
  let bestDot = -Infinity;
  for (const face of visual.normals) {
    const dot = face.normal.clone().applyQuaternion(quaternion).dot(UP);
    if (dot > bestDot) {
      best = face;
      bestDot = dot;
    }
  }
  return best;
}

export class PhysicalDiceRoller {
  constructor(elements) {
    this.shell = elements.shell;
    this.stage = elements.stage;
    this.title = elements.title;
    this.subtitle = elements.subtitle;
    this.result = elements.result;
    this.actions = elements.actions;
    this.canvasHost = elements.canvasHost;
    this.onRollStart = elements.onRollStart;
    this.active = null;
    this.frame = null;
    this.lastTime = 0;
    this.settleStart = 0;
    this.startedAt = 0;
    this.resizeObserver = new ResizeObserver(() => this.resize());
  }

  isActive() {
    return Boolean(this.active);
  }

  positionAt(anchor) {
    const rect = anchor?.getBoundingClientRect?.();
    const preferredX = rect ? rect.left + rect.width * 0.68 : window.innerWidth / 2;
    const preferredY = rect ? rect.top + rect.height / 2 - 58 : window.innerHeight / 2;
    const x = Math.min(window.innerWidth - 130, Math.max(130, preferredX));
    const y = Math.min(window.innerHeight - 135, Math.max(110, preferredY));
    this.stage.style.setProperty("--dice-left", `${x}px`);
    this.stage.style.setProperty("--dice-top", `${y}px`);
  }

  roll({ sides, title, subtitle, config, onConfig, onResolved, onSettled, anchor }) {
    const visual = sides === 10
      ? { sides: 10, color: 0x17354e, alternate: 0x10283d, accent: "#b9f4ff" }
      : { sides: 6, color: 0x18354e, accent: "#b9f4ff" };
    return this.rollDice({
      dice: [visual],
      title,
      subtitle,
      config: config ? [config] : null,
      onConfig: (configs) => onConfig?.(configs[0]),
      onResolved: (results) => onResolved?.(results[0]),
      onSettled: (results) => onSettled?.(results[0]),
      anchor,
    });
  }

  rollPercentile({ title, subtitle, config, onConfig, onResolved, onSettled, anchor }) {
    const percentileResult = (results) => {
      const tens = results[0] === 10 ? 0 : results[0];
      const ones = results[1] === 10 ? 0 : results[1];
      return { tens, ones, total: tens === 0 && ones === 0 ? 100 : tens * 10 + ones };
    };
    return this.rollDice({
      dice: [
        { sides: 10, role: "tens", color: 0x7a101d, alternate: 0x4f0913, accent: "#ffb5bf" },
        { sides: 10, role: "ones", color: 0x17354e, alternate: 0x10283d, accent: "#b9f4ff" },
      ],
      title,
      subtitle,
      config,
      onConfig,
      onResolved: (results) => onResolved?.(percentileResult(results)),
      onSettled: (results) => onSettled?.(percentileResult(results)),
      anchor,
    });
  }

  rollPool({ sides, title, subtitle, onResolved, onSettled, anchor, fusion = true }) {
    const palette = {
      4: { color: 0x3f1955, accent: "#eac5ff" },
      6: { color: 0x18354e, accent: "#b9f4ff" },
      8: { color: 0x174d42, accent: "#b9ffea" },
      10: { color: 0x5a3212, alternate: 0x3d210b, accent: "#ffe0a8" },
      12: { color: 0x621d32, accent: "#ffc2d3" },
      20: { color: 0x28396c, accent: "#c7d3ff" },
    };
    return this.rollDice({
      dice: sides.map((dieSides) => ({ sides: dieSides, ...(palette[dieSides] || palette[6]) })),
      title,
      subtitle,
      onResolved,
      onSettled,
      anchor,
      fusion,
      pool: true,
    });
  }

  async rollDice({ dice, title, subtitle, config, onConfig, onResolved, onSettled, anchor, fusion = false, pool = false }) {
    this.stop();
    try {
      this.onRollStart?.({ dice });
    } catch {
      // Audio feedback must never prevent a physical roll.
    }
    this.shell.hidden = false;
    this.shell.classList.remove("celebrating", "choices-ready");
    this.shell.classList.toggle("pool-roll", pool);
    this.title.textContent = title;
    this.subtitle.textContent = subtitle;
    this.result.hidden = true;
    this.actions.innerHTML = "";
    this.positionAt(pool ? null : anchor);

    this.scene = new THREE.Scene();
    this.viewHalfHeight = pool ? Math.max(4.7, Math.ceil(dice.length / 4) * 1.15 + 1.35) : 2.9;
    this.camera = new THREE.OrthographicCamera(-3.7, 3.7, this.viewHalfHeight, -this.viewHalfHeight, 0.1, 30);
    this.camera.position.set(0, 12, 0);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvasHost.replaceChildren(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xdaf7ff, 0x07101a, 2.6));
    const key = new THREE.DirectionalLight(0xffffff, 4.6);
    key.position.set(-3, 8, 4);
    key.castShadow = true;
    this.scene.add(key);
    const rim = new THREE.PointLight(0x2bd8ff, 9, 16);
    rim.position.set(3, 4, -2);
    this.scene.add(rim);

    const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(pool ? 10 : 8, pool ? 7 : 6), new THREE.ShadowMaterial({ opacity: 0.28 }));
    shadowFloor.rotation.x = -Math.PI / 2;
    shadowFloor.receiveShadow = true;
    this.scene.add(shadowFloor);

    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -34, 0) });
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.friction = 0.44;
    this.world.defaultContactMaterial.restitution = 0.2;
    const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(floorBody);
    this.addWalls(pool);

    const throwConfigs = config || dice.map((_, index) => generatedThrow(index, dice.length));
    const activeDice = dice.map((spec, index) => {
      const visual = visualFor(spec);
      visual.group.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.scene.add(visual.group);
      const body = new CANNON.Body({
        mass: 1,
        shape: visual.shape,
        linearDamping: 0.26,
        angularDamping: 0.24,
        sleepSpeedLimit: 0.1,
        sleepTimeLimit: 0.42,
      });
      const throwConfig = throwConfigs[index] || generatedThrow(index, dice.length);
      body.position.set(...throwConfig.position);
      body.quaternion.set(...throwConfig.quaternion);
      body.velocity.set(...throwConfig.velocity);
      body.angularVelocity.set(...throwConfig.angularVelocity);
      this.world.addBody(body);
      return { body, visual, spec, winningFace: null };
    });
    onConfig?.(throwConfigs);

    this.active = {
      dice: activeDice,
      onResolved,
      onSettled,
      resolved: false,
      delivered: false,
      resolvedAt: 0,
      results: null,
      fusion,
      pool,
      fusionPairs: [],
      fusedVisuals: [],
    };
    this.startedAt = performance.now();
    this.settleStart = 0;
    this.lastTime = performance.now();
    this.resizeObserver.observe(this.canvasHost);
    this.resize();
    this.frame = requestAnimationFrame((time) => this.tick(time));
  }

  addWalls(pool = false) {
    const halfWidth = pool ? 4.7 : 3.4;
    const halfDepth = pool ? 3.15 : 2.45;
    const walls = [
      { half: [halfWidth, 1.6, 0.12], position: [0, 1.5, -halfDepth] },
      { half: [halfWidth, 1.6, 0.12], position: [0, 1.5, halfDepth] },
      { half: [0.12, 1.6, halfDepth], position: [-halfWidth, 1.5, 0] },
      { half: [0.12, 1.6, halfDepth], position: [halfWidth, 1.5, 0] },
    ];
    for (const wall of walls) {
      const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(...wall.half)) });
      body.position.set(...wall.position);
      this.world.addBody(body);
    }
  }

  tick(time) {
    if (!this.active) return;
    const elapsed = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    if (!this.active.resolved) {
      this.world.step(1 / 60, elapsed, 4);
      for (const item of this.active.dice) {
        item.visual.group.position.copy(item.body.position);
        item.visual.group.quaternion.copy(item.body.quaternion);
      }
      const slow = this.active.dice.every(({ body }) => body.velocity.length() < 0.14 && body.angularVelocity.length() < 0.2);
      if (slow && time - this.startedAt > 650) {
        if (!this.settleStart) this.settleStart = time;
        if (time - this.settleStart > 360) this.resolve(time);
      } else {
        this.settleStart = 0;
      }
      if (time - this.startedAt > 1900) this.resolve(time);
    } else {
      this.animateResolution(time);
    }

    if (!this.active || !this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
    if (this.active) this.frame = requestAnimationFrame((nextTime) => this.tick(nextTime));
  }

  resolve(time = performance.now()) {
    if (!this.active || this.active.resolved) return;
    this.active.resolved = true;
    this.active.resolvedAt = time;
    this.active.results = this.active.dice.map((item) => {
      item.winningFace = topFace(item.visual, item.body);
      item.settleQuaternion = item.visual.group.quaternion.clone();
      const winningNormal = item.winningFace.normal.clone().applyQuaternion(item.settleQuaternion).normalize();
      const correction = new THREE.Quaternion().setFromUnitVectors(winningNormal, UP);
      item.targetQuaternion = correction.multiply(item.settleQuaternion.clone()).normalize();
      item.settlePosition = item.visual.group.position.clone();
      item.targetPosition = item.settlePosition.clone();
      item.targetPosition.y = Math.max(item.targetPosition.y, 0.82);
      item.body.type = CANNON.Body.STATIC;
      item.body.velocity.setZero();
      item.body.angularVelocity.setZero();
      return item.winningFace.value;
    });
    if (this.active.fusion) {
      this.active.fusionPairs = matchingPairs(this.active.results).map((pair) => {
        const first = this.active.dice[pair.indices[0]];
        const second = this.active.dice[pair.indices[1]];
        const midpoint = first.visual.group.position.clone().add(second.visual.group.position).multiplyScalar(0.5);
        midpoint.y = Math.max(0.82, midpoint.y + 0.5);
        return {
          ...pair,
          midpoint,
          starts: [first.visual.group.position.clone(), second.visual.group.position.clone()],
          visual: null,
        };
      });
    }
    try {
      this.active.onResolved?.(this.active.results);
    } catch {
      // A notification should never interrupt the physical roll.
    }
  }

  animateResolution(time) {
    const age = time - this.active.resolvedAt;
    const pairedIndices = new Set(this.active.fusionPairs.flatMap((pair) => pair.indices));
    for (const [index, item] of this.active.dice.entries()) {
      const settleProgress = Math.min(1, age / 260);
      const settleEase = 1 - (1 - settleProgress) ** 3;
      item.visual.group.quaternion.slerpQuaternions(item.settleQuaternion, item.targetQuaternion, settleEase);
      item.visual.group.position.lerpVectors(item.settlePosition, item.targetPosition, settleEase);
      if (pairedIndices.has(index)) continue;
      const pulse = 1 + Math.sin(age / 85) * 0.12;
      item.winningFace.label.scale.setScalar(age < 1350 ? 1.16 * pulse : 1.08);
      item.winningFace.label.material.blending = THREE.AdditiveBlending;
      if (age > 1420) {
        const opacity = Math.max(0, 1 - (age - 1420) / 360);
        item.visual.group.traverse((child) => {
          if (child.material) {
            child.material.transparent = true;
            child.material.opacity = opacity;
          }
        });
      }
    }

    for (const pair of this.active.fusionPairs) {
      const progress = Math.min(1, age / 430);
      const eased = 1 - (1 - progress) ** 3;
      pair.indices.forEach((diceIndex, pairIndex) => {
        const item = this.active.dice[diceIndex];
        if (age < 430) {
          item.visual.group.visible = true;
          item.visual.group.position.lerpVectors(pair.starts[pairIndex], pair.midpoint, eased);
          item.visual.group.position.y += Math.sin(progress * Math.PI) * 0.8;
          item.visual.group.scale.setScalar(1 - eased * 0.58);
          item.visual.group.rotation.y += 0.075;
        } else {
          item.visual.group.visible = false;
        }
      });
      if (age >= 390 && !pair.visual) {
        pair.visual = fusedResultVisual(pair.value);
        pair.visual.group.position.copy(pair.midpoint);
        pair.visual.group.scale.setScalar(0.05);
        this.scene.add(pair.visual.group);
        this.active.fusedVisuals.push(pair.visual);
      }
      if (pair.visual) {
        const birth = Math.max(0, age - 390);
        const scale = Math.min(1, birth / 190);
        pair.visual.group.scale.setScalar((1 - (1 - scale) ** 3) * (1 + Math.sin(birth / 62) * 0.06));
        pair.visual.material.color.setHSL((birth / 850) % 1, 0.88, 0.58);
        pair.visual.material.emissive.setHSL((birth / 850 + 0.16) % 1, 0.92, 0.42);
        pair.visual.group.rotation.y += 0.055;
        if (age > 1380) {
          const opacity = Math.max(0, 1 - (age - 1380) / 420);
          pair.visual.group.traverse((child) => {
            if (child.material) {
              child.material.transparent = true;
              child.material.opacity = opacity;
            }
          });
        }
      }
    }

    const deliveryAge = this.active.fusionPairs.length ? 1840 : 1800;
    if (age >= deliveryAge && !this.active.delivered) {
      this.active.delivered = true;
      this.active.dice.forEach((item) => { item.visual.group.visible = false; });
      this.active.fusedVisuals.forEach((item) => { item.group.visible = false; });
      this.active.onSettled?.(this.active.results);
    }
  }

  showPersistedResult({ title, subtitle, result, anchor }) {
    this.stop();
    this.shell.hidden = false;
    this.shell.classList.remove("celebrating");
    this.title.textContent = `${title}: ${result}`;
    this.subtitle.textContent = subtitle;
    this.canvasHost.replaceChildren();
    this.actions.innerHTML = "";
    this.positionAt(anchor);
    this.active = { persisted: true };
  }

  showChoices(choices) {
    this.actions.innerHTML = "";
    for (const choice of choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = choice.label;
      button.className = choice.className || "";
      button.addEventListener("click", choice.action, { once: true });
      this.actions.append(button);
    }
    this.shell.classList.add("choices-ready");
  }

  reroll(options) {
    return this.roll(options);
  }

  celebrate(duration = 450) {
    if (!this.active) return Promise.resolve();
    this.shell.style.setProperty("--celebration-duration", `${duration}ms`);
    this.shell.classList.add("celebrating");
    return new Promise((resolve) => {
      window.setTimeout(() => {
        this.stop();
        this.shell.hidden = true;
        resolve();
      }, duration);
    });
  }

  stop() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.resizeObserver.disconnect();
    if (this.active?.dice) this.active.dice.forEach((item) => disposeObject(item.visual.group));
    if (this.active?.fusedVisuals) this.active.fusedVisuals.forEach((item) => disposeObject(item.group));
    this.renderer?.dispose?.();
    this.canvasHost?.replaceChildren();
    this.active = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.world = null;
    this.shell?.classList.remove("choices-ready");
    this.shell?.classList.remove("pool-roll");
    if (this.shell) this.shell.hidden = true;
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const width = Math.max(180, this.canvasHost.clientWidth);
    const height = Math.max(140, this.canvasHost.clientHeight);
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    const halfHeight = this.viewHalfHeight || 2.9;
    this.camera.left = -halfHeight * aspect;
    this.camera.right = halfHeight * aspect;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  }
}
