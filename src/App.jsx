// App.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './index.css';

// Utility functions for formatting mass
const formatMass = (mass) => {
  const units = [
    { value: 1e24, symbol: 'Yg' },
    { value: 1e21, symbol: 'Zg' },
    { value: 1e18, symbol: 'Eg' },
    { value: 1e15, symbol: 'Pg' },
    { value: 1e12, symbol: 'Tg' },
    { value: 1e9, symbol: 'Gg' },
    { value: 1e6, symbol: 'Mg' },
    { value: 1e3, symbol: 'kg' },
    { value: 1, symbol: 'g' },
    { value: 1e-3, symbol: 'mg' },
    { value: 1e-6, symbol: 'μg' },
    { value: 1e-9, symbol: 'ng' },
    { value: 1e-12, symbol: 'pg' },
    { value: 1e-15, symbol: 'fg' },
    { value: 1e-18, symbol: 'ag' }
  ];

  for (const unit of units) {
    if (mass >= unit.value) {
      const value = mass / unit.value;
      if (value >= 1000) {
        return `${value.toExponential(2)} ${unit.symbol}`;
      }
      return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${unit.symbol}`;
    }
  }
  return `${mass.toExponential(2)} g`;
};

// Game state management
const useGameState = () => {
  const [gameState, setGameState] = useState(() => {
    const saved = localStorage.getItem('collidleState');
    const defaultState = {
      mass: 1e-18, // Starting at 1 ag
      echoPoints: 0,
      upgrades: {
        impactForce: { level: 0, cost: 1e-17 },
        emitterSpeed: { level: 0, cost: 1e-16 },
        coreStability: { level: 0, cost: 1e-15 },
        radiationLeak: { level: 0, cost: 1e-14 }
      },
      echoMultiplierLevel: 0,
      lastSave: Date.now(),
      totalClicks: 0,
      firstEchoUnlocked: false
    };
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Calculate offline earnings
        const timeDelta = (Date.now() - parsed.lastSave) / 1000;
        const offlineEarnings = calculateMassPerSecond(parsed) * timeDelta * 0.5; // 50% offline efficiency
        parsed.mass += offlineEarnings;
        
        if (offlineEarnings > 0) {
          setTimeout(() => {
            showNotification(`While you were away, you earned ${formatMass(offlineEarnings)}`);
          }, 1000);
        }
        
        return { ...defaultState, ...parsed, lastSave: Date.now() };
      } catch (e) {
        console.error('Failed to load save:', e);
      }
    }
    return defaultState;
  });

  const [buyAmount, setBuyAmount] = useState('1');
  const [notifications, setNotifications] = useState([]);
  const [particles, setParticles] = useState([]);
  const [coreScale, setCoreScale] = useState(1);

  // Calculate derived values
  const calculateMassPerClick = useCallback((state = gameState) => {
    const bcv = 1e-18 * (1 + state.upgrades.impactForce.level * 0.15);
    const bm = 1 + state.upgrades.coreStability.level * 0.08;
    const ep = Math.pow(2, state.echoPoints);
    const emu = Math.pow(1.1, state.echoMultiplierLevel);
    return bcv * bm * ep * emu;
  }, [gameState]);

  const calculateMassPerSecond = useCallback((state = gameState) => {
    const bcv = 1e-18 * (1 + state.upgrades.impactForce.level * 0.15);
    const acs = state.upgrades.emitterSpeed.level * 0.5;
    const bm = 1 + state.upgrades.coreStability.level * 0.08;
    const pips = state.upgrades.radiationLeak.level * 1e-17;
    const ep = Math.pow(2, state.echoPoints);
    const emu = Math.pow(1.1, state.echoMultiplierLevel);
    return ((acs * bcv * bm) + pips) * ep * emu;
  }, [gameState]);

  const showNotification = (message) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  };

  return {
    gameState,
    setGameState,
    buyAmount,
    setBuyAmount,
    notifications,
    particles,
    setParticles,
    coreScale,
    setCoreScale,
    calculateMassPerClick,
    calculateMassPerSecond,
    showNotification
  };
};

// Particle animation component
const ParticleField = ({ particles, onParticleRemove }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Animate background stars
      const time = Date.now() * 0.0001;
      for (let i = 0; i < 50; i++) {
        const x = (Math.sin(i * 1.4 + time) + 1) * canvas.width * 0.5;
        const y = (Math.cos(i * 2.1 + time * 0.7) + 1) * canvas.height * 0.5;
        const opacity = (Math.sin(i * 0.9 + time * 2) + 1) * 0.3;
        
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Animate particles
      particles.forEach(particle => {
        const progress = (Date.now() - particle.startTime) / particle.duration;
        if (progress >= 1) {
          onParticleRemove(particle.id);
          return;
        }
        
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease-in-cubic
        const x = particle.startX + (particle.targetX - particle.startX) * easeProgress;
        const y = particle.startY + (particle.targetY - particle.startY) * easeProgress;
        
        // Glow effect
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 15);
        gradient.addColorStop(0, 'rgba(147, 197, 253, 0.8)');
        gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.5)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // Core particle
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [particles, onParticleRemove]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
};

// Main game component
const Collidle = () => {
  const {
    gameState,
    setGameState,
    buyAmount,
    setBuyAmount,
    notifications,
    particles,
    setParticles,
    coreScale,
    setCoreScale,
    calculateMassPerClick,
    calculateMassPerSecond,
    showNotification
  } = useGameState();

  const gameAreaRef = useRef(null);
  const lastMeteorRef = useRef(Date.now());
  const [showEchoModal, setShowEchoModal] = useState(false);
  const [meteorAnimation, setMeteorAnimation] = useState(null);

  // Auto-save
  useEffect(() => {
    const saveInterval = setInterval(() => {
      localStorage.setItem('collidleState', JSON.stringify({
        ...gameState,
        lastSave: Date.now()
      }));
    }, 30000);

    return () => clearInterval(saveInterval);
  }, [gameState]);

  // Save on major events
  useEffect(() => {
    localStorage.setItem('collidleState', JSON.stringify({
      ...gameState,
      lastSave: Date.now()
    }));
  }, [gameState.mass, gameState.echoPoints, gameState.upgrades]);

  // Passive income
  useEffect(() => {
    const interval = setInterval(() => {
      const mps = calculateMassPerSecond();
      if (mps > 0) {
        setGameState(prev => ({ ...prev, mass: prev.mass + mps / 10 }));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [calculateMassPerSecond, setGameState]);

  // Meteor events
  useEffect(() => {
    const checkMeteor = () => {
      const now = Date.now();
      if (now - lastMeteorRef.current > 180000) { // 3 minutes
        lastMeteorRef.current = now;
        triggerMeteor();
      }
    };

    const interval = setInterval(checkMeteor, 5000);
    return () => clearInterval(interval);
  }, []);

  // Check for first echo unlock
  useEffect(() => {
    if (!gameState.firstEchoUnlocked && gameState.mass >= 1e-6) {
      setGameState(prev => ({ ...prev, firstEchoUnlocked: true }));
      showNotification('Quantum Echo unlocked! You can now prestige.');
    }
  }, [gameState.mass, gameState.firstEchoUnlocked]);

  const handleClick = (e) => {
    const rect = gameAreaRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Calculate edge point
    const angle = Math.atan2(clickY - centerY, clickX - centerX);
    const edgeDistance = Math.min(rect.width, rect.height) * 0.45;
    const startX = centerX + Math.cos(angle) * edgeDistance;
    const startY = centerY + Math.sin(angle) * edgeDistance;

    // Add particle
    const particle = {
      id: Date.now() + Math.random(),
      startX,
      startY,
      targetX: centerX,
      targetY: centerY,
      startTime: Date.now(),
      duration: 500
    };

    setParticles(prev => [...prev, particle]);

    // Add mass
    const massGain = calculateMassPerClick();
    setGameState(prev => ({
      ...prev,
      mass: prev.mass + massGain,
      totalClicks: prev.totalClicks + 1
    }));

    // Core pulse effect
    setCoreScale(1.1);
    setTimeout(() => setCoreScale(1), 200);
  };

  const removeParticle = (id) => {
    setParticles(prev => prev.filter(p => p.id !== id));
  };

  const triggerMeteor = () => {
    const meteorValue = calculateMassPerClick() * 1000;
    setMeteorAnimation({
      id: Date.now(),
      value: meteorValue
    });

    setTimeout(() => {
      setGameState(prev => ({ ...prev, mass: prev.mass + meteorValue }));
      showNotification(`A meteor struck your core! It was worth 1,000 particles.`);
      setCoreScale(1.3);
      setTimeout(() => setCoreScale(1), 300);
      setMeteorAnimation(null);
    }, 2000);
  };

  const calculateUpgradeCost = (upgrade, level) => {
    const baseCosts = {
      impactForce: 1e-17,
      emitterSpeed: 1e-16,
      coreStability: 1e-15,
      radiationLeak: 1e-14
    };
    
    return baseCosts[upgrade] * Math.pow(1.15, level);
  };

  const canAffordUpgrade = (upgrade, amount = 1) => {
    let totalCost = 0;
    const currentLevel = gameState.upgrades[upgrade].level;
    
    for (let i = 0; i < amount; i++) {
      totalCost += calculateUpgradeCost(upgrade, currentLevel + i);
    }
    
    return gameState.mass >= totalCost;
  };

  const purchaseUpgrade = (upgrade) => {
    const currentLevel = gameState.upgrades[upgrade].level;
    let amount = buyAmount === 'max' ? 0 : parseInt(buyAmount);
    let totalCost = 0;
    
    if (buyAmount === 'max') {
      let remainingMass = gameState.mass;
      while (true) {
        const cost = calculateUpgradeCost(upgrade, currentLevel + amount);
        if (remainingMass >= cost) {
          remainingMass -= cost;
          totalCost += cost;
          amount++;
        } else {
          break;
        }
      }
    } else {
      for (let i = 0; i < amount; i++) {
        totalCost += calculateUpgradeCost(upgrade, currentLevel + i);
      }
    }

    if (amount > 0 && gameState.mass >= totalCost) {
      setGameState(prev => ({
        ...prev,
        mass: prev.mass - totalCost,
        upgrades: {
          ...prev.upgrades,
          [upgrade]: {
            level: currentLevel + amount,
            cost: calculateUpgradeCost(upgrade, currentLevel + amount)
          }
        }
      }));
    }
  };

  const getEchoThreshold = () => {
    return 1e-6 * Math.pow(10, gameState.echoPoints);
  };

  const performEcho = () => {
    if (gameState.mass >= getEchoThreshold()) {
      setGameState(prev => ({
        ...prev,
        mass: 1e-18,
        echoPoints: prev.echoPoints + 1,
        upgrades: {
          impactForce: { level: 0, cost: 1e-17 },
          emitterSpeed: { level: 0, cost: 1e-16 },
          coreStability: { level: 0, cost: 1e-15 },
          radiationLeak: { level: 0, cost: 1e-14 }
        }
      }));
      showNotification(`Quantum Echo complete! Echo Points: ${gameState.echoPoints + 1}`);
      setShowEchoModal(false);
    }
  };

  const purchaseEchoMultiplier = () => {
    const cost = gameState.echoMultiplierLevel + 1;
    if (gameState.echoPoints >= cost) {
      setGameState(prev => ({
        ...prev,
        echoPoints: prev.echoPoints - cost,
        echoMultiplierLevel: prev.echoMultiplierLevel + 1
      }));
    }
  };

  const upgradeInfo = {
    impactForce: {
      name: 'Impact Force',
      effect: `+${(0.15 * 100).toFixed(0)}% mass per click`,
      icon: '💥'
    },
    emitterSpeed: {
      name: 'Emitter Speed',
      effect: `+0.5 particles/sec`,
      icon: '⚡'
    },
    coreStability: {
      name: 'Core Stability',
      effect: `+${(0.08 * 100).toFixed(0)}% all mass gain`,
      icon: '🛡️'
    },
    radiationLeak: {
      name: 'Radiation Leak',
      effect: `+${formatMass(1e-17)}/sec passive`,
      icon: '☢️'
    }
  };

  const echoProgress = gameState.mass / getEchoThreshold() * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-black opacity-50"></div>
      <div className="absolute inset-0">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
      </div>

      {/* Game area */}
      <div 
        ref={gameAreaRef}
        className="relative flex-1 h-screen flex items-center justify-center"
        onClick={handleClick}
      >
        <ParticleField particles={particles} onParticleRemove={removeParticle} />

        {/* HUD */}
        <div className="absolute top-0 left-0 right-0 p-4 z-20">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-4 space-y-2">
            <div className="text-2xl font-bold text-center">
              {formatMass(gameState.mass)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-300">
                <span className="text-gray-500">Per Second:</span> {formatMass(calculateMassPerSecond())}
              </div>
              <div className="text-gray-300">
                <span className="text-gray-500">Per Click:</span> {formatMass(calculateMassPerClick())}
              </div>
            </div>
            {gameState.firstEchoUnlocked && (
              <div className="mt-2">
                <div className="text-xs text-gray-400 mb-1">Echo Progress</div>
                <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
                  <motion.div 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-full"
                    animate={{ width: `${Math.min(echoProgress, 100)}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1 text-center">
                  {echoProgress.toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Core */}
        <motion.div 
          className="absolute"
          animate={{ scale: coreScale }}
          transition={{ type: "spring", stiffness: 300, damping: 10 }}
        >
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 animate-pulse-slow shadow-2xl">
              <div className="absolute inset-0 rounded-full bg-white/20 animate-spin-slow"></div>
              <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-white/0 to-white/30"></div>
            </div>
            <div className="absolute inset-0 rounded-full shadow-[0_0_60px_20px_rgba(147,197,253,0.5)]"></div>
          </div>
        </motion.div>

        {/* Meteor animation */}
        <AnimatePresence>
          {meteorAnimation && (
            <motion.div
              initial={{ x: -200, y: -200, scale: 0 }}
              animate={{ x: 0, y: 0, scale: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 2, ease: "easeInOut" }}
              className="absolute"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-red-600 shadow-[0_0_40px_15px_rgba(251,146,60,0.6)]">
                <div className="absolute inset-0 rounded-full animate-spin">
                  <div className="h-full w-full rounded-full bg-gradient-to-tr from-transparent via-white/30 to-transparent"></div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Upgrades bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm z-30">
        <div className="flex items-center p-2 gap-2">
          {/* Echo indicator and toggle */}
          {gameState.firstEchoUnlocked && (
            <div className="flex flex-col items-center gap-1 px-2">
              <button
                onClick={() => setShowEchoModal(true)}
                className="bg-purple-600/50 px-3 py-1 rounded text-xs font-semibold"
              >
                EP: {gameState.echoPoints}
              </button>
              <div className="flex bg-gray-800 rounded-lg p-0.5">
                {['1', '10', 'max'].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setBuyAmount(amount)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      buyAmount === amount 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Upgrades */}
          <div className="flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 pb-2">
              {Object.entries(upgradeInfo).map(([key, info]) => {
                const upgrade = gameState.upgrades[key];
                const canAfford = canAffordUpgrade(key, buyAmount === 'max' ? 1 : parseInt(buyAmount));
                
                return (
                  <motion.button
                    key={key}
                    onClick={() => purchaseUpgrade(key)}
                    disabled={!canAfford}
                    whileTap={{ scale: 0.95 }}
                    className={`flex-shrink-0 bg-gradient-to-br rounded-lg p-3 transition-all ${
                      canAfford 
                        ? 'from-blue-600/50 to-purple-600/50 shadow-lg shadow-blue-500/20' 
                        : 'from-gray-800 to-gray-700 opacity-50'
                    }`}
                  >
                    <div className="text-2xl mb-1">{info.icon}</div>
                    <div className="text-xs font-semibold">{info.name}</div>
                    <div className="text-xs text-gray-300">Lv. {upgrade.level}</div>
                    <div className="text-xs text-green-400">{info.effect}</div>
                    <div className="text-xs mt-1 font-semibold">
                      {formatMass(upgrade.cost)}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="fixed top-20 left-0 right-0 z-50 pointer-events-none">
        <AnimatePresence>
          {notifications.map(notification => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: -20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8, filter: "blur(10px)" }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="mx-auto w-fit mb-2"
            >
              <div className="bg-black/80 backdrop-blur-sm px-6 py-3 rounded-full text-sm font-medium shadow-xl">
                {notification.message}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Echo Modal */}
      <AnimatePresence>
        {showEchoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEchoModal(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-gradient-to-br from-purple-900 to-gray-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-4 text-center">Quantum Echo</h2>
              
              <div className="space-y-4">
                <div className="bg-black/30 rounded-lg p-4">
                  <div className="text-sm text-gray-300 mb-2">Current Echo Points</div>
                  <div className="text-3xl font-bold text-purple-400">{gameState.echoPoints}</div>
                </div>

                <div className="bg-black/30 rounded-lg p-4">
                  <div className="text-sm text-gray-300 mb-2">Next Echo Requirement</div>
                  <div className="text-xl font-semibold">{formatMass(getEchoThreshold())}</div>
                  <div className="text-sm text-gray-400 mt-1">
                    Current: {formatMass(gameState.mass)} ({echoProgress.toFixed(1)}%)
                  </div>
                </div>

                <button
                  onClick={performEcho}
                  disabled={gameState.mass < getEchoThreshold()}
                  className={`w-full py-3 rounded-lg font-semibold transition-all ${
                    gameState.mass >= getEchoThreshold()
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                      : 'bg-gray-700 opacity-50 cursor-not-allowed'
                  }`}
                >
                  Perform Echo (+1 EP)
                </button>

                {gameState.echoPoints > 0 && (
                  <div className="bg-black/30 rounded-lg p-4">
                    <div className="text-sm text-gray-300 mb-2">Echo Multiplier Upgrade</div>
                    <div className="text-sm text-gray-400 mb-2">
                      Current: +{(gameState.echoMultiplierLevel * 10)}% multiplier
                    </div>
                    <button
                      onClick={purchaseEchoMultiplier}
                      disabled={gameState.echoPoints < gameState.echoMultiplierLevel + 1}
                      className={`w-full py-2 rounded-lg text-sm font-semibold transition-all ${
                        gameState.echoPoints >= gameState.echoMultiplierLevel + 1
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600'
                          : 'bg-gray-700 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      Upgrade (Cost: {gameState.echoMultiplierLevel + 1} EP)
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setShowEchoModal(false)}
                  className="w-full py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Collidle;
