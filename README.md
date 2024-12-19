# WebGPU Sponza Demo

WebGPU tech demo showcasing various rendering techniques.

![Screenshot 1 from the demo](previews/screenshot-0.png)
![Screenshot 2 from the demo](previews/screenshot-1.png)
![Screenshot 3 from the demo](previews/screenshot-2.png)

## About

A WebGPU deferred rendering playground written as a personal project to familiarize myself better with the API and explore various rendering techniques. As WebGPU is still considered experimental browser technology certain things might break for you.

## Features

1. glTF loading and parsing
2. Physically based shading
3. Cascaded Shadow Mapping
4. Deferred Renderer (3 MRT) with culled light volumes using a stencil buffer
5. 400+ dynamic light sources moved in compute shader
6. Separate forward pass for alpha masked objects (foliage)
7. SSAO
8. Screen Space Reflections with the ability to switch between Hi-Z and Linear raymarching
9. Physically based bloom
10. TAA
11. UI controls to tweak various different rendering parameters
12. Dynamic performance degradation if the framerate dips below 60fps for longer than 2 seconds
13. Mobile support

## Requirements

WebGPU is still considered experimental technology and might not be implemented in the version of your browser of choice. Please refer to the [WebGPU Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status) for more info.

## Running Locally

1. Clone the repo locally
2. `npm i`
3. `npm run dev`
