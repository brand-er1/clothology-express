# Brand-er garment GLB assets

The 3D studio resolves garment models from these UV-mapped files:

- `tshirt.glb`
- `long-sleeve.glb`
- `hoodie.glb`
- `sweatshirt.glb`
- `jacket.glb`
- `shorts.glb`
- `pants.glb`

Each visible garment mesh must include a non-overlapping UV set. Keep front,
back, left-sleeve and right-sleeve islands in stable atlas regions so generated
textures can be applied consistently. Until an asset is present the UI renders
the built-in garment preview instead of failing.
