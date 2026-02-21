'use client'

import { useState, useRef, useCallback, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { 
  Environment, 
  ContactShadows, 
  Float, 
  PresentationControls,
  RoundedBox,
  SpotLight,
  Stars,
  Sky
} from '@react-three/drei'
import * as THREE from 'three'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { 
  Upload, Play, Download, Smartphone, Monitor, 
  Sparkles, Zap, CheckCircle, ChevronRight, 
  Menu, X, RotateCcw, 
  Loader2, Film, Wand2, MousePointer2
} from 'lucide-react'

// Types
type DeviceType = 'iphone15' | 'iphone14' | 'pixel' | 'galaxy' | 'ipad' | 'macbook'
type AnimationType = 'cinematic' | 'orbit' | 'float' | 'reveal' | 'product'
type EnvironmentType = 'studio' | 'sunset' | 'night' | 'neon'

// Configurations
const deviceConfigs = {
  iphone15: { name: 'iPhone 15 Pro', width: 2.4, height: 4.8, depth: 0.3, borderRadius: 0.4, hasDynamicIsland: true },
  iphone14: { name: 'iPhone 14', width: 2.4, height: 4.8, depth: 0.3, borderRadius: 0.35, hasNotch: true },
  pixel: { name: 'Pixel 8 Pro', width: 2.5, height: 5.0, depth: 0.35, borderRadius: 0.3 },
  galaxy: { name: 'Galaxy S24', width: 2.4, height: 4.9, depth: 0.32, borderRadius: 0.35 },
  ipad: { name: 'iPad Pro', width: 5.8, height: 7.8, depth: 0.25, borderRadius: 0.25 },
  macbook: { name: 'MacBook Pro', width: 8.0, height: 5.2, depth: 0.4, borderRadius: 0.2, hasNotch: true }
}

const colorPresets = [
  { name: 'Titanium', primary: '#8a8a8f', metalness: 0.9, roughness: 0.15 },
  { name: 'Midnight', primary: '#1d1d1f', metalness: 0.95, roughness: 0.1 },
  { name: 'Gold', primary: '#f5d49a', metalness: 0.95, roughness: 0.2 },
  { name: 'Silver', primary: '#e3e3e8', metalness: 0.95, roughness: 0.12 },
  { name: 'Blue', primary: '#0066cc', metalness: 0.85, roughness: 0.25 },
  { name: 'Pink', primary: '#ffb6c1', metalness: 0.8, roughness: 0.3 }
]

const animationPresets = [
  { id: 'cinematic', name: 'Cinematic', icon: Film },
  { id: 'orbit', name: 'Orbit', icon: RotateCcw },
  { id: 'float', name: 'Float', icon: Sparkles },
  { id: 'reveal', name: 'Reveal', icon: Monitor },
  { id: 'product', name: 'Product', icon: Smartphone }
]

const environmentPresets = [
  { id: 'studio', name: 'Studio', color: '#ffffff' },
  { id: 'sunset', name: 'Sunset', color: '#ff6b35' },
  { id: 'night', name: 'Night', color: '#1a1a2e' },
  { id: 'neon', name: 'Neon', color: '#00ffff' }
]

// 3D Device Component
function Device3D({ config, texture, colorScheme, animation, isPlaying }: any) {
  const meshRef = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    if (!meshRef.current || !isPlaying) return
    const t = state.clock.elapsedTime
    const target = meshRef.current

    switch (animation) {
      case 'cinematic':
        target.rotation.y = THREE.MathUtils.lerp(target.rotation.y, Math.sin(t * 0.3) * 0.3, 0.05)
        target.rotation.x = Math.sin(t * 0.2) * 0.1 + 0.1
        target.position.y = Math.sin(t * 0.5) * 0.05
        break
      case 'orbit':
        target.rotation.y += delta * 0.5
        target.rotation.x = Math.sin(t * 0.3) * 0.15
        break
      case 'float':
        target.rotation.y = Math.sin(t * 0.2) * 0.4
        target.position.y = Math.sin(t * 0.8) * 0.15
        break
      case 'reveal':
        target.rotation.y = THREE.MathUtils.lerp(target.rotation.y, Math.sin(t * 0.4) * 0.6, 0.03)
        break
      case 'product':
        target.rotation.y = t * 0.3
        break
    }
  })

  return (
    <group ref={meshRef}>
      <Float speed={0.5} rotationIntensity={0.1} floatIntensity={0.1}>
        {/* Device Body */}
        <RoundedBox args={[config.width, config.height, config.depth]} radius={config.borderRadius} smoothness={4}>
          <meshPhysicalMaterial 
            color={new THREE.Color(colorScheme.primary)}
            metalness={colorScheme.metalness}
            roughness={colorScheme.roughness}
            clearcoat={0.5}
            clearcoatRoughness={0.1}
            envMapIntensity={1.5}
          />
        </RoundedBox>

        {/* Screen Bezel */}
        <mesh position={[0, 0, config.depth / 2 + 0.001]}>
          <planeGeometry args={[config.width - 0.16, config.height - 0.16]} />
          <meshPhysicalMaterial color="#0a0a0a" metalness={0} roughness={0.8} />
        </mesh>

        {/* Screen */}
        <mesh position={[0, 0, config.depth / 2 + 0.002]}>
          <planeGeometry args={[config.width - 0.18, config.height - 0.18]} />
          <meshPhysicalMaterial 
            color="#000000"
            map={texture}
            metalness={0}
            roughness={0.1}
            clearcoat={1}
            envMapIntensity={0.3}
          />
        </mesh>

        {/* Screen Glass */}
        <mesh position={[0, 0, config.depth / 2 + 0.003]}>
          <planeGeometry args={[config.width - 0.17, config.height - 0.17]} />
          <meshPhysicalMaterial 
            color="#ffffff"
            transmission={0.98}
            thickness={0.05}
            transparent
            opacity={0.1}
          />
        </mesh>

        {/* Dynamic Island */}
        {config.hasDynamicIsland && (
          <mesh position={[0, config.height / 2 - 0.5, config.depth / 2 + 0.004]}>
            <capsuleGeometry args={[0.12, 0.5, 8, 16]} />
            <meshPhysicalMaterial color="#000000" />
          </mesh>
        )}

        {/* Notch */}
        {config.hasNotch && (
          <mesh position={[0, config.height / 2 - 0.2, config.depth / 2 + 0.004]}>
            <RoundedBox args={[1.0, 0.25, 0.01]} radius={0.05}>
              <meshPhysicalMaterial color="#000000" />
            </RoundedBox>
          </mesh>
        )}

        {/* Camera Module */}
        {config.name?.includes('iPhone') && (
          <group position={[-config.width / 2 + 0.3, config.height / 2 - 0.4, -config.depth / 2 - 0.01]}>
            <RoundedBox args={[0.6, 0.6, 0.08]} radius={0.15}>
              <meshPhysicalMaterial color={new THREE.Color(colorScheme.primary).multiplyScalar(0.9)} metalness={0.95} roughness={0.15} />
            </RoundedBox>
            {[[-0.12, 0.12], [0.12, 0.12], [-0.12, -0.12]].map((pos, i) => (
              <mesh key={i} position={[pos[0], pos[1], 0.05]}>
                <cylinderGeometry args={[0.1, 0.1, 0.04, 32]} />
                <meshPhysicalMaterial color="#1a1a2e" metalness={0.9} roughness={0.1} />
              </mesh>
            ))}
          </group>
        )}

        {/* Side Buttons */}
        <mesh position={[-config.width / 2 - 0.015, 0.5, 0]}>
          <boxGeometry args={[0.03, 0.4, 0.08]} />
          <meshPhysicalMaterial color={new THREE.Color(colorScheme.primary)} metalness={0.9} roughness={0.15} />
        </mesh>
        <mesh position={[-config.width / 2 - 0.015, -0.3, 0]}>
          <boxGeometry args={[0.03, 0.6, 0.08]} />
          <meshPhysicalMaterial color={new THREE.Color(colorScheme.primary)} metalness={0.9} roughness={0.15} />
        </mesh>
      </Float>
    </group>
  )
}

