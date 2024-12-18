import * as dat from 'dat.gui'
import Renderer from './app/Renderer'
import { IGUIParams, SSRMethod } from './types'

const $canvas = document.getElementById('c') as HTMLCanvasElement

const renderer = await Renderer.initialize($canvas)

if (renderer === undefined) {
  document
    .getElementById('no-webgpu-wrapper')
    .style.setProperty('display', 'block')
  document.getElementById('loader').classList.toggle('faded')

  const previewImg = document.createElement('img')
  previewImg.src = 'no-webgpu.png'
  document.getElementById('no-webgpu-preview').appendChild(previewImg)
}

const GUI_PARAMS: IGUIParams = {
  'Play Animation': true,
  'Performance Stats': false,
  'Enable TAA': true,
  'Debug G-Buffer': false,
  'Debug Shadow Map': false,
  'Debug Shadow Cascades': false,
  'Shadow Map Size': 2048,
  'Debug Point Lights Mask': false,
  'Render 2nd Floor Points': true,
  'Enable SSR': true,
  'SSR Method': 'hi-z',
  'SSR Max Iterations': 30,
  'Debug No Info Rays': false,
  'Sun Intensity': 2,
  'Sun Position X': 0.1,
  'Sun Position Y': 100,
  'Sun Position Z': 0.1,
  'Debug Skybox': true,
  'Enable Bloom': true,
  'Bloom Filter Radius': 0.0035,
  // "Debug Bounding Boxes": false,
  // "Debug Point Lines Curve": false,
  'Enable SSAO': true,
  'SSAO Kernel Size': 8,
  'SSAO Radius': 0.2,
  'SSAO Strength': 3,
}

renderer.onIntroAnimComplete = createGUI
requestAnimationFrame(renderFrame)
window.addEventListener('resize', resize)
resize()

function renderFrame() {
  const nowMs = performance.now()

  renderer.renderFrame(nowMs)
  requestAnimationFrame(renderFrame)
}

function resize() {
  const w = innerWidth
  const h = innerHeight
  const dpr = Math.min(devicePixelRatio, 1.5)
  $canvas.width = w * dpr
  $canvas.height = h * dpr
  $canvas.style.setProperty('width', `${w}px`)
  $canvas.style.setProperty('height', `${h}px`)
  renderer.resize(w * dpr, h * dpr)
}

function offsetLogoAndStats() {
  document.getElementById('logo').classList.toggle('faded')
  document.getElementById('timings-debug-container').classList.toggle('faded')
}

