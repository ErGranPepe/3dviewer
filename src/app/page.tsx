'use client'

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber'
import { 
  Environment, 
  ContactShadows, 
  Float, 
  PresentationControls,
  RoundedBox
} from '@react-three/drei'
import * as THREE from 'three'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Upload, Play, Download, Smartphone, ChevronRight, Menu, X
} from 'lucide-react'

// Types
type DeviceType = 'iphone15' | 'iphone14' | 'pixel' | 'galaxy' | 'ipad' | 'macbook'
type AnimationType = 'rotate' | 'float' | 'tilt' | 'reveal' | 'showcase'
type ColorPreset = 'pink' | 'purple' | 'blue' | 'green' | 'orange' | 'dark'

// Device configurations
const deviceConfigs = {
  iphone15: { 
    name: 'iPhone 15 Pro', 
    width: 2.81, height: 5.81, depth: 0.31,
    borderRadius: 0.55, bezelWidth: 0.06,
    hasDynamicIsland: true, cameraModule: 'pro'
  },
  iphone14: { 
    name: 'iPhone 14', 
    width: 2.78, height: 5.78, depth: 0.31,
    borderRadius: 0.45, bezelWidth: 0.08,
    hasNotch: true, cameraModule: 'standard'
  },
  pixel: { 
    name: 'Pixel 8 Pro', 
    width: 2.89, height: 6.0, depth: 0.34,
    borderRadius: 0.4, bezelWidth: 0.05, cameraModule: 'pixel'
  },
  galaxy: { 
    name: 'Galaxy S24', 
    width: 2.78, height: 5.89, depth: 0.32,
    borderRadius: 0.4, bezelWidth: 0.04, cameraModule: 'samsung'
  },
  ipad: { 
    name: 'iPad Pro', 
    width: 7.0, height: 9.4, depth: 0.24,
    borderRadius: 0.3, bezelWidth: 0.12, cameraModule: 'ipad'
  },
  macbook: { 
    name: 'MacBook Pro', 
    width: 9.8, height: 6.1, depth: 0.45,
    borderRadius: 0.15, bezelWidth: 0.15,
    hasNotch: true, isLaptop: true
  }
}

// Color presets
const colorPresets: Record<ColorPreset, { primary: string; secondary: string; name: string }> = {
  pink: { primary: '#FF6B9D', secondary: '#A855F7', name: 'Pink' },
  purple: { primary: '#A855F7', secondary: '#7C3AED', name: 'Purple' },
  blue: { primary: '#4A90E2', secondary: '#2563EB', name: 'Blue' },
  green: { primary: '#10B981', secondary: '#059669', name: 'Green' },
  orange: { primary: '#F97316', secondary: '#EA580C', name: 'Orange' },
  dark: { primary: '#1F2937', secondary: '#111827', name: 'Dark' }
}

// Screen content with uploaded image
function ScreenContent({ 
  texture, 
  width, 
  height, 
  depth 
}: { 
  texture: THREE.Texture | null
  width: number
  height: number
  depth: number
}) {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null)
  
  useEffect(() => {
    if (materialRef.current && texture) {
      materialRef.current.map = texture
      materialRef.current.needsUpdate = true
    }
  }, [texture])

  return (
    <mesh position={[0, 0, depth / 2 + 0.002]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial ref={materialRef} color={texture ? undefined : "#1a1a2e"} />
    </mesh>
  )
}