// Scene Component
function Scene({ deviceConfig, imageTexture, colorScheme, animation, isPlaying, environment }: any) {
  return (
    <>
      {/* Environment-based lighting */}
      {environment === 'studio' && <Environment preset="studio" />}
      {environment === 'sunset' && (
        <>
          <Sky sunPosition={[100, 10, 100]} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} color="#ffd4a3" />
        </>
      )}
      {environment === 'night' && (
        <>
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
          <ambientLight intensity={0.1} />
          <pointLight position={[10, 10, 10]} intensity={0.5} color="#4a90d9" />
        </>
      )}
      {environment === 'neon' && (
        <>
          <ambientLight intensity={0.1} />
          <pointLight position={[5, 5, 5]} intensity={2} color="#00ffff" />
          <pointLight position={[-5, -5, 5]} intensity={2} color="#ff00ff" />
        </>
      )}

      <ambientLight intensity={0.4} />
      <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} intensity={2} castShadow />
      <spotLight position={[-10, 5, -10]} angle={0.3} penumbra={1} intensity={1} color="#a855f7" />

      <PresentationControls global polar={[-Math.PI / 4, Math.PI / 4]} azimuth={[-Math.PI / 4, Math.PI / 4]}>
        <Device3D config={deviceConfig} texture={imageTexture} colorScheme={colorScheme} animation={animation} isPlaying={isPlaying} />
      </PresentationControls>

      <ContactShadows position={[0, -2.5, 0]} opacity={0.6} scale={15} blur={2} far={4} />
    </>
  )
}

