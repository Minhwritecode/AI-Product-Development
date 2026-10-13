import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function OperationsScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0.2, 7.2);
    const group = new THREE.Group();
    scene.add(group);
    scene.add(new THREE.AmbientLight(0xfff1ce, 2.6));
    const keyLight = new THREE.PointLight(0x5eead4, 18, 12);
    keyLight.position.set(3, 3, 4);
    scene.add(keyLight);

    const nodes = [
      [-2.2, 0.4, 0], [-1.25, 1.15, 0.2], [-0.35, 0.2, 0.35], [0.7, 1.1, 0],
      [1.8, 0.3, -0.1], [1.05, -0.85, 0.2], [-0.55, -1, 0], [-1.65, -0.75, 0.15]
    ].map(([x, y, z], index) => {
      const geometry = new THREE.IcosahedronGeometry(index % 3 === 0 ? 0.16 : 0.09, 1);

      const material = new THREE.MeshStandardMaterial({
        color: index % 3 === 0 ? 0xf6c453 : 0x5eead4,
        emissive: index % 3 === 0 ? 0x5e3900 : 0x064e3b,
        emissiveIntensity: 0.6,
        roughness: 0.32,
        metalness: 0.45
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      group.add(mesh);

      return mesh;
    });

    const links: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 7], [7, 0], [1, 3], [2, 6]];
    const linePositions = new Float32Array(links.length * 6);
    links.forEach(([from, to], index) => {
      linePositions.set([nodes[from].position.x, nodes[from].position.y, nodes[from].position.z, nodes[to].position.x, nodes[to].position.y, nodes[to].position.z], index * 6);
    });
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x4b827f, transparent: true, opacity: 0.5 });
    group.add(new THREE.LineSegments(lineGeometry, lineMaterial));

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();

      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let frame = 0;

    const animate = (time: number) => {
      group.rotation.y = reducedMotion ? -0.08 : Math.sin(time * 0.00018) * 0.18 - 0.08;
      group.rotation.x = reducedMotion ? 0.03 : Math.cos(time * 0.00023) * 0.04;
      nodes.forEach((node, index) => {
        node.scale.setScalar(1 + (reducedMotion ? 0 : Math.sin(time * 0.002 + index) * 0.12));
      });
      renderer.render(scene, camera);

      if (!reducedMotion) frame = requestAnimationFrame(animate);
    };

    if (reducedMotion) animate(0); else frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      nodes.forEach((node) => {
        node.geometry.dispose();

        if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose());
        else node.material.dispose();
      });
      lineGeometry.dispose();
      lineMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="operations-scene" aria-hidden="true" />;
}
