// ─────────────────────────────────────────────────────────────
// 11 책 캐러셀 — 종이 카드가 책처럼 가로 한 줄로 서 있고, 휠로 한 장씩 넘기고, 누르면 커지며 오른쪽에 정보가 나온다.
// 레퍼: Bookish (Framer 템플릿, boookish.framer.website) — 3D 책장 컴포넌트의 기본값과 사이트가 넘긴 값을 읽어 숫자만 옮김.
//   코드는 가져오지 않았다. 틀(왼쪽 띠·버튼·정보·상세·소개 패널)은 shared/bookish-frame.css
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { createStage, showWebGLFallback, readToken } from '../../shared/stage.js?v=6';
import { createCardMaterial, syncMaterial, setCornerRadius } from '../../shared/card-material.js?v=8';
import { createCardInstances } from '../../shared/card-geometry.js?v=3';
import { prefersReducedMotion } from '../../shared/motion.js?v=3';
import { DEFAULT_PRESET, presetToParams } from '../../shared/texture-presets.js?v=1';
import { createPanel, addSettingsButtons } from '../../shared/panel.js?v=2';
import { addTextureFolder } from '../../shared/texture-panel.js?v=6';
import {
  SHELF, FORMATS, fovFor, followFactor, wrapOffset, cardPose, edgeFade, easeInOutCubic, easeOutCubic,
  entrancePose, wheelStep, orbitPosition, START_PHI, fitDetail,
  shapeOf, layoutRow, rowUnit, rowIndexAt, rowPositionOf, rowSnapTarget, rowCenterIndex,
} from './shelf.js?v=6';
import { CARDS } from './cards-data.js?v=2';

const CORNER_RADIUS = 0;     // 레퍼 책처럼 모서리 뾰족하게가 기본 (사용자 요청). 질감 패널에서 둥글게 바꿀 수 있다
const NARROW = window.matchMedia('(max-width: 809px)'); // 레퍼(Framer) 폰 크기
// 상세를 위아래(카드 위 · 글 아래)로: 폰, 그리고 810~1199px(태블릿)는 세로로 들었을 때 (사용자 선택 "폰 + 세로 태블릿")
const STACK = window.matchMedia('(max-width: 809px), (max-width: 1199px) and (orientation: portrait)');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pad = (n) => String(n).padStart(2, '0');

