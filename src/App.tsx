/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Play, RotateCcw, ChevronLeft, Info, BarChart2, Volume2, VolumeX } from 'lucide-react';
import { Trial, UserResponse, SessionStats } from './types';

const GRID_SIZE = 3;
const TOTAL_TRIALS = 20;
const STIMULUS_DURATION = 500;
const TRIAL_INTERVAL = 2500;
const LETTERS = ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T'];

export default function App() {
  const [gameState, setGameState] = useState<'home' | 'playing' | 'result'>('home');
  const [nLevel, setNLevel] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [userResponses, setUserResponses] = useState<UserResponse[]>([]);
  const [history, setHistory] = useState<SessionStats[]>([]);
  const [activeVoice, setActiveVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  
  // Current trial state for UI
  const [activeGridIndex, setActiveGridIndex] = useState<number | null>(null);
  const [hasRespondedPosition, setHasRespondedPosition] = useState(false);
  const [hasRespondedLetter, setHasRespondedLetter] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const responsesRef = useRef<UserResponse[]>([]);

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('nback_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  // Keep-alive for Speech Synthesis (Chrome bug workaround)
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const keepAlive = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } else {
        window.speechSynthesis.resume();
      }
    }, 10000);

    return () => clearInterval(keepAlive);
  }, [gameState]);

  // Initialize Speech Synthesis
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      // Prefer English female voices
      const femaleVoice = voices.find(v => 
        v.lang.startsWith('en') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('google us english'))
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
      
      if (femaleVoice) {
        setActiveVoice(femaleVoice);
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (isMuted) return;
    
    // Cancel any pending speech to clear the queue
    window.speechSynthesis.cancel();
    // Resume in case it's paused
    window.speechSynthesis.resume();
    
    const utterance = new SpeechSynthesisUtterance(text);
    if (activeVoice) {
      utterance.voice = activeVoice;
    }
    utterance.rate = 1.1; // Slightly faster for better rhythm
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-US'; // Explicitly set language
    
    // Error handling
    utterance.onerror = (event) => {
      console.error('SpeechSynthesisUtterance error', event);
    };

    window.speechSynthesis.speak(utterance);
  }, [activeVoice, isMuted]);

  const generateTrials = (level: number) => {
    const newTrials: Trial[] = Array(TOTAL_TRIALS).fill(null).map(() => ({ position: -1, letter: '' }));
    
    const availableIndices: number[] = [];
    for (let i = level; i < TOTAL_TRIALS; i++) {
      availableIndices.push(i);
    }

    // Target matches (6 as requested, but capped by available trials)
    const targetMatches = Math.min(6, availableIndices.length);

    // Randomly select indices for position and letter matches
    const posMatchIndices = [...availableIndices].sort(() => Math.random() - 0.5).slice(0, targetMatches);
    const letMatchIndices = [...availableIndices].sort(() => Math.random() - 0.5).slice(0, targetMatches);

    for (let i = 0; i < TOTAL_TRIALS; i++) {
      if (i < level) {
        // Initial trials cannot be matches
        newTrials[i] = {
          position: Math.floor(Math.random() * 9),
          letter: LETTERS[Math.floor(Math.random() * LETTERS.length)],
        };
      } else {
        // Position logic
        if (posMatchIndices.includes(i)) {
          newTrials[i].position = newTrials[i - level].position;
        } else {
          let pos;
          do {
            pos = Math.floor(Math.random() * 9);
          } while (pos === newTrials[i - level].position);
          newTrials[i].position = pos;
        }

        // Letter logic
        if (letMatchIndices.includes(i)) {
          newTrials[i].letter = newTrials[i - level].letter;
        } else {
          let letVal;
          do {
            letVal = LETTERS[Math.floor(Math.random() * LETTERS.length)];
          } while (letVal === newTrials[i - level].letter);
          newTrials[i].letter = letVal;
        }
      }
    }
    return newTrials;
  };

  const startGame = () => {
    // Some browsers require a user gesture to enable speech synthesis
    if (!isMuted) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      const utterance = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(utterance);
    }
    
    const newTrials = generateTrials(nLevel);
    setTrials(newTrials);
    setCurrentIndex(-1);
    setUserResponses([]);
    responsesRef.current = [];
    setGameState('playing');
    nextTrial(0, newTrials);
  };

  const nextTrial = (index: number, currentTrials: Trial[]) => {
    if (index >= TOTAL_TRIALS) {
      finishGame(responsesRef.current, currentTrials);
      return;
    }

    setCurrentIndex(index);
    setActiveGridIndex(currentTrials[index].position);
    // Small delay to ensure state update doesn't interfere with speech synthesis
    setTimeout(() => {
      speak(currentTrials[index].letter);
    }, 50);
    setHasRespondedPosition(false);
    setHasRespondedLetter(false);

    // Initial response state for this trial
    const initialResponse: UserResponse = { positionMatch: false, letterMatch: false };
    responsesRef.current = [...responsesRef.current, initialResponse];
    setUserResponses([...responsesRef.current]);

    // Clear stimulus after 500ms
    setTimeout(() => {
      setActiveGridIndex(null);
    }, STIMULUS_DURATION);

    // Schedule next trial
    timerRef.current = setTimeout(() => {
      nextTrial(index + 1, currentTrials);
    }, TRIAL_INTERVAL + STIMULUS_DURATION);
  };

  const handleResponse = (type: 'position' | 'letter') => {
    if (currentIndex < 0) return;
    
    const newResponses = [...responsesRef.current];
    if (type === 'position') {
      if (hasRespondedPosition) return;
      newResponses[currentIndex].positionMatch = true;
      setHasRespondedPosition(true);
    } else {
      if (hasRespondedLetter) return;
      newResponses[currentIndex].letterMatch = true;
      setHasRespondedLetter(true);
    }
    
    responsesRef.current = newResponses;
    setUserResponses(newResponses);
  };

  const finishGame = (finalResponses: UserResponse[], finalTrials: Trial[]) => {
    const stats: SessionStats = {
      nLevel,
      accuracy: 0,
      position: { correct: 0, falseAlarm: 0, missed: 0 },
      audio: { correct: 0, falseAlarm: 0, missed: 0 },
      timestamp: Date.now(),
    };

    for (let i = 0; i < TOTAL_TRIALS; i++) {
      const isPositionMatch = i >= nLevel && finalTrials[i].position === finalTrials[i - nLevel].position;
      const isLetterMatch = i >= nLevel && finalTrials[i].letter === finalTrials[i - nLevel].letter;

      const userPos = finalResponses[i].positionMatch;
      const userLet = finalResponses[i].letterMatch;

      // Position scoring
      if (isPositionMatch) {
        if (userPos) stats.position.correct++;
        else stats.position.missed++;
      } else {
        if (userPos) stats.position.falseAlarm++;
      }

      // Audio scoring
      if (isLetterMatch) {
        if (userLet) stats.audio.correct++;
        else stats.audio.missed++;
      } else {
        if (userLet) stats.audio.falseAlarm++;
      }
    }

    const totalTrialsWithPotentialMatch = (TOTAL_TRIALS - nLevel) * 2;
    // Accuracy calculation: (Correct Hits + Correct Rejections) / Total
    // But standard n-back often just reports hits/misses. 
    // We'll use a simple correct/total for the report.
    const totalErrors = stats.position.falseAlarm + stats.position.missed + stats.audio.falseAlarm + stats.audio.missed;
    
    // Auto-leveling logic
    let nextN = nLevel;
    if (totalErrors <= 3) {
      nextN = nLevel + 1;
    } else if (totalErrors >= 7) {
      nextN = Math.max(1, nLevel - 1);
    }

    setNLevel(nextN);

    const newHistory = [...history, stats].slice(-50); // Keep last 50
    setHistory(newHistory);
    localStorage.setItem('nback_history', JSON.stringify(newHistory));
    
    setGameState('result');
  };

  const resetGame = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setGameState('home');
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      if (e.key === 'f' || e.key === 'F' || e.key === 'ArrowLeft') {
        handleResponse('position');
      } else if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowRight') {
        handleResponse('letter');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, handleResponse]);

  if (gameState === 'home') {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-start p-6 font-sans overflow-y-auto">
        <div className="max-w-md w-full text-center space-y-8 py-12">
          <header className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-gray-800">双重记忆 (Dual N-back)</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              研究表明每天进行 20 轮 n-back 测试能明显提升认知功能及记忆力。
            </p>
          </header>

          <div className="py-8 flex flex-col items-center">
            <div className="flex items-center gap-8 mb-4">
              <button 
                onClick={() => setNLevel(prev => Math.max(1, prev - 1))}
                className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold hover:bg-gray-200 active:scale-90 transition-all"
              >
                -
              </button>
              <div className="text-6xl font-light text-gray-400">{nLevel}</div>
              <button 
                onClick={() => setNLevel(prev => prev + 1)}
                className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold hover:bg-gray-200 active:scale-90 transition-all"
              >
                +
              </button>
            </div>
            <div className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-6">当前 N 级</div>

            <button
              onClick={() => {
                const nextMuted = !isMuted;
                setIsMuted(nextMuted);
                // Some browsers require a user gesture to enable speech synthesis
                if (!nextMuted) {
                  const utterance = new SpeechSynthesisUtterance("Sound enabled");
                  if (activeVoice) utterance.voice = activeVoice;
                  window.speechSynthesis.speak(utterance);
                }
              }}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all active:scale-95 ${
                isMuted 
                  ? 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse' 
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              }`}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              {isMuted ? '声音已禁用 (点击开启)' : '声音已开启'}
            </button>
          </div>

          <button
            onClick={startGame}
            className="w-full py-4 bg-gray-800 text-white rounded-2xl font-semibold text-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 shadow-sm active:scale-95"
          >
            <Play size={20} fill="currentColor" />
            开始训练
          </button>

          {/* Gameplay Guide */}
          <section className="text-left bg-gray-50 p-6 rounded-3xl space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-gray-400 font-bold flex items-center gap-2">
              <Info size={14} /> 玩法指南
            </h3>
            <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold shrink-0">1</div>
                <p>每一轮包含一个<b>位置刺激</b>（九宫格亮起）和一个<b>声音刺激</b>（字母播报）。</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold shrink-0">2</div>
                <p>判断当前刺激是否与 <b>n 步前</b>的刺激完全一致。</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold shrink-0">3</div>
                <p><b>电脑快捷键：</b>位置匹配 [F] / 声音匹配 [J]。手机端可直接触屏汇报。</p>
              </div>
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold shrink-0">4</div>
                <p><b>晋级规则：</b>总错误数 ≤ 3 自动升一级；错误 ≥ 7 自动降一级；3 &lt; 总错误数 &lt; 7 保级。</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (gameState === 'playing') {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex flex-col font-sans select-none touch-none">
        {/* Header with Return Button */}
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            onClick={resetGame}
            className="p-2 -ml-2 text-gray-400 hover:text-gray-600 active:scale-90 transition-all flex items-center gap-1"
          >
            <ChevronLeft size={20} />
            <span className="text-sm font-medium">返回</span>
          </button>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            {nLevel}-BACK 训练中
          </div>
          <div className="w-10"></div> {/* Spacer for symmetry */}
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-gray-100">
          <div 
            className="h-full bg-gray-400 transition-all duration-300" 
            style={{ width: `${((currentIndex + 1) / TOTAL_TRIALS) * 100}%` }}
          />
        </div>

        <div className="flex-1 flex flex-col items-center justify-between py-8 px-4">
          <div className="text-center">
            <div className="text-sm font-mono text-gray-400">
              {currentIndex + 1} / {TOTAL_TRIALS}
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[320px] aspect-square">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className={`rounded-xl transition-colors duration-200 ${
                  activeGridIndex === i ? 'bg-gray-600' : 'bg-gray-100'
                }`}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="w-full max-w-md grid grid-cols-2 gap-4 h-48 sm:h-32">
            <button
              onPointerDown={() => handleResponse('position')}
              className={`rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${
                hasRespondedPosition 
                  ? 'bg-gray-200 text-gray-400' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="text-lg font-bold">位置匹配</span>
              <span className="text-[10px] uppercase tracking-tighter opacity-50">Keyboard: F</span>
            </button>
            <button
              onPointerDown={() => handleResponse('letter')}
              className={`rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${
                hasRespondedLetter 
                  ? 'bg-gray-200 text-gray-400' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="text-lg font-bold">声音匹配</span>
              <span className="text-[10px] uppercase tracking-tighter opacity-50">Keyboard: J</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'result') {
    const lastStats = history[history.length - 1];
    const totalErrors = lastStats.position.falseAlarm + lastStats.position.missed + lastStats.audio.falseAlarm + lastStats.audio.missed;
    
    let status = "保级";
    let statusColor = "text-gray-400";
    if (totalErrors <= 3) {
      status = "晋级";
      statusColor = "text-emerald-500";
    } else if (totalErrors >= 7) {
      status = "降级";
      statusColor = "text-rose-500";
    }

    return (
      <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center p-6 font-sans overflow-y-auto">
        <div className="max-w-md w-full space-y-8 py-8">
          <header className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">训练报告 (N={lastStats.nLevel})</h2>
            <p className="text-gray-500">本轮表现总结</p>
          </header>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-6 rounded-3xl text-center flex flex-col items-center justify-center">
              <div className={`text-4xl font-bold ${statusColor}`}>{status}</div>
              <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mt-1">晋级状态</div>
            </div>
            <div className="bg-gray-50 p-6 rounded-3xl text-center">
              <div className="text-4xl font-bold text-gray-800">{totalErrors}</div>
              <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mt-1">总错误数</div>
            </div>
          </div>

          <div className="space-y-6">
            <section>
              <h3 className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-4 border-b border-gray-100 pb-2">位置统计</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xl font-semibold text-gray-700">{lastStats.position.correct}</div>
                  <div className="text-[10px] text-gray-400">答对</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-gray-700">{lastStats.position.falseAlarm}</div>
                  <div className="text-[10px] text-gray-400">误报</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-gray-700">{lastStats.position.missed}</div>
                  <div className="text-[10px] text-gray-400">漏报</div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xs uppercase tracking-widest text-gray-400 font-bold mb-4 border-b border-gray-100 pb-2">声音统计</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xl font-semibold text-gray-700">{lastStats.audio.correct}</div>
                  <div className="text-[10px] text-gray-400">答对</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-gray-700">{lastStats.audio.falseAlarm}</div>
                  <div className="text-[10px] text-gray-400">误报</div>
                </div>
                <div>
                  <div className="text-xl font-semibold text-gray-700">{lastStats.audio.missed}</div>
                  <div className="text-[10px] text-gray-400">漏报</div>
                </div>
              </div>
            </section>
          </div>

          <div className="pt-4 space-y-3">
            <button
              onClick={startGame}
              className="w-full py-4 bg-gray-800 text-white rounded-2xl font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 shadow-sm active:scale-95"
            >
              <RotateCcw size={18} />
              开始下一轮
            </button>
            <button
              onClick={resetGame}
              className="w-full py-4 bg-white text-gray-500 border border-gray-200 rounded-2xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 active:scale-95"
            >
              <ChevronLeft size={18} />
              返回主页
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
