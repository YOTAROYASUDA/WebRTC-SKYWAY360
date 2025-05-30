import { nowInSec, SkyWayAuthToken, SkyWayContext, SkyWayRoom, SkyWayStreamFactory, uuidV4 } from "@skyway-sdk/room";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// SkyWay認証トークン
const token = new SkyWayAuthToken({
  jti: uuidV4(),
  iat: nowInSec(),
  exp: nowInSec() + 60 * 60 * 24,
  version: 3,
  scope: {
    appId: "07b887be-6091-4eae-9c58-a903e0bd72f4",
    rooms: [{ name: "*", methods: ["create", "close"], member: { name: "*", methods: ["publish", "subscribe"] } }],
  },
}).encode("5tl2lhpB/9NzBfhkVw8vDYZeA9SiCYi7ZumfaoEHqQ0=");

const localVideo = document.getElementById("local-video");
const joinButton = document.getElementById("join");
const leaveButton = document.getElementById("leave");
const roomNameInput = document.getElementById("room-name");
const remoteMediaArea = document.getElementById("remote-media-area");
const myId = document.getElementById("my-id");

(async () => {
  const { audio, video } = await SkyWayStreamFactory.createMicrophoneAudioAndCameraStream();
  

  video.attach(localVideo);
  await localVideo.play();

  joinButton.onclick = async () => {
    const context = await SkyWayContext.Create(token);
    const room = await SkyWayRoom.FindOrCreate(context, { type: "p2p", name: roomNameInput.value });
    const me = await room.join();
    myId.textContent = me.id;

    await me.publish(audio);
    await me.publish(video);

    const subscribeAndAttach = async (publication) => {
      if (publication.publisher.id === me.id) return;

      const { stream } = await me.subscribe(publication.id);
      if (stream.track.kind === "video") {
        const videoEl = document.createElement("video");
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.muted = true;
        videoEl.setAttribute("crossorigin", "anonymous");
        stream.attach(videoEl);

        videoEl.onloadeddata = () => {
          videoEl.play();
          create360Viewer(videoEl);
        };
      }
    };

    room.publications.forEach(subscribeAndAttach);
    room.onStreamPublished.add(e => subscribeAndAttach(e.publication));

    leaveButton.onclick = async () => {
      await me.leave();
      await room.dispose();
      myId.textContent = "";
      remoteMediaArea.innerHTML = "";
    };
  };
})();

function create360Viewer(videoElement) {
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.zIndex = "9999";
  document.body.appendChild(canvas);

  videoElement.style.display = "none";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 1, 1100);
  camera.position.set(0, 0, 0.1);

  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(window.innerWidth, window.innerHeight);

  const geometry = new THREE.SphereGeometry(100, 32, 32);
  geometry.scale(-1, 1, 1);

  const texture = new THREE.VideoTexture(videoElement);
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.2;

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const animate = () => {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  return () => {
    canvas.remove();
    renderer.dispose();
  };
}