function main() {
  const page = document.getElementById('bk-page');
  const stageEl = document.getElementById('bk-stage');
  const canvas = document.getElementById('stage-canvas');
  let stage;
  try {
    stage = createStage({ canvas, fov: fovFor(1.6) });
  } catch (error) {
    console.warn('WebGL 초기화 실패', error);
    showWebGLFallback(canvas);
    return;
  }
  stage.scene.background = new THREE.Color(readToken('--bk-stage'));
  const reduced = prefersReducedMotion();

  // ── 기본값 ──────────────────────────────────────────────────
  const paper = readToken('--card-paper');
  const DEFAULTS = {
    ...presetToParams(DEFAULT_PRESET, paper),
    corner: CORNER_RADIUS,              // 모서리 둥글기 (질감 패널에서 조절)
    format: 'portrait',                 // 카드 모양: 세로형(기본) / 가로형 16:9 / 섞어서(카드마다, cards-data의 shape)
    gap: SHELF.gap,                     // 카드 사이 틈 (모양이 섞여도 같게) → 세로형 간격 3.4, 가로형 5.6
    narrowDetail: 'stack',              // 폰에서 누르면: 카드 위 · 글 아래(기본, 사용자 요청) / 레퍼대로(글 위, 카드는 오른쪽 아래로 가서 잘림)
  };
  const params = structuredClone(DEFAULTS);

  // ── 카드 ────────────────────────────────────────────────────
  // 모양마다 카드 묶음 하나 (둥근 모서리 계산이 카드 크기를 알아야 해서 재질도 모양마다 하나)
  const materials = {};
  for (const [shape, size] of Object.entries(FORMATS)) {
    materials[shape] = createCardMaterial({ cardWidth: size.width, cardHeight: size.height, cornerRadius: CORNER_RADIUS });
  }
  function syncMaterials() {
    for (const m of Object.values(materials)) {
      syncMaterial(m, params);
      setCornerRadius(m, params.corner);
    }
  }
  syncMaterials();
  let groups = [];   // [{ cards, members: [카드 번호…] }] 모양별 묶음
  let slots = [];    // 카드 번호 → { cards, instance } 그 카드가 들어 있는 묶음과 자리
  let shapes = [];   // 카드 번호 → 'portrait' | 'landscape'
  let row = null;    // 줄: 카드 가운데 자리·틈·한 바퀴 길이 (layoutRow)
  // 카드마다 천천히 따라가는 값: 상세로 갈 때의 추가 이동·회전, 크기, 밝기
  const poses = CARDS.map(() => ({ offX: 0, offY: 0, offZ: 0, turn: 0, scale: 1, shade: 1 }));
  function buildRow() {
    row = layoutRow(shapes.map((shape) => FORMATS[shape].width), params.gap);
  }
  function buildCards() {
    for (const group of groups) {
      stage.scene.remove(group.cards.mesh);
      group.cards.dispose();
    }
    shapes = CARDS.map((card) => shapeOf(params.format, card));
    groups = [];
    slots = [];
    for (const [shape, size] of Object.entries(FORMATS)) {
      const members = shapes.flatMap((s, i) => (s === shape ? [i] : []));
      if (members.length === 0) continue;
      const cards = createCardInstances({ count: members.length, width: size.width, height: size.height, bend: 0, material: materials[shape] });
      cards.mesh.userData.members = members; // 클릭 판정에서 묶음 자리 → 카드 번호
      stage.scene.add(cards.mesh);
      groups.push({ cards, members });
      members.forEach((cardIndex, instance) => { slots[cardIndex] = { cards, instance }; });
    }
    buildRow();
  }
  buildCards();

  // ── 상태 ────────────────────────────────────────────────────
  const state = {
    scrollTarget: 0,
    scrollCurrent: 0,
    snap: null,                 // { from, to, start, duration, ease } 한 장 넘어가는 중
    wheel: { acc: 0, last: -Infinity },
    drag: null,                 // { mode: 'card' | 'orbit', x, y, distance, card }
    selected: -1,               // 상세로 연 카드 (-1 = 없음)
    detailFit: null,            // 상세 카드 자리·크기 { x, y, scale } — 빈 칸 여백 안에 다 들어가게 (fitDetail)
    activeIndex: -1,            // 왼쪽 아래 정보에 보이는 카드
    entranceStart: performance.now() / 1000,
  };
  const orbit = {
    theta: 0, phi: START_PHI, radius: SHELF.camZ,
    thetaTarget: 0, phiTarget: START_PHI, radiusTarget: SHELF.camZ,
    savedRadius: SHELF.camZ,
    px: 0, py: 0, pxTarget: 0, pyTarget: 0, weight: 1,
  };
  const snapOn = () => !NARROW.matches; // 레퍼: 폰은 스냅 없이 부드럽게

  // 지금 가운데 카드를 지키면서 틈·모양을 바꾼다
  function keepCenter(apply) {
    const index = rowIndexAt(state.scrollCurrent, row);
    apply();
    state.snap = null;
    state.scrollTarget = rowPositionOf(index, row);
    state.scrollCurrent = state.scrollTarget;
  }

  // ── 글 (왼쪽 아래 정보·상세 패널) ─────────────────────────────
  const $ = (id) => document.getElementById(id);
  const meta = $('bk-meta');
  let metaTimer = 0;
  function fillMeta(i) {
    const card = CARDS[i];
    $('bk-meta-index').textContent = `${pad(i + 1)} / ${pad(CARDS.length)}`;
    $('bk-meta-title').textContent = card.title;
    $('bk-meta-author').textContent = card.name;
    $('bk-meta-year').textContent = card.year;
    $('bk-meta-category').textContent = card.category;
  }
  // 가운데 카드가 바뀌면 잠깐 흐려졌다가(0.15초) 새 글로 (레퍼 0.3초 전환)
  function showMeta(i, instant = false) {
    state.activeIndex = i;
    clearTimeout(metaTimer);
    if (instant) {
      fillMeta(i);
      return;
    }
    meta.classList.add('is-changing');
    metaTimer = setTimeout(() => {
      fillMeta(state.activeIndex);
      meta.classList.remove('is-changing');
    }, 150);
  }
  function fillDetail(i) {
    const card = CARDS[i];
    $('bk-detail-index').textContent = `${pad(i + 1)} / ${pad(CARDS.length)}`;
    $('bk-detail-title').textContent = card.title;
    $('bk-detail-year').textContent = card.year;
    $('bk-detail-category').textContent = card.category;
    $('bk-detail-blurb').textContent = card.blurb;
  }
  showMeta(0, true);

  function openDetail(i) {
    if (state.selected === i) return;
    if (state.selected < 0) orbit.savedRadius = orbit.radiusTarget;
    state.selected = i;
    fillDetail(i);
    page.classList.add('is-detail');
    stageEl.classList.remove('is-pointing');
    orbit.radiusTarget = SHELF.focusDistance; // 카메라가 14 → 8.4로 다가간다
    measureDetail();
  }
  // 상세 배치: 위아래(카드 위 · 글 아래)인지 — 폰 "레퍼대로"만 빼고 STACK 크기면 위아래
  const stacked = () => STACK.matches && !(NARROW.matches && params.narrowDetail === 'reference');
  function applyLayout() {
    page.classList.toggle('is-stack', stacked());
    measureDetail();
  }
  // 상세 카드가 들어갈 빈 칸을 재서 자리·크기를 정한다 (열 때·화면 크기·모양·배치가 바뀔 때) — 가로든 세로든 잘리지 않게
  //   위아래: 네온 버튼·조절 패널 제목줄 아래부터 글 위까지 빈 칸 한가운데
  //   좌우(넓은 화면): 오른쪽 상세 패널 왼쪽 빈 칸, 레퍼 자리(왼쪽 0.8·0.9배)가 들어가면 그대로
  //   폰 "레퍼대로": 재지 않음 → 레퍼 값 그대로 (오른쪽 아래, 잘림)
  function measureDetail() {
    if (state.selected < 0) return;
    const box = canvas.getBoundingClientRect();
    if (box.height === 0) return;
    const panel = $('bk-detail');
    let free;
    if (stacked()) {
      const guiTitle = document.querySelector('.lil-gui.card-panel > .title');
      const topPx = Math.max($('bk-about-btn').getBoundingClientRect().bottom, guiTitle ? guiTitle.getBoundingClientRect().bottom : 0);
      free = { left: 0, top: topPx - box.top, right: box.width, bottom: panel.offsetTop }; // offsetTop: 들어오는 움직임(transform) 빼고 잰 자리
    } else if (NARROW.matches) {
      state.detailFit = null;
      return;
    } else {
      free = { left: 0, top: 0, right: box.width - panel.offsetWidth, bottom: box.height };
    }
    const size = FORMATS[shapes[state.selected]];
    state.detailFit = fitDetail({
      free,
      canvasWidthPx: box.width,
      canvasHeightPx: box.height,
      fovDeg: fovFor(box.width / box.height),
      distance: SHELF.focusDistance,
      cardWidth: size.width,
      cardHeight: size.height,
      scale: SHELF.detailScale,
      want: stacked() ? null : SHELF.detailOffset,
    });
  }
  window.addEventListener('resize', applyLayout);
  document.fonts?.ready?.then(measureDetail); // 글꼴이 늦게 오면 글 높이가 바뀐다
  function closeDetail() {
    if (state.selected < 0) return;
    state.selected = -1;
    page.classList.remove('is-detail');
    orbit.radiusTarget = orbit.savedRadius;
  }
  function setAbout(open) {
    page.classList.toggle('is-about', open);
    $('bk-about-btn').setAttribute('aria-expanded', String(open));
  }

  // 한 장 넘기기 (0.5초 easeInOutCubic, 넘어가는 동안 잠금)
  function step(direction) {
    if (state.snap || state.selected >= 0) return;
    const to = rowSnapTarget(state.scrollTarget, row, direction);
    state.snap = { from: state.scrollCurrent, to, start: performance.now() / 1000, duration: SHELF.snapDuration, ease: easeInOutCubic };
    state.scrollTarget = to;
  }

  // ── 패널 ────────────────────────────────────────────────────
  const gui = createPanel('11 책 캐러셀 · 조절 패널');
  gui.close(); // 틀을 그대로 보이게 접어서 시작
  const shapeFolder = gui.addFolder('형태');
  shapeFolder.add(params, 'format', { '세로형': 'portrait', '가로형 16:9': 'landscape', '섞어서 (카드마다)': 'mixed' }).name('카드 모양').onChange(() => {
    keepCenter(buildCards);
    measureDetail();
  });
  shapeFolder.add(params, 'gap', 0.2, 4, 0.05).name('카드 사이 틈').onChange(() => keepCenter(buildRow));
  shapeFolder.add(params, 'narrowDetail', { '카드 위 · 글 아래': 'stack', '레퍼대로 (글 위 · 카드 오른쪽 아래)': 'reference' }).name('폰에서 누르면').onChange(applyLayout);
  addTextureFolder(gui, { params, material: materials.portrait, paperColor: paper });
  // 질감 폴더는 재질 하나만 맞춰 준다 → 값이 바뀔 때마다 나머지 모양 재질도 같이 (폴더의 처리가 끝난 뒤에)
  gui.onChange(() => queueMicrotask(syncMaterials));
  addSettingsButtons(gui, {
    params,
    defaults: DEFAULTS,
    onApply: () => {
      syncMaterials();
      keepCenter(buildCards);
      applyLayout();
    },
  });

  applyLayout(); // 처음 배치 (위아래인지)

  // ── 입력 ────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return -1;
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, stage.camera);
    const hit = raycaster.intersectObjects(groups.map((group) => group.cards.mesh), false)[0];
    return hit && hit.instanceId !== undefined ? hit.object.userData.members[hit.instanceId] : -1;
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (page.classList.contains('is-about')) return;
    try { canvas.setPointerCapture(event.pointerId); } catch { /* 무시 */ }
    const card = pick(event.clientX, event.clientY);
    // 카드 위에서 누르면 줄 밀기, 빈 곳(또는 상세 중)이면 시점 돌리기 (레퍼와 같음)
    state.drag = { mode: card >= 0 && state.selected < 0 ? 'card' : 'orbit', x: event.clientX, y: event.clientY, distance: 0, card };
  });
  window.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      orbit.pxTarget = clamp(nx, -1, 1) * SHELF.parallaxTheta;
      orbit.pyTarget = clamp(ny, -1, 1) * SHELF.parallaxPhi;
    }
    const drag = state.drag;
    if (!drag) {
      if (event.target === canvas) stageEl.classList.toggle('is-pointing', state.selected < 0 && pick(event.clientX, event.clientY) >= 0);
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.distance += Math.abs(dx) + Math.abs(dy);
    if (drag.mode === 'card') {
      state.snap = null;
      state.scrollTarget += dx * SHELF.dragSpeed;
      state.scrollCurrent = state.scrollTarget;
    } else {
      orbit.thetaTarget -= dx * SHELF.orbitSpeed;
      orbit.phiTarget = clamp(orbit.phiTarget - dy * SHELF.orbitSpeed, SHELF.phiMin, SHELF.phiMax);
    }
  });
  function endDrag() {
    const drag = state.drag;
    if (!drag) return;
    state.drag = null;
    const click = drag.distance < SHELF.clickThreshold;
    if (drag.mode === 'card' && !click && snapOn()) {
      // 끌다 놓으면 가장 가까운 장으로 (스냅 0.5초 × 0.4, easeOut)
      const to = rowSnapTarget(state.scrollTarget, row, 0);
      state.snap = { from: state.scrollCurrent, to, start: performance.now() / 1000, duration: Math.max(0.15, SHELF.releaseSnap), ease: easeOutCubic };
      state.scrollTarget = to;
    }
    if (click) {
      if (drag.card >= 0) openDetail(drag.card);
      else if (state.selected >= 0) closeDetail(); // 상세 중 빈 곳을 누르면 닫기
    }
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  window.addEventListener('wheel', (event) => {
    if (event.target.closest?.('.lil-gui, .bk-about, .bk-detail')) return; // 패널 안 스크롤은 그대로
    event.preventDefault();
    if (state.selected >= 0 || page.classList.contains('is-about')) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (snapOn()) {
      if (state.snap) return;
      const result = wheelStep(state.wheel, delta, performance.now());
      state.wheel = result.state;
      if (result.step) step(result.step);
      return;
    }
    state.scrollTarget -= delta * SHELF.wheelSpeed; // 폰: 스냅 없이
  }, { passive: false });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (state.selected >= 0) closeDetail();
      else setAbout(false);
      return;
    }
    if (state.selected >= 0) return;
    if (event.key === 'ArrowRight') step(1);
    if (event.key === 'ArrowLeft') step(-1);
  });
  $('bk-close').addEventListener('click', closeDetail);
  $('bk-about-btn').addEventListener('click', () => setAbout(!page.classList.contains('is-about')));

  // ── 매 프레임 ───────────────────────────────────────────────
  const dummy = new THREE.Object3D();
  const focus = { x: 0, y: 0, z: 0 };
  let lastTime = performance.now() / 1000;

  function frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - lastTime) || 1 / 60;
    lastTime = now;
    const count = CARDS.length;
    const total = row.total;

    // 1) 줄: 한 장 넘기는 중이면 곡선대로, 아니면 목표를 40%씩 따라간다
    if (state.snap) {
      const s = state.snap;
      const t = clamp((now - s.start) / s.duration, 0, 1);
      state.scrollCurrent = s.from + (s.to - s.from) * s.ease(t);
      state.scrollTarget = state.scrollCurrent;
      if (t >= 1) {
        state.scrollCurrent = s.to;
        state.scrollTarget = s.to;
        state.snap = null;
      }
    } else {
      state.scrollCurrent += (state.scrollTarget - state.scrollCurrent) * followFactor(SHELF.follow, dt);
    }

    // 2) 카드: 가운데까지 거리 r → 물러남·회전·크기·밝기, 상세면 고른 카드만 가운데로, 등장·화면 끝 사라짐
    const follow = followFactor(SHELF.cardFollow, dt);
    const entranceTime = reduced ? Infinity : now - state.entranceStart;
    const narrow = NARROW.matches;
    const listY = narrow ? SHELF.narrowListOffsetY : 0; // 폰: 줄을 1.2 위로
    // 상세 카드 자리: 잰 빈 칸 안 (넓은 화면은 패널 왼쪽, 폰 "가운데"는 글 아래).
    // 폰 "레퍼대로"만 레퍼 그대로 오른쪽 아래(1.45, −3.35) — 레퍼처럼 잘린다
    const fit = narrow && params.narrowDetail === 'reference' ? null : state.detailFit;
    let detailOffset = narrow ? SHELF.narrowDetailOffset : SHELF.detailOffset;
    if (fit) detailOffset = { x: fit.x, y: fit.y - listY };
    const detailScale = fit ? fit.scale : SHELF.detailScale;
    let nearest = 0;
    let nearestDistance = Infinity;
    for (let i = 0; i < count; i++) {
      const r = wrapOffset(row.centers[i] + state.scrollCurrent, total);
      const pose = cardPose(r, row.pitch, rowUnit(row, i, r));
      let offX = 0;
      let offY = 0;
      let offZ = 0;
      let turn = 0;
      let scale = pose.scale;
      let shade = pose.shade;
      if (state.selected >= 0) {
        if (i === state.selected) {
          offX = -r + detailOffset.x; // 가운데로 와서 (오른쪽 패널 자리를 비우게) 옆으로
          offY = detailOffset.y;
          offZ = -pose.z;             // 물러남·회전을 되돌려 정면으로
          turn = -pose.rotY;
          scale = detailScale;
          shade = 1;
        } else {
          shade = 0;
        }
      }
      const p = poses[i];
      p.offX += (offX - p.offX) * follow;
      p.offY += (offY - p.offY) * follow;
      p.offZ += (offZ - p.offZ) * follow;
      p.turn += (turn - p.turn) * follow;
      p.scale += (scale - p.scale) * follow;
      p.shade += (shade - p.shade) * follow;

      const rise = entrancePose(i, count, entranceTime);
      const visible = state.selected >= 0 && i !== state.selected
        ? 0
        : Math.max(0.05, p.shade * edgeFade(r, total / 2) * rise.shade);
      dummy.position.set(r + p.offX + rise.x, listY + p.offY + rise.y, pose.z + p.offZ + rise.z);
      dummy.rotation.set(0, pose.rotY + p.turn, 0);
      dummy.scale.setScalar(visible > 0.02 ? p.scale * rise.scale : 0);
      dummy.updateMatrix();
      const slot = slots[i];
      slot.cards.mesh.setMatrixAt(slot.instance, dummy.matrix);
      slot.cards.setDim(slot.instance, visible);
      if (Math.abs(r) < nearestDistance) {
        nearestDistance = Math.abs(r);
        nearest = i;
      }
    }
    for (const group of groups) group.cards.commit();
    if (state.selected < 0 && nearest !== state.activeIndex) showMeta(rowCenterIndex(state.scrollCurrent, row));

    // 3) 카메라: 초점 둘레를 돌고(끌기), 커서를 살짝 따라가고(끄는 동안은 끔), 상세면 다가간다
    const kOrbit = followFactor(SHELF.orbitFollow, dt);
    orbit.theta += (orbit.thetaTarget - orbit.theta) * kOrbit;
    orbit.phi += (orbit.phiTarget - orbit.phi) * kOrbit;
    orbit.radius += (orbit.radiusTarget - orbit.radius) * kOrbit;
    const kParallax = followFactor(SHELF.parallaxFollow, dt);
    orbit.px += (orbit.pxTarget - orbit.px) * kParallax;
    orbit.py += (orbit.pyTarget - orbit.py) * kParallax;
    orbit.weight += ((state.drag || reduced ? 0 : 1) - orbit.weight) * followFactor(SHELF.parallaxWeightFollow, dt);
    const theta = orbit.theta + orbit.px * orbit.weight;
    const phi = clamp(orbit.phi + orbit.py * orbit.weight, SHELF.phiMin, SHELF.phiMax);
    const cam = orbitPosition(theta, phi, orbit.radius, focus);
    stage.camera.position.set(cam.x, cam.y, cam.z);
    stage.camera.lookAt(focus.x, focus.y, focus.z);
    const fov = fovFor(stage.camera.aspect);
    if (Math.abs(stage.camera.fov - fov) > 1e-3) {
      stage.camera.fov = fov;
      stage.camera.updateProjectionMatrix();
    }

    stage.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
