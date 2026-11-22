const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

/*
 * The hero composition animates in CSS from the first paint. This controller
 * only compacts the signature while the stage is pinned and pauses the strata
 * once the hero has left the viewport.
 */
export function initHeroScroll(): () => void {
  const section = document.querySelector<HTMLElement>("[data-hero-scroll]");
  const signature = section?.querySelector<HTMLElement>("[data-hero-signature]");

  if (!section || !signature) return () => undefined;

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobileViewport = window.matchMedia("(max-width: 760px)");
  let scrollListening = false;

  const updateSignature = (progress: number) => {
    const pinProgress = motionPreference.matches
      ? 1
      : clamp((progress - 0.15) / 0.85);
    const startY = window.innerHeight * (mobileViewport.matches ? 0.5 : 0.43);
    const compactY = mobileViewport.matches ? 46 : 48;
    const compactScale = mobileViewport.matches ? 0.52 : 0.44;
    const y = startY + (compactY - startY) * pinProgress;
    const scale = 1 + (compactScale - 1) * pinProgress;

    section.style.setProperty("--signature-y", `${y.toFixed(2)}px`);
    section.style.setProperty("--signature-scale", scale.toFixed(4));
    section.style.setProperty("--signature-progress", pinProgress.toFixed(4));
    signature.dataset.signaturePinned = pinProgress >= 0.999 ? "true" : "false";
  };

  const setProgress = (progress: number) => {
    section.style.setProperty("--hero-progress", progress.toFixed(4));
    section.dataset.heroProgress = progress.toFixed(4);
    updateSignature(progress);
  };

  const updateFromScroll = () => {
    const rect = section.getBoundingClientRect();
    const range = Math.max(1, section.offsetHeight - window.innerHeight);
    setProgress(clamp(-rect.top / range));
  };

  const addScrollListeners = () => {
    if (scrollListening) return;
    scrollListening = true;
    window.addEventListener("scroll", updateFromScroll, { passive: true });
    window.addEventListener("resize", updateFromScroll);
  };

  const removeScrollListeners = () => {
    if (!scrollListening) return;
    scrollListening = false;
    window.removeEventListener("scroll", updateFromScroll);
    window.removeEventListener("resize", updateFromScroll);
  };

  const applyMotionPreference = () => {
    if (motionPreference.matches) {
      removeScrollListeners();
      section.dataset.heroMotion = "reduced";
      setProgress(1);
      return;
    }

    section.dataset.heroMotion = "scroll";
    addScrollListeners();
    updateFromScroll();
  };

  const visibility = "IntersectionObserver" in window
    ? new IntersectionObserver(([entry]) => {
      section.dataset.heroField = entry?.isIntersecting ? "running" : "paused";
    })
    : undefined;
  visibility?.observe(section);

  applyMotionPreference();
  motionPreference.addEventListener("change", applyMotionPreference);
  mobileViewport.addEventListener("change", applyMotionPreference);

  return () => {
    removeScrollListeners();
    visibility?.disconnect();
    motionPreference.removeEventListener("change", applyMotionPreference);
    mobileViewport.removeEventListener("change", applyMotionPreference);
  };
}
