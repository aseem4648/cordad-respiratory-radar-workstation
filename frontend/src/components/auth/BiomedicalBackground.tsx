import React, { useRef, useEffect } from 'react';

export const BiomedicalBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle nodes for ambient floating effect
    const particles = Array.from({ length: 35 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.4 + 0.1
    }));

    let pulsePhase = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Deep obsidian clinical background
      const bgGrad = ctx.createRadialGradient(
        width / 2, height / 2, 50,
        width / 2, height / 2, Math.max(width, height) * 0.85
      );
      bgGrad.addColorStop(0, '#0C1628');
      bgGrad.addColorStop(0.5, '#070C18');
      bgGrad.addColorStop(1, '#03050B');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Fine biomedical engineering grid
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.04)';
      ctx.lineWidth = 1;
      const step = 48;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const centerX = width / 2;
      const centerY = height / 2;

      // Slow expanding decorative radar wavefronts
      pulsePhase += 0.006;
      for (let i = 0; i < 4; i++) {
        const ringRadius = ((pulsePhase + i * 0.25) % 1) * Math.min(width, height) * 0.7;
        const opacity = Math.max(0, 1 - ringRadius / (Math.min(width, height) * 0.7)) * 0.15;

        ctx.strokeStyle = `rgba(56, 189, 248, ${opacity})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Subtle anatomical / thoracic contour curves (purely visual aesthetics)
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = centerX - 250; x <= centerX + 250; x += 10) {
        const distFromCenter = Math.abs(x - centerX);
        const yOffset = Math.cos(distFromCenter * 0.015 + pulsePhase * 2) * 24;
        const y = centerY + 180 + yOffset;
        if (x === centerX - 250) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Ambient floating particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.fillStyle = `rgba(56, 189, 248, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      {/* Decorative tag clearly stating visual UI purpose */}
      <div className="absolute bottom-3 left-4 text-[10px] font-mono text-slate-600/70 tracking-widest uppercase">
        24.125 GHz FMCW • Biomedical RF Telemetry Gateway
      </div>
    </div>
  );
};