function createGUI() {
  const gui = new dat.GUI({ width: 270 })
  gui.close()

  gui.add(GUI_PARAMS, 'Play Animation').onChange((v: boolean) => {
    renderer.enableAnimation = v
  })
  gui.add(GUI_PARAMS, 'Performance Stats').onChange(() => {
    renderer.toggleStatsVisibility()
  })
  gui
    .add(GUI_PARAMS, 'Debug G-Buffer')
    .onChange((v: boolean) => {
      renderer.debugGBuffer = v
      offsetLogoAndStats()
      if (v && GUI_PARAMS['Debug Shadow Map']) {
        GUI_PARAMS['Debug Shadow Map'] = false
      }
    })
    .listen()

  // const envFolder = gui.addFolder("Environment");
  // envFolder.add(GUI_PARAMS, "Debug Skybox").onChange((v: boolean) => {
  // 	renderer.debugSkybox = v;
  // });

  const lightingFolder = gui.addFolder('Lighting')
  lightingFolder.open()
  lightingFolder
    .add(GUI_PARAMS, 'Sun Intensity', 0, 100)
    .onChange((v: number) => {
      renderer.sunIntensity = v
    })
  lightingFolder
    .add(GUI_PARAMS, 'Sun Position X', -60, 60, 0.5)
    .onChange((v: number) => {
      renderer.sunPositionZ = v
    })
  // lightingFolder
  // 	.add(GUI_PARAMS, "Sun Position Y", 0, 100)
  // 	.onChange((v: number) => {
  // 		renderer.sunPositionY = v;
  // 	});
  lightingFolder
    .add(GUI_PARAMS, 'Sun Position Z', -150, 150, 0.5)
    .onChange((v: number) => {
      renderer.sunPositionX = v
    })

  const shadowFolder = gui.addFolder('Shadow')
  shadowFolder.open()
  shadowFolder
    .add(GUI_PARAMS, 'Debug Shadow Map')
    .onChange((v: boolean) => {
      renderer.debugShadowMap = v
      offsetLogoAndStats()
      if (v && GUI_PARAMS['Debug G-Buffer']) {
        GUI_PARAMS['Debug G-Buffer'] = false
      }
    })
    .listen()

  shadowFolder
    .add(GUI_PARAMS, 'Shadow Map Size', [512, 1024, 2048, 4096])
    .onChange((v: string) => {
      renderer.shadowMapSize = parseInt(v)
    })

  shadowFolder
    .add(GUI_PARAMS, 'Debug Shadow Cascades')
    .onChange((v: boolean) => {
      renderer.debugShadowCascadeIndex = v
    })

  let lastBloomEnabled = GUI_PARAMS['Enable Bloom']
  lightingFolder
    .add(GUI_PARAMS, 'Debug Point Lights Mask')
    .onChange((v: boolean) => {
      if (v) {
        lastBloomEnabled = GUI_PARAMS['Enable Bloom']
        GUI_PARAMS['Enable Bloom'] = false
        renderer.bloomEnabled = false
      } else {
        if (lastBloomEnabled) {
          GUI_PARAMS['Enable Bloom'] = true
          renderer.bloomEnabled = true
        }
      }
      renderer.debugLightsMask = v
    })
  lightingFolder
    .add(GUI_PARAMS, 'Render 2nd Floor Points')
    .onChange((v: boolean) => {
      renderer.render2ndFloorPoints = v
    })

  const ssaoFolder = gui.addFolder('Screen space Ambient Occlusion')
  ssaoFolder.open()
  ssaoFolder.add(GUI_PARAMS, 'Enable SSAO').onChange((v: boolean) => {
    renderer.ssaoEnabled = v
  })
  ssaoFolder
    .add(GUI_PARAMS, 'SSAO Kernel Size', 8, 128, 1)
    .onChange((v: number) => {
      renderer.ssaoKernelSize = v
    })
  ssaoFolder.add(GUI_PARAMS, 'SSAO Radius', 0, 1).onChange((v: number) => {
    renderer.ssaoRadius = v
  })
  ssaoFolder.add(GUI_PARAMS, 'SSAO Strength', 0, 5).onChange((v: number) => {
    renderer.ssaoStrength = v
  })

  const ssrFolder = gui.addFolder('Screen space Reflections')
  ssrFolder.open()

  ssrFolder.add(GUI_PARAMS, 'Enable SSR').onChange((v: boolean) => {
    renderer.ssrEnabled = v
  })
  ssrFolder
    .add(GUI_PARAMS, 'SSR Method', ['hi-z', 'linear'])
    .onChange((v: SSRMethod) => {
      renderer.ssrIsHiZ = v === 'hi-z'
    })
  ssrFolder
    .add(GUI_PARAMS, 'SSR Max Iterations', 0, 1500, 1)
    .onChange((v: number) => {
      renderer.ssrMaxIterations = v
    })
  ssrFolder.add(GUI_PARAMS, 'Debug No Info Rays').onChange((v: boolean) => {
    renderer.debugMissedSSR = v
  })

  const bloomFolder = gui.addFolder('Bloom')
  bloomFolder.open()
  const bloomEnabledCtrl = bloomFolder
    .add(GUI_PARAMS, 'Enable Bloom')
    .onChange((v: boolean) => {
      renderer.bloomEnabled = v
    })
  bloomEnabledCtrl.listen()
  bloomFolder
    .add(GUI_PARAMS, 'Bloom Filter Radius', 0.001, 0.005, 0.0005)
    .onChange((v: number) => {
      renderer.bloomFilterRadius = v
    })

  const antialiasFolder = gui.addFolder('Anti-Aliasing')
  antialiasFolder.open()
  antialiasFolder.add(GUI_PARAMS, 'Enable TAA').onChange((v: boolean) => {
    renderer.enableTAA = v
  })
}