// Main Component
export default function PromoGenPro() {
  const [currentView, setCurrentView] = useState<'landing' | 'editor'>('landing')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [imageTexture, setImageTexture] = useState<THREE.Texture | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<DeviceType>('iphone15')
  const [selectedAnimation, setSelectedAnimation] = useState<AnimationType>('cinematic')
  const [selectedColor, setSelectedColor] = useState(colorPresets[0])
  const [selectedEnvironment, setSelectedEnvironment] = useState<EnvironmentType>('studio')
  const [isPlaying, setIsPlaying] = useState(true)
  const [animationSpeed, setAnimationSpeed] = useState(1)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        setUploadedImage(dataUrl)
        const loader = new THREE.TextureLoader()
        loader.load(dataUrl, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace
          setImageTexture(texture)
        })
        setCurrentView('editor')
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        setUploadedImage(dataUrl)
        const loader = new THREE.TextureLoader()
        loader.load(dataUrl, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace
          setImageTexture(texture)
        })
        setCurrentView('editor')
      }
      reader.readAsDataURL(file)
    }
  }, [])

  if (currentView === 'landing') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        {/* Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-pink-900/20" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Wand2 className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold">PromoGen Pro</span>
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 border-0">PRO</Badge>
            </div>
            
            <nav className="hidden md:flex items-center gap-8 text-sm text-gray-400">
              <a href="#features" className="hover:text-white">Features</a>
              <a href="#pricing" className="hover:text-white">Pricing</a>
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <Button variant="ghost" className="text-gray-400">Login</Button>
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0" onClick={() => setCurrentView('editor')}>
                Start Creating
              </Button>
            </div>

            <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden bg-black/95 border-t border-white/10 p-4 space-y-4">
              <a href="#features" className="block text-gray-400">Features</a>
              <a href="#pricing" className="block text-gray-400">Pricing</a>
              <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white">Start Creating</Button>
            </div>
          )}
        </header>

        {/* Hero */}
        <section className="pt-32 pb-20 px-4 flex-1 relative">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm mb-6">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-gray-300">Ultra Realistic 3D Mockups</span>
              </div>
              
              <h1 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                <span className="text-white">Stunning </span>
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">Cinematic</span>
                <br />
                <span className="text-white">App Videos</span>
              </h1>
              
              <p className="text-xl text-gray-400 mb-8 max-w-xl">
                Transform screenshots into breathtaking 3D product videos with photorealistic rendering and cinematic animations.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-lg px-8 py-6 border-0" onClick={() => setCurrentView('editor')}>
                  Create Your Video <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" className="text-white border-white/20 text-lg px-8 py-6">
                  <Play className="mr-2 h-5 w-5" /> Watch Demo
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-6 mt-12 pt-12 border-t border-white/10">
                {[
                  { value: '4K', label: 'Resolution' },
                  { value: '60fps', label: 'Motion' },
                  { value: '∞', label: 'Exports' }
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{stat.value}</div>
                    <div className="text-sm text-gray-500">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3D Preview */}
            <div className="h-[500px] lg:h-[600px] relative">
              <Canvas camera={{ position: [0, 0, 8], fov: 45 }} shadows dpr={[1, 2]}>
                <Suspense fallback={null}>
                  <Scene deviceConfig={deviceConfigs.iphone15} imageTexture={null} colorScheme={colorPresets[0]} animation="cinematic" isPlaying={isPlaying} environment="studio" />
                </Suspense>
              </Canvas>
              <div className="absolute top-10 right-10 bg-white/10 backdrop-blur-md rounded-lg px-3 py-2 border border-white/10">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  Live Preview
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 px-4 bg-gradient-to-b from-black to-gray-900/50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Professional Features</h2>
              <p className="text-lg text-gray-400">Everything you need for stunning content</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Monitor, title: 'Photorealistic 3D', description: 'Ultra-detailed PBR materials with real-time ray tracing.', gradient: 'from-blue-500 to-cyan-500' },
                { icon: Sparkles, title: 'Studio Lighting', description: 'Professional HDRI environments and custom light rigs.', gradient: 'from-yellow-500 to-orange-500' },
                { icon: Film, title: 'Cinematic Motion', description: 'Hollywood-quality camera movements and animations.', gradient: 'from-purple-500 to-pink-500' },
                { icon: Wand2, title: 'Material Library', description: 'Titanium, Gold, Midnight and custom metallic finishes.', gradient: 'from-rose-500 to-red-500' },
                { icon: Download, title: '4K Export', description: 'Export at 4K resolution with transparent backgrounds.', gradient: 'from-green-500 to-emerald-500' },
                { icon: Zap, title: 'Real-time Preview', description: 'See changes instantly with GPU-accelerated rendering.', gradient: 'from-violet-500 to-purple-500' }
              ].map((feature, i) => (
                <Card key={i} className="p-6 bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all group">
                  <div className={`w-12 h-12 mb-4 rounded-xl bg-gradient-to-r ${feature.gradient} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Simple Pricing</h2>
              <p className="text-gray-400">Start free, upgrade when needed</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { name: 'Starter', price: 'Free', features: ['720p Exports', '5 Animations', '3 Devices'] },
                { name: 'Pro', price: '$19', period: '/month', features: ['4K Exports', 'All Animations', 'All Devices', 'No Watermark'], popular: true },
                { name: 'Enterprise', price: 'Custom', features: ['8K Exports', 'Custom Devices', 'API Access', 'Dedicated Support'] }
              ].map((plan, i) => (
                <Card key={i} className={`p-6 ${plan.popular ? 'bg-gradient-to-b from-purple-600/20 to-pink-600/20 border-purple-500/50' : 'bg-white/5 border-white/10'} relative`}>
                  {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-xs">Popular</div>}
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                    <div className="text-3xl font-bold">{plan.price}{plan.period && <span className="text-sm text-gray-400">{plan.period}</span>}</div>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-gray-300">
                        <CheckCircle className="w-4 h-4 text-green-400" />{f}
                      </li>
                    ))}
                  </ul>
                  <Button className={`w-full ${plan.popular ? 'bg-gradient-to-r from-purple-600 to-pink-600' : 'bg-white/10'} border-0`}>
                    {plan.price === 'Custom' ? 'Contact Sales' : 'Get Started'}
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-4 border-t border-white/10 text-center text-sm text-gray-500">
          <span>PromoGen Pro © 2025</span>
        </footer>
      </div>
    )
  }

  // Editor View
  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-black/50 backdrop-blur-xl border-b border-white/10 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('landing')} className="text-gray-400">← Back</Button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Wand2 className="w-4 h-4" />
            </div>
            <span className="font-semibold">PromoGen Pro</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            <Button variant="ghost" size="sm" className={`text-xs ${isPlaying ? 'bg-white/10' : 'text-gray-400'}`} onClick={() => setIsPlaying(true)}>Play</Button>
            <Button variant="ghost" size="sm" className={`text-xs ${!isPlaying ? 'bg-white/10' : 'text-gray-400'}`} onClick={() => setIsPlaying(false)}>Pause</Button>
          </div>
          <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0" size="sm" disabled={isExporting}>
            {isExporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{exportProgress}%</> : <><Download className="w-4 h-4 mr-2" />Export</>}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 bg-black/30 border-r border-white/10 p-4 overflow-y-auto shrink-0">
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="w-full grid grid-cols-3 bg-white/5 mb-4">
              <TabsTrigger value="upload" className="text-xs data-[state=active]:bg-white/10">Upload</TabsTrigger>
              <TabsTrigger value="device" className="text-xs data-[state=active]:bg-white/10">Device</TabsTrigger>
              <TabsTrigger value="scene" className="text-xs data-[state=active]:bg-white/10">Scene</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              <div
                className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-purple-500/50 cursor-pointer bg-white/5"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Drop your screenshot</p>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
              </div>
              {uploadedImage && (
                <div className="relative rounded-lg overflow-hidden border border-white/10">
                  <img src={uploadedImage} alt="Uploaded" className="w-full" />
                  <Button variant="destructive" size="sm" className="absolute top-2 right-2 h-6 text-xs" onClick={() => { setUploadedImage(null); setImageTexture(null) }}>Remove</Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="device" className="space-y-4">
              <Label className="text-xs text-gray-400 uppercase tracking-wider">Device Model</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(deviceConfigs) as [DeviceType, typeof deviceConfigs.iphone15][]).map(([key, config]) => (
                  <Button
                    key={key}
                    variant="ghost"
                    className={`h-auto py-3 flex flex-col gap-1 justify-start ${selectedDevice === key ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-purple-500/50' : 'bg-white/5 border-white/10 text-gray-400'} border`}
                    onClick={() => setSelectedDevice(key)}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span className="text-xs">{config.name}</span>
                  </Button>
                ))}
              </div>

              <Label className="text-xs text-gray-400 uppercase tracking-wider mt-4">Material</Label>
              <div className="grid grid-cols-3 gap-2">
                {colorPresets.map((color, i) => (
                  <button
                    key={i}
                    className={`w-full h-10 rounded-lg transition-all ${selectedColor.name === color.name ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-900' : ''}`}
                    style={{ background: `linear-gradient(135deg, ${color.primary}, ${color.primary})` }}
                    onClick={() => setSelectedColor(color)}
                    title={color.name}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="scene" className="space-y-4">
              <Label className="text-xs text-gray-400 uppercase tracking-wider">Animation</Label>
              <div className="grid grid-cols-2 gap-2">
                {animationPresets.map((preset) => (
                  <Button
                    key={preset.id}
                    variant="ghost"
                    className={`h-auto py-2 flex flex-col gap-1 ${selectedAnimation === preset.id ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-purple-500/50' : 'bg-white/5 border-white/10 text-gray-400'} border`}
                    onClick={() => setSelectedAnimation(preset.id as AnimationType)}
                  >
                    <preset.icon className="w-4 h-4" />
                    <span className="text-xs">{preset.name}</span>
                  </Button>
                ))}
              </div>

              <Label className="text-xs text-gray-400 uppercase tracking-wider mt-4">Environment</Label>
              <div className="grid grid-cols-2 gap-2">
                {environmentPresets.map((env) => (
                  <Button
                    key={env.id}
                    variant="ghost"
                    className={`${selectedEnvironment === env.id ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-purple-500/50' : 'bg-white/5 border-white/10 text-gray-400'} border`}
                    onClick={() => setSelectedEnvironment(env.id as EnvironmentType)}
                  >
                    <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: env.color }} />
                    <span className="text-xs">{env.name}</span>
                  </Button>
                ))}
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-gray-400">Speed</Label>
                  <span className="text-xs text-gray-500">{animationSpeed}x</span>
                </div>
                <Slider value={[animationSpeed]} min={0.25} max={2} step={0.25} onValueChange={(v) => setAnimationSpeed(v[0])} />
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        {/* 3D Canvas */}
        <main className="flex-1 relative bg-gradient-to-br from-gray-900 via-black to-gray-900">
          <Canvas camera={{ position: [0, 0, 8], fov: 45 }} shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
            <Suspense fallback={null}>
              <Scene
                deviceConfig={deviceConfigs[selectedDevice]}
                imageTexture={imageTexture}
                colorScheme={selectedColor}
                animation={selectedAnimation}
                isPlaying={isPlaying}
                environment={selectedEnvironment}
              />
            </Suspense>
          </Canvas>

          <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-400">
            <MousePointer2 className="w-4 h-4" />
            <span>Drag to rotate • Scroll to zoom</span>
          </div>

          <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2">
            <div className="text-xs text-gray-400">{deviceConfigs[selectedDevice].name}</div>
            <div className="text-sm font-medium">{selectedColor.name}</div>
          </div>
        </main>
      </div>
    </div>
  )
}
