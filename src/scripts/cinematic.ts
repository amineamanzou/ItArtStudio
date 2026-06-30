const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const reduceMotion = motionQuery.matches;

type Track = "it" | "studio" | "art";
type SmoothScroller = {
  scrollTo: (target: string | number | HTMLElement, options?: { immediate?: boolean; offset?: number }) => void;
};

const shell = document.querySelector<HTMLElement>(".cinematic-shell");
const revealNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-cinema-reveal]")).filter(
  (node) => !node.closest("[data-cinematic-hero]")
);

const revealFallback = () => {
  revealNodes.forEach((node) => node.classList.add("is-visible"));
};

const getAnchorOffset = () => {
  const nav = document.querySelector<HTMLElement>(".cinematic-nav");
  return (nav?.offsetHeight ?? 64) + 28;
};

const getAnchorTarget = (hash: string) => {
  if (!hash.startsWith("#") || hash.length < 2) {
    return null;
  }

  return document.getElementById(decodeURIComponent(hash.slice(1)));
};

const scrollToTarget = (target: HTMLElement, lenis?: SmoothScroller, immediate = false) => {
  const y = Math.max(0, target.getBoundingClientRect().top + window.scrollY - getAnchorOffset());

  if (lenis && !motionQuery.matches) {
    lenis.scrollTo(y, { immediate });
  } else {
    window.scrollTo({ top: y, behavior: immediate || motionQuery.matches ? "auto" : "smooth" });
  }
};

const initTrackSwitch = () => {
  const triggers = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-track-trigger]"));

  if (!shell || !triggers.length) {
    return;
  }

  const setTrack = (track: Track) => {
    shell.dataset.activeTrack = track;
    triggers.forEach((trigger) => {
      trigger.setAttribute("aria-pressed", String(trigger.dataset.trackTrigger === track));
    });
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const track = trigger.dataset.trackTrigger;

      if (track === "it" || track === "studio" || track === "art") {
        setTrack(track);
      }
    });
  });
};

const initSmoothAnchors = (lenis?: SmoothScroller) => {
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const href = anchor.getAttribute("href");

      if (!href || href === "#") {
        return;
      }

      const target = getAnchorTarget(href);

      if (!target) {
        return;
      }

      event.preventDefault();

      window.history.pushState(null, "", href);
      scrollToTarget(target, lenis);
    });
  });
};

const scrollToCurrentHash = (lenis?: SmoothScroller, delay = 120) => {
  const hash = window.location.hash;

  if (!hash) {
    return;
  }

  const target = getAnchorTarget(hash);

  if (!(target instanceof HTMLElement)) {
    return;
  }

  window.setTimeout(() => {
    scrollToTarget(target, lenis, true);
  }, delay);
};

const initReducedMotion = () => {
  document.documentElement.classList.add("reduced-motion");
  revealFallback();
  initTrackSwitch();
  initSmoothAnchors();
  scrollToCurrentHash();
};

const initCinematic = async () => {
  motionQuery.addEventListener("change", () => {
    window.location.reload();
  });

  const [{ gsap }, scrollTriggerModule, lenisModule, THREE] = await Promise.all([
    import("gsap"),
    import("gsap/ScrollTrigger"),
    import("lenis"),
    import("three")
  ]);

  const ScrollTrigger = scrollTriggerModule.ScrollTrigger;
  const Lenis = lenisModule.default;

  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add("motion-ready");

  const lenis = new Lenis({
    duration: 1.12,
    smoothWheel: true,
    wheelMultiplier: 0.9,
    touchMultiplier: 0.75
  });

  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  initTrackSwitch();
  initSmoothAnchors(lenis);

  revealNodes.forEach((node, index) => {
    gsap.fromTo(
      node,
      {
        y: 44,
        filter: "blur(10px)"
      },
      {
        immediateRender: false,
        y: 0,
        filter: "blur(0px)",
        duration: 1.05,
        delay: Math.min(index % 3, 2) * 0.04,
        ease: "expo.out",
        scrollTrigger: {
          trigger: node,
          start: "top 82%",
          once: true
        }
      }
    );
  });

  const hero = document.querySelector<HTMLElement>("[data-cinematic-hero]");

  if (hero && window.matchMedia("(min-width: 780px)").matches) {
    gsap
      .timeline({
        scrollTrigger: {
          trigger: hero,
          start: "top top",
          end: "+=220%",
          scrub: 0.8,
          pin: true
        }
      })
      .to(hero, { "--split-progress": 1, "--scene-zoom": 0.72, "--scene-shift": 1, duration: 0.36, ease: "none" })
      .to(hero, { "--studio-scale": 1.16, "--axis-glow": 1, duration: 0.28, ease: "none" }, 0)
      .to(".hero-copy--it", { xPercent: -14, yPercent: -8, autoAlpha: 0.62, duration: 0.3, ease: "none" }, 0.14)
      .to(".hero-copy--art", { xPercent: 14, yPercent: 8, autoAlpha: 0.62, duration: 0.3, ease: "none" }, 0.14)
      .to(hero, { "--scene-zoom": 0.18, "--scene-shift": -0.36, duration: 0.34, ease: "none" }, 0.5)
      .to(".studio-core", { yPercent: -7, scale: 0.9, duration: 0.34, ease: "none" }, 0.42)
      .to(".scroll-cue", { autoAlpha: 0, duration: 0.1, ease: "none" }, 0.06);
  }

  const founder = document.querySelector<HTMLElement>("[data-founder-reveal]");

  if (founder) {
    gsap
      .timeline({
        scrollTrigger: {
          trigger: founder,
          start: "top 64%",
          end: "bottom 38%",
          scrub: 0.8
        }
      })
      .to(founder, { "--founder-lift": 1, "--portrait-glow": 1, duration: 1, ease: "none" });
  }

  const domain = document.querySelector<HTMLElement>("[data-domain-split]");

  if (domain) {
    gsap
      .timeline({
        scrollTrigger: {
          trigger: domain,
          start: "top 72%",
          end: "bottom 42%",
          scrub: 0.7
        }
      })
      .fromTo(".domain-column--it", { xPercent: -9 }, { xPercent: 0, duration: 1, ease: "none" }, 0)
      .fromTo(".domain-column--art", { xPercent: 9 }, { xPercent: 0, duration: 1, ease: "none" }, 0);
  }

  const values = document.querySelector<HTMLElement>("[data-values]");

  if (values) {
    gsap
      .timeline({
        scrollTrigger: {
          trigger: values,
          start: "top 74%",
          end: "bottom 46%",
          scrub: 0.8
        }
      })
      .to(values, { "--value-cross": 1, duration: 1, ease: "none" });
  }

  initWebGLScene(THREE, ScrollTrigger);
  ScrollTrigger.refresh();
  scrollToCurrentHash(lenis, 260);
};

