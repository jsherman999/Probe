import { useState, useCallback } from 'react';

export function useSound() {
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('soundMuted');
    return saved ? JSON.parse(saved) : false;
  });

  const toggleMute = useCallback(() => {
    setIsMuted((prev: boolean) => {
      const newValue = !prev;
      localStorage.setItem('soundMuted', JSON.stringify(newValue));
      return newValue;
    });
  }, []);

  const playSound = useCallback((soundName: string) => {
    if (isMuted) return;

    // Sound effects can be added here
    // For now, using browser's built-in beep
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Different frequencies for different events
    const frequencies: { [key: string]: number } = {
      correct: 523.25, // C5
      incorrect: 329.63, // E4
      wordComplete: 659.25, // E5
      gameOver: 392.00, // G4
      notification: 440.00, // A4
    };

    oscillator.frequency.value = frequencies[soundName] || 440;
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  }, [isMuted]);

  return {
    isMuted,
    toggleMute,
    playSound,
  };
}
