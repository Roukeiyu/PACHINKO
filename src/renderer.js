import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createRenderer as createCanvasRenderer } from './renderer-2d.js';
import { TABLE } from './physics.js';
import { SLOT_DISPLAY } from './slot-machine.js';
import { chargeEffectsAt } from './charge.js';
import { sceneMotionAt } from './scene-motion.js';

const W = TABLE.width, H = TABLE.height;
const world = (x, y, z = 0) => new THREE.Vector3(x - W / 2, H / 2 - y, z);

// The simulation remains on the tabletop. Every solid is built from the same
// Matter body, then follows its position, angle and size without a second world.
// A canvas cannot change from 2D to WebGL once its context is claimed. Replace
// only that drawing surface, keeping the renderer facade and simulation alive.
export function createRenderer(initialCanvas) {
  let canvas = initialCanvas, renderer = createCanvasRenderer(canvas), threeD = false, available = true;
  canvas.dataset.renderer = '2d';
  const replaceCanvas = () => {
    const fresh = canvas.cloneNode(false); canvas.replaceWith(fresh); canvas = fresh;
  };
  function setMode(enabled) {
    const requested = enabled === true && available;
    if (requested === threeD) return threeD ? 'webgl' : '2d';
    renderer.dispose(); replaceCanvas();
    if (requested) {
      try { renderer = create3DRenderer(canvas); threeD = true; }
      catch {
        available = false; threeD = false; replaceCanvas();
        renderer = createCanvasRenderer(canvas); canvas.dataset.renderer = '2d';
      }
    } else {
      renderer = createCanvasRenderer(canvas); canvas.dataset.renderer = '2d'; threeD = false;
    }
    return threeD ? 'webgl' : '2d';
  }
  return {
    setMode, draw(...args) { setMode(args[2].render3D); renderer.draw(...args); },
    project: (...args) => renderer.project(...args), resize: () => renderer.resize(),
    snapshot: () => ({ ...renderer.snapshot(), threeDAvailable: available }), dispose: () => renderer.dispose(),
  };
}
function create3DRenderer(canvas) {
  const context = canvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  if (!context) throw new Error('WebGL unavailable');
  const webgl = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false, preserveDrawingBuffer: true });
  canvas.dataset.renderer = 'webgl';
  webgl.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  webgl.outputColorSpace = THREE.SRGBColorSpace;
  webgl.toneMapping = THREE.NeutralToneMapping;
  webgl.toneMappingExposure = 1;
  webgl.shadowMap.enabled = true;
  webgl.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), table = new THREE.Group(); scene.add(table);
  const camera = new THREE.OrthographicCamera(-(W + 10) / 2, (W + 10) / 2, (H + 12) / 2, -(H + 12) / 2, .1, 3000);
  let motion = sceneMotionAt(0, {}, {}), currentGame, currentTheme, currentPalette, lastAtlas = -Infinity;
  const keyLight = new THREE.DirectionalLight('#ffffff', 1.35);
  keyLight.position.set(-360, 400, 650); keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  Object.assign(keyLight.shadow.camera, { left: -500, right: 500, top: 570, bottom: -570, near: 20, far: 1500 });
  keyLight.shadow.bias = -.00015; keyLight.shadow.normalBias = 1.5; keyLight.shadow.radius = 3;
  scene.add(keyLight, new THREE.HemisphereLight('#ffffff', '#9c91a7', .7));
  const fill = new THREE.DirectionalLight('#d6e8ff', .3); fill.position.set(350, -250, 450); scene.add(fill);
  const pmrem = new THREE.PMREMGenerator(webgl), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04); scene.environment = environment.texture; room.dispose(); pmrem.dispose();

  // Existing lettering, theme art and every reward animation form a live decal
  // atlas. Model top faces sample it in tabletop coordinates, including moving
  // rails and growing drums. The solids and balls are actual lit geometry.
  const atlasCanvas = document.createElement('canvas');
  const painter = createCanvasRenderer(atlasCanvas, { textureMode: true });
  const atlas = new THREE.CanvasTexture(atlasCanvas); atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.generateMipmaps = false; atlas.minFilter = THREE.LinearFilter;
  const boardInverse = { value: new THREE.Matrix4() };
  const cap = new THREE.MeshStandardMaterial({ color: '#bcbcbc', map: atlas, roughness: .8, metalness: .02, envMapIntensity: .12 });
  cap.onBeforeCompile = shader => {
    shader.uniforms.boardInverse = boardInverse;
    shader.vertexShader = 'uniform mat4 boardInverse;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      vec4 boardPosition = boardInverse * modelMatrix * vec4(transformed, 1.0);
      vMapUv = vec2(boardPosition.x / ${W.toFixed(1)} + 0.5, boardPosition.y / ${H.toFixed(1)} + 0.5);`);
  };
  cap.customProgramCacheKey = () => 'ponpon-tabletop-atlas';
  const colored = [], bodies = new Map(), balls = new Map(), layoutModels = [];
  function material(color, role = 'object', extra = {}) {
    const value = new THREE.MeshStandardMaterial({ color, roughness: .48, metalness: .12, envMapIntensity: .3, ...extra });
    colored.push({ value, color, role }); return value;
  }
  const wallSide = material('#829d78'), railSide = material('#c7798e'), pinSide = material('#8ca37c');
  const drumSide = material('#c7798e'), goldSide = material('#b49a65'), purpleSide = material('#9981b2');
  const spinnerSide = material('#779d83'), floorSide = material('#b6bea5'), darkSide = material('#405c59', 'object', { side: THREE.DoubleSide });
  function roundedShape(width, height, radius) {
    const x = -width / 2, y = -height / 2, s = new THREE.Shape();
    s.moveTo(x + radius, y); s.lineTo(x + width - radius, y); s.quadraticCurveTo(x + width, y, x + width, y + radius);
    s.lineTo(x + width, y + height - radius); s.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    s.lineTo(x + radius, y + height); s.quadraticCurveTo(x, y + height, x, y + height - radius);
    s.lineTo(x, y + radius); s.quadraticCurveTo(x, y, x + radius, y); return s;
  }
  function extrude(shape, height, side, bevel = 1) {
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 20, steps: 1 });
    const mesh = new THREE.Mesh(geometry, [cap, side]); mesh.castShadow = true; mesh.receiveShadow = true; table.add(mesh); return mesh;
  }
  function box(x, y, width, height, depth, side, z = 0, radius = 4) {
    const mesh = extrude(roundedShape(width, height, radius), depth, side, .8); mesh.position.copy(world(x, y, z)); return mesh;
  }
  function disc(x, y, radius, depth, side, z = 0) {
    const shape = new THREE.Shape(); shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
    const mesh = extrude(shape, depth, side, 1.1); mesh.position.copy(world(x, y, z)); return mesh;
  }
  const slab = box(W / 2, H / 2, W - 6, H - 6, 16, floorSide, -16, 22); slab.castShadow = false;
  function bodyModel(body, side, height, radius) {
    let mesh;
    if (radius) mesh = disc(body.position.x, body.position.y, radius, height, side);
    else {
      const shape = new THREE.Shape(), c = Math.cos(body.angle), s = Math.sin(body.angle);
      body.vertices.forEach((vertex, i) => {
        const dx = vertex.x - body.position.x, dy = vertex.y - body.position.y;
        const x = dx * c + dy * s, y = dx * s - dy * c;
        if (i) shape.lineTo(x, y); else shape.moveTo(x, y);
      }); shape.closePath(); mesh = extrude(shape, height, side, .8);
    }
    mesh.userData.bodyId = body.id; mesh.userData.baseRadius = body.plugin.baseRadius;
    bodies.set(body.id, { body, mesh, height }); return mesh;
  }
  const wells = [];
  function makeWell(x, y, storage) {
    const profile = [[0, 2], [7, 2.2], [13, 3.5], [18, 6], [21, 9]].map(([r, z]) => new THREE.Vector2(r, z));
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), darkSide);
    mesh.rotation.x = Math.PI / 2; mesh.position.copy(world(x, y)); mesh.receiveShadow = true; table.add(mesh);
    const label = document.createElement('canvas'); label.width = 128; label.height = 64;
    const texture = new THREE.CanvasTexture(label); texture.colorSpace = THREE.SRGBColorSpace;
    const text = new THREE.Mesh(new THREE.PlaneGeometry(34, 17), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
    text.position.copy(world(x, y, 9.5)); table.add(text); wells.push({ storage, label, texture, text, last: '' });
  }
  function setup(game) {
    for (const b of game.walls) bodyModel(b, wallSide, 28);
    for (const b of game.pins) bodyModel(b, pinSide, 18, b.plugin.radius || 7.5);
    for (const b of game.bumpers) bodyModel(b, drumSide, 32, b.plugin.baseRadius + 6);
    for (const b of game.kickers) bodyModel(b, drumSide, 16, 13);
    for (const b of game.rails) bodyModel(b, railSide, 20);
    for (const b of game.diamonds) bodyModel(b, purpleSide, 13);
    for (const b of game.spinners) bodyModel(b, spinnerSide, 12);
    for (const b of game.deflectors) bodyModel(b, railSide, 15);
    for (const b of game.guards) { const mesh = bodyModel(b, b.plugin.storage ? purpleSide : goldSide, 10); mesh.castShadow = mesh.receiveShadow = false; }
    // The ascending door is invisible, just as its original one-way guide was.
    bodyModel(game.gates[1], goldSide, 7);
    for (const h of game.holes) makeWell(h.x, h.y, false);
    makeWell(game.collector.x, game.collector.y, true);
    // Recess the painted reel assembly so moving balls can cross its display.
    box(SLOT_DISPLAY.x, SLOT_DISPLAY.y, SLOT_DISPLAY.width, SLOT_DISPLAY.height, 3, goldSide, -1, 8);
    for (const spinner of game.spinners) disc(spinner.position.x, spinner.position.y, 15, 5, goldSide, 12);
  }
  let slotCount = 0;
  function updateLayout(game) {
    if (slotCount === game.slots) return;
    for (const mesh of layoutModels.splice(0)) { table.remove(mesh); mesh.geometry.dispose(); }
    for (const [id, entry] of bodies) if (entry.body.label === 'divider') { table.remove(entry.mesh); entry.mesh.geometry.dispose(); bodies.delete(id); }
    slotCount = game.slots; const width = (TABLE.right - TABLE.left) / slotCount;
    for (let i = 0; i < slotCount; i++) layoutModels.push(box(TABLE.left + (i + .5) * width, TABLE.slotTop + 43, width - 6, 84, 3, goldSide, -.5, 10));
    for (const outlet of game.collector.outlets) layoutModels.push(box(outlet.x, outlet.y, 52, 17, 7, purpleSide, 0, 6));
    for (const b of game.dividers) bodyModel(b, goldSide, 9);
  }
  const sphere = new THREE.SphereGeometry(11, 24, 16);
  const ballMaterial = new THREE.MeshStandardMaterial({ color: '#ffedb0', metalness: .6, roughness: .2, envMapIntensity: 1.4 });
  const readyBall = new THREE.Mesh(sphere, ballMaterial); readyBall.castShadow = true; table.add(readyBall);
  const springPoints = Array.from({ length: 193 }, (_, i) => { const t = i / 192, a = t * Math.PI * 12; return new THREE.Vector3(Math.cos(a) * 9, t * 52, 9 + Math.sin(a) * 5); });
  const spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPoints), 192, 1.7, 6, false), material('#a4ac93', 'object', { metalness: .7, roughness: .3 }));
  spring.position.copy(world(TABLE.launchX, 865)); spring.castShadow = true; table.add(spring);
  const springPlate = box(TABLE.launchX, 811, 36, 8, 5, wallSide, 5, 3);
  const chargeCanvas = document.createElement('canvas'); chargeCanvas.width = chargeCanvas.height = 160;
  const chargeCtx = chargeCanvas.getContext('2d'), chargeTexture = new THREE.CanvasTexture(chargeCanvas); chargeTexture.colorSpace = THREE.SRGBColorSpace;
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshBasicMaterial({ map: chargeTexture, transparent: true, depthWrite: false, toneMapped: false }));
  corona.renderOrder = 2; table.add(corona);
  function paintCharge(state) {
    const ctx = chargeCtx, glow = chargeEffectsAt(state.chargeElapsed); ctx.clearRect(0, 0, 160, 160);
    if (glow.goldRadius) {
      ctx.globalAlpha = glow.goldAlpha * .6; ctx.strokeStyle = '#edc674'; ctx.lineWidth = 1.7; ctx.shadowColor = '#f8d78a'; ctx.shadowBlur = state.calm ? 0 : 8;
      ctx.beginPath(); ctx.arc(80, 80, state.calm ? 16 : glow.goldRadius, 0, Math.PI * 2); ctx.stroke();
    }
    if (glow.coronaRadius) {
      const radius = state.calm ? 25 : glow.coronaRadius, hues = ['#ffbbba', '#ffe8ad', '#c7efbf', '#aae8e8', '#bdcaff', '#e9b7f1'];
      ctx.shadowBlur = 0; ctx.globalAlpha = state.calm ? .22 : glow.coronaAlpha;
      for (let i = 0; i < 24; i++) {
        const angle = i * Math.PI / 12 + (state.calm ? 0 : state.chargeElapsed / 9000), outer = radius * (i % 2 ? .78 : 1);
        const gradient = ctx.createRadialGradient(80, 80, 5, 80, 80, outer);
        gradient.addColorStop(0, '#fffdf5'); gradient.addColorStop(.25, hues[i % 6]); gradient.addColorStop(1, hues[i % 6] + '00');
        ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(80, 80); ctx.arc(80, 80, outer, angle - .18, angle + .18); ctx.fill();
      }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0; chargeTexture.needsUpdate = true;
  }
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 5 : 11; if (i) starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r); else starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  starShape.closePath(); const collectible = extrude(starShape, 5, goldSide, .7);
  // Keep the table fixed; shake translates the camera parallel to its view.
  const pitch = THREE.MathUtils.degToRad(14);
  const cameraBase = new THREE.Vector3(0, -Math.sin(pitch) * 1400, Math.cos(pitch) * 1400);
  camera.position.copy(cameraBase);
  camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const project = (x, y, z = 0) => { const p = world(x, y, z).applyMatrix4(table.matrixWorld).project(camera); return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 }; };
  function resize() { const width = canvas.getBoundingClientRect().width; if (width) webgl.setSize(width, width * H / W, false); }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  let paintedState = '';
  function draw(game, theme, state, fx, palette = null) {
    if (!currentGame) { setup(game); currentGame = game; }
    updateLayout(game);
    const paletteChanged = currentPalette !== palette || currentTheme !== theme;
    if (paletteChanged) {
      currentPalette = palette; currentTheme = theme;
      colored.forEach(({ value, color, role }) => value.color.set(palette?.color(color, role) ?? color));
      [railSide, drumSide].forEach(m => m.color.set(palette?.color(theme.accent) ?? theme.accent));
      pinSide.color.set(palette?.color(theme.pin) ?? theme.pin);
      scene.background = new THREE.Color(palette?.color(theme.bg, 'surface') ?? theme.bg);
    }
    const now = performance.now(), paintState = `${state.slots}:${state.charging}:${state.theme}:${state.calm}`;
    if (paletteChanged || now - lastAtlas >= 1000 / 30 || paintState !== paintedState) {
      painter.draw(game, theme, state, fx, palette); atlas.needsUpdate = true; lastAtlas = now; paintedState = paintState;
    }
    for (const { body, mesh } of bodies.values()) {
      mesh.position.copy(world(body.position.x, body.position.y)); mesh.rotation.z = -body.angle;
      if (mesh.userData.baseRadius) { const scale = (body.plugin.radius + 6) / (mesh.userData.baseRadius + 6); mesh.scale.set(scale, scale, 1); }
    }
    for (const well of wells) {
      const value = well.storage ? `${game.collector.stored.length}/20` : '★';
      if (well.last !== value) {
        const ctx = well.label.getContext('2d'); ctx.clearRect(0, 0, 128, 64); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = well.storage ? 'bold 38px sans-serif' : '52px sans-serif'; ctx.fillStyle = well.storage ? '#fff9e9' : '#f5d97e';
        ctx.fillText(value, 64, 34); well.texture.needsUpdate = true; well.last = value;
      }
    }
    const activeIds = new Set(game.balls.map(b => b.id));
    for (const [id, mesh] of balls) if (!activeIds.has(id)) { table.remove(mesh); balls.delete(id); }
    for (const ball of game.balls) {
      let mesh = balls.get(ball.id);
      if (!mesh) { mesh = new THREE.Mesh(sphere, ballMaterial); mesh.castShadow = true; table.add(mesh); balls.set(ball.id, mesh); }
      mesh.position.copy(world(ball.body.position.x, ball.body.position.y, 12));
      mesh.rotation.set(ball.body.position.y / 11, ball.body.position.x / 11, ball.body.angle);
    }
    const compression = state.charging ? state.charge * 22 : 0;
    readyBall.position.copy(world(TABLE.launchX, TABLE.launchY + compression, 12));
    readyBall.visible = !game.balls.some(b => b.body.position.x > 683 && b.body.position.y > 730);
    spring.scale.y = (52 - compression) / 52; springPlate.position.copy(world(TABLE.launchX, 811 + compression, 5));
    corona.visible = state.charging && readyBall.visible;
    if (corona.visible) { paintCharge(state); corona.position.copy(world(TABLE.launchX, TABLE.launchY + compression, 24)); }
    collectible.visible = !!game.star;
    if (game.star) { collectible.position.copy(world(game.star.x, game.star.y, 5)); const pulse = state.calm ? 1 : 1 + Math.sin(game.clock / 250) * .09; collectible.scale.setScalar(pulse); }
    motion = sceneMotionAt(game.clock, state, fx);
    const cameraOffset = new THREE.Vector3(-motion.x, motion.y * Math.cos(pitch), motion.y * Math.sin(pitch));
    camera.position.copy(cameraBase).add(cameraOffset);
    camera.up.set(0, 1, 0); camera.lookAt(cameraOffset);
    camera.updateMatrixWorld();
    table.updateMatrixWorld(true); boardInverse.value.copy(table.matrixWorld).invert();
    webgl.render(scene, camera);
  }
  function snapshot() {
    return { mode: 'webgl', cameraAngle: 0, tableTransform: { position: table.position.toArray(), rotation: table.rotation.toArray().slice(0,3) }, cameraPosition: camera.position.toArray(), cameraQuaternion: camera.quaternion.toArray(), motion: { ...motion }, pitch: 14, meshes: bodies.size, triangles: webgl.info.render.triangles, contextLost: webgl.getContext().isContextLost(),
      bodies: [...bodies.values()].map(({ body, mesh, height }) => ({ id: body.id, kind: body.label, x: mesh.position.x + W / 2, y: H / 2 - mesh.position.y, angle: -mesh.rotation.z, radius: body.plugin.radius, height, scale: mesh.scale.x, projected: project(body.position.x, body.position.y, height) })),
      balls: [...balls].map(([id, mesh]) => ({ id, x: mesh.position.x + W / 2, y: H / 2 - mesh.position.y, z: mesh.position.z })),
      samples: [[70,200,.8],[23,280,28.8],[150,155,18.8],[350,367,32.8],[350,465,2.8],[615,482,2]].map(([x,y,z]) => project(x,y,z)), readyBall: project(TABLE.launchX, TABLE.launchY, 12), textures: webgl.info.memory.textures, geometries: webgl.info.memory.geometries, alignmentError: Math.max(0, ...[...bodies.values()].map(({body, mesh}) => Math.hypot(mesh.position.x - (body.position.x - W / 2), mesh.position.y - (H / 2 - body.position.y)))) };
  }
  return { draw, resize, project, snapshot, dispose() {
    observer.disconnect(); painter.dispose(); atlas.dispose(); chargeTexture.dispose(); environment.dispose(); wells.forEach(w => w.texture.dispose());
    const geometries = new Set(), materials = new Set(); scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); webgl.dispose(); webgl.forceContextLoss();
  } };
}
