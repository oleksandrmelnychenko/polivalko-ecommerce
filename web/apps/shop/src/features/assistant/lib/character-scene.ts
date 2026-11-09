import {
  ACESFilmicToneMapping, AnimationMixer, Box3, DirectionalLight, Group,
  HemisphereLight, Mesh, OrthographicCamera, Scene, SRGBColorSpace,
  Texture, Vector3, WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export type CharacterController = { dispose: () => void; setPaused: (paused: boolean) => void };

function disposeModel(model: Group) {
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material)) if (value instanceof Texture) value.dispose();
      material.dispose();
    }
  });
}

export function mountCharacter(host: HTMLElement, onReady: () => void, onError: () => void): CharacterController {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  host.append(renderer.domElement);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  scene.add(new HemisphereLight(0xffffff, 0x779177, 2));
  const key = new DirectionalLight(0xffffff, 2.5);
  key.position.set(4, 6, 8);
  const fill = new DirectionalLight(0xffffff, 1);
  fill.position.set(-4, 3, -3);
  scene.add(key, fill);

  const abort = new AbortController();
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let model: Group | undefined;
  let mixer: AnimationMixer | undefined;
  const eyes: { mesh: Mesh; index: number }[] = [];
  let disposed = false;
  let paused = false;
  let frame = 0;
  let previousTime = 0;
  let elapsed = 1;
  let modelHeight = 2;
  let modelWidth = 2;

  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height || disposed) return;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const halfHeight = Math.max(modelHeight, modelWidth / aspect) * 0.58;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    if (model) renderer.render(scene, camera);
  }

  function animate(time: number) {
    frame = window.requestAnimationFrame(animate);
    if (time - previousTime < 1000 / 30) return;
    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.1) : 0;
    previousTime = time;
    elapsed += delta;
    mixer?.update(delta);
    const phase = elapsed % 4.2;
    const blink = phase < 0.26 ? Math.max(0, 1 - Math.abs(phase - 0.13) / 0.13) : 0;
    for (const { mesh, index } of eyes) mesh.morphTargetInfluences![index] = blink;
    renderer.render(scene, camera);
  }

  function syncPlayback() {
    window.cancelAnimationFrame(frame);
    previousTime = 0;
    if (!disposed && model && !paused && !document.hidden && !motion.matches) {
      frame = window.requestAnimationFrame(animate);
    } else if (!disposed && model) {
      for (const { mesh, index } of eyes) mesh.morphTargetInfluences![index] = 0;
      renderer.render(scene, camera);
    }
  }

  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(host);
  document.addEventListener("visibilitychange", syncPlayback);
  motion.addEventListener("change", syncPlayback);

  // Fixed, bundled GLB with embedded resources; no user-supplied model URLs.
  void fetch("/mascot/poli-valka.glb", { signal: abort.signal, credentials: "omit" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Character unavailable");
      const data = await response.arrayBuffer();
      if (disposed) return;
      return new GLTFLoader().parseAsync(data, "");
    })
    .then((gltf) => {
      if (!gltf) return;
      if (disposed) {
        disposeModel(gltf.scene);
        return;
      }
      model = gltf.scene;
      const box = new Box3().setFromObject(model);
      const center = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      modelHeight = size.y;
      modelWidth = size.x;
      scene.add(model);
      const span = Math.max(size.x, size.y, size.z);
      camera.position.set(center.x + span * 0.1, center.y + span * 0.03, center.z + span * 3);
      camera.lookAt(center);
      camera.near = span / 100;
      camera.far = span * 10;
      mixer = new AnimationMixer(model);
      const idle = gltf.animations.find((clip) => clip.name === "Idle");
      if (idle) mixer.clipAction(idle).setEffectiveTimeScale(0.75).play();
      model.traverse((object) => {
        if (!(object instanceof Mesh) || !object.morphTargetInfluences) return;
        for (const name of ["eyeBlinkLeft", "eyeBlinkRight"]) {
          const index = object.morphTargetDictionary?.[name];
          if (index !== undefined) eyes.push({ mesh: object, index });
        }
      });
      resize();
      onReady();
      syncPlayback();
    }).catch(() => {
      if (!disposed) onError();
    });

  return {
    setPaused(value) {
      paused = value;
      syncPlayback();
    },
    dispose() {
      disposed = true;
      abort.abort();
      window.cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      motion.removeEventListener("change", syncPlayback);
      mixer?.stopAllAction();
      if (model) {
        mixer?.uncacheRoot(model);
        disposeModel(model);
      }
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