const initWebGLScene = (
  THREE: typeof import("three"),
  ScrollTrigger: typeof import("gsap/ScrollTrigger").ScrollTrigger
) => {
  const canvas = document.querySelector<HTMLCanvasElement>("#split-canvas");
  const hero = document.querySelector<HTMLElement>("[data-cinematic-hero]");

  const canUseWebGL = window.matchMedia("(min-width: 780px)").matches;

  if (!canvas || !hero || !canUseWebGL) {
    canvas?.remove();
    return;
  }

  let scrollProgress = 0;
  let frame = 0;
  let running = true;
  let inView = true;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 7;

  const count = 260;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const radius = 1.1 + Math.random() * 3.2;
    const angle = Math.random() * Math.PI * 2;
    positions[index * 3] = Math.cos(angle) * radius * 0.72 + side * (0.65 + Math.random() * 1.2);
    positions[index * 3 + 1] = Math.sin(angle) * radius * 0.62 + (Math.random() - 0.5) * 1.6;
    positions[index * 3 + 2] = (Math.random() - 0.5) * 3.4;

    if (side < 0) {
      colors[index * 3] = 0.1;
      colors[index * 3 + 1] = 0.72;
      colors[index * 3 + 2] = 1;
    } else {
      colors[index * 3] = 1;
      colors[index * 3 + 1] = 0.44;
      colors[index * 3 + 2] = 0.35;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const particles = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: false
    })
  );

  const core = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.5, 0.012, 180, 8, 2, 3),
    new THREE.MeshBasicMaterial({
      color: 0xf5f7ff,
      transparent: true,
      opacity: 0.08,
      wireframe: true
    })
  );

  scene.add(particles, core);

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };

  ScrollTrigger.create({
    trigger: hero,
    start: "top top",
    end: "bottom top",
    onUpdate: (self) => {
      scrollProgress = self.progress;
    }
  });

  const observer = new IntersectionObserver(
    ([entry]) => {
      inView = Boolean(entry?.isIntersecting);
    },
    { threshold: 0 }
  );

  observer.observe(hero);

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;

    if (running && inView && !frame) {
      frame = window.requestAnimationFrame(render);
    }
  });

  const render = (time = 0) => {
    frame = 0;

    if (!running || !inView) {
      return;
    }

    const seconds = time * 0.001;
    particles.rotation.y = seconds * 0.055 + scrollProgress * 0.7;
    particles.rotation.z = scrollProgress * 0.18;
    core.rotation.x = seconds * 0.2 + scrollProgress * 1.4;
    core.rotation.y = seconds * 0.14 - scrollProgress * 1.1;
    camera.position.z = 7 - scrollProgress * 1.35;
    core.scale.setScalar(1 + scrollProgress * 0.34);
    renderer.render(scene, camera);
    frame = window.requestAnimationFrame(render);
  };

  resize();
  window.addEventListener("resize", resize);
  frame = window.requestAnimationFrame(render);
};

if (reduceMotion) {
  initReducedMotion();
} else {
  initCinematic().catch((error) => {
    console.warn("Cinematic runtime disabled", error);
    revealFallback();
    initTrackSwitch();
    initSmoothAnchors();
  });
}