// 3D Device Component
function Device3D({ 
  config, 
  texture, 
  animation,
  isPlaying
}: { 
  config: typeof deviceConfigs.iphone15
  texture: THREE.Texture | null
  animation: AnimationType
  isPlaying: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  
  const screenWidth = config.width - config.bezelWidth * 2
  const screenHeight = config.height - config.bezelWidth * 2

  // Animation state
  const animState = useRef({
    rotationY: 0,
    rotationX: 0.1,
    positionY: 0
  })

  useFrame((state, delta) => {
    if (!groupRef.current) return
    
    const t = state.clock.elapsedTime
    
    if (isPlaying) {
      switch (animation) {
        case 'rotate':
          animState.current.rotationY += delta * 0.5
          animState.current.rotationX = Math.sin(t * 0.3) * 0.1 + 0.15
          break
        case 'float':
          animState.current.rotationY = Math.sin(t * 0.3) * 0.3
          animState.current.positionY = Math.sin(t * 0.6) * 0.1
          animState.current.rotationX = Math.sin(t * 0.4) * 0.08
          break
        case 'tilt':
          animState.current.rotationY = Math.sin(t * 0.4) * 0.4
          animState.current.rotationX = Math.sin(t * 0.5) * 0.2
          break
        case 'reveal':
          animState.current.rotationY = THREE.MathUtils.lerp(
            animState.current.rotationY,
            Math.sin(t * 0.3) * 0.5,
            0.02
          )
          break
        case 'showcase':
          animState.current.rotationY += delta * 0.4
          break
      }
    }

    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      animState.current.rotationY,
      0.1
    )
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      animState.current.rotationX,
      0.1
    )
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      animState.current.positionY,
      0.1
    )
  })

  return (
    <group ref={groupRef}>
      {/* Main device body */}
      <RoundedBox 
        args={[config.width, config.height, config.depth]} 
        radius={config.borderRadius}
        smoothness={4}
      >
        <meshPhysicalMaterial 
          color="#1a1a1a"
          metalness={0.9}
          roughness={0.15}
          clearcoat={0.8}
          clearcoatRoughness={0.1}
          envMapIntensity={2}
        />
      </RoundedBox>

      {/* Screen bezel */}
      <mesh position={[0, 0, config.depth / 2 + 0.001]}>
        <planeGeometry args={[screenWidth + 0.02, screenHeight + 0.02]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Screen with texture */}
      <ScreenContent 
        texture={texture}
        width={screenWidth}
        height={screenHeight}
        depth={config.depth}
      />

      {/* Screen glass */}
      <mesh position={[0, 0, config.depth / 2 + 0.003]}>
        <planeGeometry args={[screenWidth, screenHeight]} />
        <meshPhysicalMaterial 
          color="#ffffff"
          transparent
          opacity={0.02}
          metalness={1}
          roughness={0}
        />
      </mesh>

      {/* Dynamic Island */}
      {config.hasDynamicIsland && (
        <mesh position={[0, config.height / 2 - 0.45, config.depth / 2 + 0.004]}>
          <capsuleGeometry args={[0.1, 0.42, 8, 16]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
      )}

      {/* Notch */}
      {config.hasNotch && !config.hasDynamicIsland && (
        <mesh position={[0, config.height / 2 - 0.18, config.depth / 2 + 0.004]}>
          <RoundedBox args={[0.9, 0.22, 0.01]} radius={0.08}>
            <meshBasicMaterial color="#000000" />
          </RoundedBox>
        </mesh>
      )}

      {/* Camera module */}
      {config.cameraModule === 'pro' && (
        <group position={[-config.width / 2 + 0.4, config.height / 2 - 0.45, -config.depth / 2 - 0.02]}>
          <RoundedBox args={[0.55, 0.55, 0.06]} radius={0.12}>
            <meshPhysicalMaterial color="#2a2a2a" metalness={0.95} roughness={0.1} />
          </RoundedBox>
          {[[-0.12, 0.12], [0.12, 0.12], [-0.12, -0.12]].map((pos, i) => (
            <group key={i} position={[pos[0], pos[1], 0.03]}>
              <mesh>
                <cylinderGeometry args={[0.09, 0.09, 0.03, 32]} />
                <meshPhysicalMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* Side buttons */}
      <mesh position={[-config.width / 2 - 0.015, 0.6, 0]}>
        <boxGeometry args={[0.025, 0.35, 0.06]} />
        <meshPhysicalMaterial color="#3a3a3a" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[-config.width / 2 - 0.015, 0.05, 0]}>
        <boxGeometry args={[0.025, 0.2, 0.06]} />
        <meshPhysicalMaterial color="#3a3a3a" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[-config.width / 2 - 0.015, -0.25, 0]}>
        <boxGeometry args={[0.025, 0.2, 0.06]} />
        <meshPhysicalMaterial color="#3a3a3a" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[config.width / 2 + 0.015, 0.3, 0]}>
        <boxGeometry args={[0.025, 0.5, 0.06]} />
        <meshPhysicalMaterial color="#3a3a3a" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  )
}

// Scene Component
function Scene({ 
  deviceConfig, 
  imageTexture,
  animation,
  isPlaying
}: { 
  deviceConfig: typeof deviceConfigs.iphone15
  imageTexture: THREE.Texture | null
  animation: AnimationType
  isPlaying: boolean
}) {
  return (
    <>
      <Environment preset="studio" />
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 15, 10]} angle={0.3} penumbra={1} intensity={1.5} />
      <spotLight position={[-8, 10, -5]} angle={0.4} penumbra={1} intensity={0.8} color="#FF6B9D" />
      <spotLight position={[5, -5, 10]} angle={0.3} penumbra={0.5} intensity={0.5} color="#A855F7" />

      <PresentationControls global rotation={[0.1, 0, 0]} polar={[-Math.PI / 4, Math.PI / 4]} azimuth={[-Math.PI / 3, Math.PI / 3]}>
        <Float speed={0.5} rotationIntensity={0.1} floatIntensity={0.05}>
          <Device3D config={deviceConfig} texture={imageTexture} animation={animation} isPlaying={isPlaying} />
        </Float>
      </PresentationControls>

      <ContactShadows position={[0, -3, 0]} opacity={0.5} scale={20} blur={2.5} far={4} />
    </>
  )
}

