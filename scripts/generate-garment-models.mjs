import fs from "node:fs/promises";
import path from "node:path";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
} from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

globalThis.FileReader = class {
  result = null;
  onloadend = null;
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
      this.onloadend?.();
    });
  }
};

const outputDir = path.resolve("public/models");
const material = new MeshStandardMaterial({
  color: "#f4f2ed",
  roughness: 0.82,
  metalness: 0.01,
});

function box(size, position, rotation = [0, 0, 0]) {
  const mesh = new Mesh(new BoxGeometry(...size, 8, 8, 2), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function top({ sleeve = "short", hood = false, jacket = false }) {
  const group = new Group();
  group.name = "Garment";
  group.add(box([3.05, 3.65, 0.68], [0, -0.1, 0]));
  const isLong = sleeve === "long";
  group.add(
    box(
      [isLong ? 0.82 : 1.2, isLong ? 3.35 : 1.5, 0.62],
      [-1.85, isLong ? -0.25 : 0.85, 0],
      [0, 0, isLong ? -0.18 : -0.72],
    ),
    box(
      [isLong ? 0.82 : 1.2, isLong ? 3.35 : 1.5, 0.62],
      [1.85, isLong ? -0.25 : 0.85, 0],
      [0, 0, isLong ? 0.18 : 0.72],
    ),
  );
  if (hood) {
    const hoodMesh = new Mesh(new TorusGeometry(0.95, 0.42, 18, 48, Math.PI), material);
    hoodMesh.position.set(0, 2.05, -0.1);
    group.add(hoodMesh);
  }
  if (jacket) {
    group.add(box([0.06, 3.25, 0.73], [0, -0.12, 0.03]));
  }
  return group;
}

function bottom(short = false) {
  const group = new Group();
  group.name = "Garment";
  const legHeight = short ? 1.25 : 3.25;
  group.add(
    box([2.5, 1.1, 0.62], [0, 0.3, 0]),
    box([1.13, legHeight, 0.58], [-0.65, 0.3 - legHeight / 2, 0]),
    box([1.13, legHeight, 0.58], [0.65, 0.3 - legHeight / 2, 0]),
  );
  return group;
}

const models = {
  "tshirt.glb": top({ sleeve: "short" }),
  "long-sleeve.glb": top({ sleeve: "long" }),
  "hoodie.glb": top({ sleeve: "long", hood: true }),
  "sweatshirt.glb": top({ sleeve: "long" }),
  "jacket.glb": top({ sleeve: "long", jacket: true }),
  "shorts.glb": bottom(true),
  "pants.glb": bottom(false),
};

await fs.mkdir(outputDir, { recursive: true });
const exporter = new GLTFExporter();

for (const [fileName, scene] of Object.entries(models)) {
  const binary = await exporter.parseAsync(scene, {
    binary: true,
    onlyVisible: true,
  });
  await fs.writeFile(path.join(outputDir, fileName), Buffer.from(binary));
}

console.log(`Generated ${Object.keys(models).length} UV-ready garment GLB files.`);
