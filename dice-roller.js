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

function generatedThrow() {
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    randomBetween(-Math.PI, Math.PI),
    randomBetween(-Math.PI, Math.PI),
    randomBetween(-Math.PI, Math.PI),
  )).normalize();
  return {
    position: [randomBetween(-1.7, 1.7), randomBetween(4.8, 6.1), randomBetween(-0.8, 0.8)],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
    velocity: [randomBetween(-2.5, 2.5), randomBetween(-1.2, 0.2), randomBetween(-1.3, 1.3)],
    angularVelocity: [randomBetween(-13, 13), randomBetween(-13, 13), randomBetween(-13, 13)],
  };
}

function numberTexture(value, accent = "#8deaff") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, 256, 256);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "900 132px Arial, sans-serif";
  context.lineWidth = 22;
  context.strokeStyle = "rgba(2, 8, 15, .96)";
  context.strokeText(String(value), 128, 132);
  context.fillStyle = accent;
  context.shadowColor = accent;
  context.shadowBlur = 18;
  context.fillText(String(value), 128, 132);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function faceLabel(value, normal, position, size = 0.72) {
  const material = new THREE.MeshBasicMaterial({
    map: numberTexture(value),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.position.copy(position).addScaledVector(normal, 0.035);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  return mesh;
}

function d6Visual() {
  const group = new THREE.Group();
  const die = new THREE.Mesh(
    new THREE.BoxGeometry(2.15, 2.15, 2.15, 2, 2, 2),
    new THREE.MeshPhysicalMaterial({
      color: 0x162d42,
      metalness: 0.34,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.13,
      emissive: 0x071728,
      emissiveIntensity: 0.72,
    }),
  );
  group.add(die);

  const faces = [
    { value: 1, normal: new THREE.Vector3(1, 0, 0) },
    { value: 6, normal: new THREE.Vector3(-1, 0, 0) },
    { value: 2, normal: new THREE.Vector3(0, 1, 0) },
    { value: 5, normal: new THREE.Vector3(0, -1, 0) },
    { value: 3, normal: new THREE.Vector3(0, 0, 1) },
    { value: 4, normal: new THREE.Vector3(0, 0, -1) },
  ];
  for (const face of faces) {
    group.add(faceLabel(face.value, face.normal, face.normal.clone().multiplyScalar(1.09), 0.86));
  }
  return {
    group,
    normals: faces,
    shape: new CANNON.Box(new CANNON.Vec3(1.075, 1.075, 1.075)),
  };
}

function orientFace(indices, vertices) {
  const a = vertices[indices[0]];
  const b = vertices[indices[1]];
  const c = vertices[indices[2]];
  const ab = new THREE.Vector3().subVectors(b, a);
  const ac = new THREE.Vector3().subVectors(c, a);
  const normal = new THREE.Vector3().crossVectors(ab, ac);
  const center = indices.reduce((sum, index) => sum.add(vertices[index]), new THREE.Vector3()).multiplyScalar(1 / indices.length);
  if (normal.dot(center) < 0) return [...indices].reverse();
  return indices;
}

function d10Definition() {
  const radius = 1.45;
  const height = 1.62;
  const ringY = height * (1 - Math.cos(Math.PI / 5)) / (3 - Math.cos(Math.PI / 5));
  const vertices = [
    new THREE.Vector3(0, height, 0),
    new THREE.Vector3(0, -height, 0),
  ];
  for (let index = 0; index < 10; index += 1) {
    const angle = Math.PI * 2 * index / 10;
    vertices.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      index % 2 === 0 ? ringY : -ringY,
      Math.sin(angle) * radius,
    ));
  }

  const faces = [];
  for (let index = 0; index < 10; index += 2) {
    faces.push(orientFace([0, 2 + index, 2 + (index + 1) % 10, 2 + (index + 2) % 10], vertices));
  }
  for (let index = 1; index < 10; index += 2) {
    faces.push(orientFace([1, 2 + index, 2 + (index + 1) % 10, 2 + (index + 2) % 10], vertices));
  }
  return { vertices, faces };
}