// Main App
export default function PromoGenApp() {
  const [view, setView] = useState<'landing' | 'editor'>('landing')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<DeviceType>('iphone15')
  const [selectedAnimation, setSelectedAnimation] = useState<AnimationType>('rotate')
  const [selectedColor, setSelectedColor] = useState<ColorPreset>('pink')
  const [isPlaying, setIsPlaying] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Create texture from uploaded image using useMemo
  const imageTexture = useMemo(() => {
    if (!uploadedImage) return null
    
    const img = new Image()
    img.src = uploadedImage
    const texture = new THREE.Texture(img)
    texture.colorSpace = THREE.SRGBColorSpace
    img.onload = () => {
      texture.needsUpdate = true
    }
    return texture
  }, [uploadedImage])

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [handleFileSelect])

  // LANDING PAGE
  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900">PromoGen</span>
              <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs border-0 rounded-md px-2 py-0.5">BETA</Badge>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#benefits" className="text-gray-600 hover:text-gray-900 text-sm">Benefits</a>
              <a href="#how" className="text-gray-600 hover:text-gray-900 text-sm">How it works</a>
              <a href="#features" className="text-gray-600 hover:text-gray-900 text-sm">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 text-sm">Pricing</a>
            </nav>
            <div className="hidden md:flex items-center gap-3">
              <Button variant="ghost" className="text-gray-600">Login</Button>
              <Button className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-lg shadow-pink-500/25" onClick={() => setView('editor')}>
                Try for free
              </Button>
            </div>
            <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden bg-white border-t border-gray-100 p-4 space-y-4">
              <a href="#benefits" className="block text-gray-600">Benefits</a>
              <a href="#how" className="block text-gray-600">How it works</a>
              <Button className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white">Try for free</Button>
            </div>
          )}
        </header>

        {/* Hero */}
        <section className="pt-32 pb-16 px-4 flex-1">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-pink-50 to-purple-50 text-pink-600 text-sm font-medium mb-6 border border-pink-100">
                START FOR FREE
              </div>
              <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                <span className="bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">Beautiful</span>
                <br />App Videos
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Drag and drop your app design, get cinematic mockup videos in seconds
              </p>
              <Button size="lg" className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white text-lg px-8 py-6 shadow-xl shadow-pink-500/25" onClick={() => setView('editor')}>
                Get Started Free <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            {/* 3D Preview */}
            <div className="relative h-[500px] sm:h-[600px] w-full max-w-4xl mx-auto rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden shadow-2xl">
              <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-pink-300/30 rounded-full blur-3xl" />
              <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-300/30 rounded-full blur-3xl" />
              <Canvas camera={{ position: [0, 0, 10], fov: 40 }} shadows dpr={[1, 2]}>
                <Scene deviceConfig={deviceConfigs.iphone15} imageTexture={null} animation="rotate" isPlaying={isPlaying} />
              </Canvas>
              <div className="absolute bottom-4 right-4 bg-gray-900/80 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full">iPhone 15 Pro</div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section id="benefits" className="py-20 px-4 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Choose PromoGen?</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">Transform your app designs into professional marketing videos effortlessly</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: '⚡', title: 'Save Hours of Production Time', description: 'Skip complex tools like After Effects. Just upload, pick a template, and export in 4K.' },
                { icon: '✨', title: 'High-Quality Mockup Videos', description: 'Dynamic studio lighting, realistic shadows, and modern devices create professional videos.' },
                { icon: '🚀', title: 'Perfect for Marketing', description: 'Create stunning content for TikTok, Instagram, and other platforms.' }
              ].map((benefit, i) => (
                <div key={i} className="bg-white rounded-2xl p-8 text-center shadow-lg hover:shadow-xl transition-shadow">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-2xl">{benefit.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{benefit.title}</h3>
                  <p className="text-gray-600">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-4 bg-gray-900 text-white">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">PromoGen</span>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <span>•</span>
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            </div>
          </div>
        </footer>
      </div>
    )
  }

  // EDITOR VIEW
  return (
    <div className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setView('landing')} className="text-gray-600">← Back</Button>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">PromoGen</span>
            <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs border-0">BETA</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setIsPlaying(!isPlaying)}>{isPlaying ? '⏸ Pause' : '▶ Play'}</Button>
          <Button className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white" size="sm">
            <Download className="w-4 h-4 mr-2" />Export
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0">
          {/* Upload */}
          <div className="p-4 border-b border-gray-100">
            <div
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-pink-400 transition-colors cursor-pointer bg-gray-50"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 font-medium text-sm">Drag & drop your image</p>
              <p className="text-gray-400 text-xs mt-1">or click to browse</p>
            </div>
          </div>

          {/* Preview */}
          {uploadedImage && (
            <div className="p-4 border-b border-gray-100">
              <div className="relative rounded-lg overflow-hidden border border-gray-200">
                <img src={uploadedImage} alt="Uploaded" className="w-full h-auto max-h-40 object-contain" />
                <button
                  className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded hover:bg-red-600"
                  onClick={() => setUploadedImage(null)}
                >
                  Remove
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">Image loaded ✓</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Device */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">Device</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(deviceConfigs) as [DeviceType, typeof deviceConfigs.iphone15][]).map(([key, config]) => (
                  <button
                    key={key}
                    className={`p-3 rounded-lg text-xs font-medium transition-all ${
                      selectedDevice === key ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    onClick={() => setSelectedDevice(key)}
                  >
                    {config.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Animation */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">Animation</label>
              <div className="grid grid-cols-2 gap-2">
                {['rotate', 'float', 'tilt', 'reveal', 'showcase'].map((anim) => (
                  <button
                    key={anim}
                    className={`p-3 rounded-lg text-xs font-medium transition-all capitalize ${
                      selectedAnimation === anim ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    onClick={() => setSelectedAnimation(anim as AnimationType)}
                  >
                    {anim}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">Background</label>
              <div className="flex gap-2">
                {(Object.keys(colorPresets) as ColorPreset[]).map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full transition-all ${selectedColor === color ? 'ring-2 ring-offset-2 ring-pink-500' : ''}`}
                    style={{ background: `linear-gradient(135deg, ${colorPresets[color].primary}, ${colorPresets[color].secondary})` }}
                    onClick={() => setSelectedColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* 3D Canvas */}
        <main className="flex-1 relative" style={{ background: `linear-gradient(135deg, ${colorPresets[selectedColor].primary}20, ${colorPresets[selectedColor].secondary}20)` }}>
          <Canvas camera={{ position: [0, 0, 10], fov: 40 }} shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
            <Scene deviceConfig={deviceConfigs[selectedDevice]} imageTexture={imageTexture} animation={selectedAnimation} isPlaying={isPlaying} />
          </Canvas>
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
            <div className="text-xs text-gray-500">{deviceConfigs[selectedDevice].name}</div>
          </div>
          <div className="absolute bottom-4 left-4 text-xs text-gray-500 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2">
            Drag to rotate • Scroll to zoom
          </div>
        </main>
      </div>
    </div>
  )
}