function d10Visual() {
  const { vertices, faces } = d10Definition();
  const group = new THREE.Group();
  const normals = [];

  faces.forEach((face, index) => {
    const points = face.map((vertexIndex) => vertices[vertexIndex]);
    const geometry = new THREE.BufferGeometry();
    const positions = [
      ...points[0].toArray(), ...points[1].toArray(), ...points[2].toArray(),
      ...points[0].toArray(), ...points[2].toArray(), ...points[3].toArray(),
    ];
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshPhysicalMaterial({
      color: index % 2 ? 0x13263b : 0x1b3550,
      metalness: 0.4,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      emissive: index % 2 ? 0x07111e : 0x081a2a,
      emissiveIntensity: 0.7,
      side: THREE.DoubleSide,
    });
    group.add(new THREE.Mesh(geometry, material));

    const edgeGeometry = new THREE.BufferGeometry().setFromPoints([...points, points[0]]);
    group.add(new THREE.Line(edgeGeometry, new THREE.LineBasicMaterial({ color: 0x5ccdec })));

    const normal = new THREE.Vector3()
      .crossVectors(
        new THREE.Vector3().subVectors(points[1], points[0]),
        new THREE.Vector3().subVectors(points[2], points[0]),
      )
      .normalize();
    const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(0.25);
    const value = index + 1;
    normals.push({ value, normal });
    group.add(faceLabel(value === 10 ? 0 : value, normal, center, 0.62));
  });

  const cannonVertices = vertices.map((vertex) => new CANNON.Vec3(vertex.x, vertex.y, vertex.z));
  const shape = new CANNON.ConvexPolyhedron({ vertices: cannonVertices, faces });
  return { group, normals, shape };
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

export class PhysicalDiceRoller {
  constructor(elements) {
    this.shell = elements.shell;
    this.stage = elements.stage;
    this.title = elements.title;
    this.subtitle = elements.subtitle;
    this.result = elements.result;
    this.actions = elements.actions;
    this.canvasHost = elements.canvasHost;
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

  async roll({ sides, title, subtitle, config, onConfig, onSettled }) {
    this.stop();
    this.shell.hidden = false;
    this.shell.classList.remove("celebrating");
    this.title.textContent = title;
    this.subtitle.textContent = subtitle;
    this.result.textContent = "";
    this.result.hidden = true;
    this.actions.innerHTML = "";

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.camera.position.set(0, 6.7, 9.4);
    this.camera.lookAt(0, 0.8, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvasHost.replaceChildren(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xbceeff, 0x07101a, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 4.2);
    key.position.set(-4, 8, 5);
    key.castShadow = true;
    this.scene.add(key);
    const rim = new THREE.PointLight(0x24d9ff, 14, 20);
    rim.position.set(4, 4, -3);
    this.scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 8),
      new THREE.MeshPhysicalMaterial({
        color: 0x07111d,
        metalness: 0.55,
        roughness: 0.28,
        transparent: true,
        opacity: 0.88,
        clearcoat: 0.8,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -18, 0) });
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.friction = 0.31;
    this.world.defaultContactMaterial.restitution = 0.34;

    const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(floorBody);
    this.addWalls();

    const die = sides === 10 ? d10Visual() : d6Visual();
    die.group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this.scene.add(die.group);

    const body = new CANNON.Body({
      mass: 1,
      shape: die.shape,
      linearDamping: 0.16,
      angularDamping: 0.13,
      sleepSpeedLimit: 0.1,
      sleepTimeLimit: 0.5,
    });
    const throwConfig = config || generatedThrow();
    body.position.set(...throwConfig.position);
    body.quaternion.set(...throwConfig.quaternion);
    body.velocity.set(...throwConfig.velocity);
    body.angularVelocity.set(...throwConfig.angularVelocity);
    this.world.addBody(body);
    onConfig?.(throwConfig);

    this.active = { body, die, sides, onSettled, resolved: false };
    this.startedAt = performance.now();
    this.settleStart = 0;
    this.lastTime = performance.now();
    this.resizeObserver.observe(this.canvasHost);
    this.resize();
    this.frame = requestAnimationFrame((time) => this.tick(time));
  }

  addWalls() {
    const walls = [
      { half: [5.4, 2.2, 0.18], position: [0, 2.1, -3.8] },
      { half: [5.4, 2.2, 0.18], position: [0, 2.1, 3.8] },
      { half: [0.18, 2.2, 3.8], position: [-5.4, 2.1, 0] },
      { half: [0.18, 2.2, 3.8], position: [5.4, 2.1, 0] },
    ];
    for (const wall of walls) {
      const body = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(...wall.half)),
      });
      body.position.set(...wall.position);
      this.world.addBody(body);
    }
  }

  tick(time) {
    if (!this.active) return;
    const elapsed = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;
    this.world.step(1 / 60, elapsed, 4);
    const { body, die } = this.active;
    die.group.position.copy(body.position);
    die.group.quaternion.copy(body.quaternion);
    this.renderer.render(this.scene, this.camera);

    const slow = body.velocity.length() < 0.13 && body.angularVelocity.length() < 0.18;
    if (slow && time - this.startedAt > 900) {
      if (!this.settleStart) this.settleStart = time;
      if (time - this.settleStart > 520) this.resolve();
    } else {
      this.settleStart = 0;
    }
    if (time - this.startedAt > 8000) this.resolve();
    if (this.active) this.frame = requestAnimationFrame((nextTime) => this.tick(nextTime));
  }

  resolve() {
    if (!this.active || this.active.resolved) return;
    this.active.resolved = true;
    const quaternion = new THREE.Quaternion(
      this.active.body.quaternion.x,
      this.active.body.quaternion.y,
      this.active.body.quaternion.z,
      this.active.body.quaternion.w,
    );
    let best = this.active.die.normals[0];
    let bestDot = -Infinity;
    for (const face of this.active.die.normals) {
      const worldNormal = face.normal.clone().applyQuaternion(quaternion);
      const dot = worldNormal.dot(UP);
      if (dot > bestDot) {
        best = face;
        bestDot = dot;
      }
    }
    this.active.body.type = CANNON.Body.STATIC;
    this.active.body.velocity.setZero();
    this.active.body.angularVelocity.setZero();
    this.result.textContent = this.active.sides === 10 && best.value === 10 ? "0" : String(best.value);
    this.result.hidden = false;
    this.result.classList.remove("result-pop");
    requestAnimationFrame(() => this.result.classList.add("result-pop"));
    this.active.onSettled?.(best.value);
  }

  showPersistedResult({ title, subtitle, result }) {
    this.stop();
    this.shell.hidden = false;
    this.shell.classList.remove("celebrating");
    this.title.textContent = title;
    this.subtitle.textContent = subtitle;
    this.canvasHost.replaceChildren();
    this.result.textContent = String(result);
    this.result.hidden = false;
    this.result.classList.add("result-pop");
    this.actions.innerHTML = "";
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
  }

  reroll(options) {
    this.roll(options);
  }

  celebrate(duration = 1000) {
    if (!this.active) return Promise.resolve();
    if (this.active.body) this.active.body.collisionResponse = false;
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
    if (this.active?.die?.group) disposeObject(this.active.die.group);
    this.renderer?.dispose?.();
    this.canvasHost?.replaceChildren();
    this.active = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.world = null;
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const width = Math.max(280, this.canvasHost.clientWidth);
    const height = Math.max(280, this.canvasHost.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
