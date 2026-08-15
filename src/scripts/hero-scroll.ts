const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

export function initHeroScroll(): () => void {
  const section = document.querySelector<HTMLElement>("[data-hero-scroll]");
  const video = section?.querySelector<HTMLVideoElement>("[data-hero-video]");

  if (!section || !video) return () => undefined;

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let animationFrame = 0;
  let renderedTime = 0;
  let targetTime = 0;
  let scrollListening = false;

  const finalTime = () => Math.max(0, video.duration - 1 / 24);

  const updateVideoTime = (time: number) => {
    if (video.readyState < 1 || !Number.isFinite(time)) return;
    if (Math.abs(video.currentTime - time) > 1 / 240) video.currentTime = time;
  };

  const render = () => {
    animationFrame = 0;
    const difference = targetTime - renderedTime;
    renderedTime = Math.abs(difference) < 1 / 240
      ? targetTime
      : renderedTime + difference * 0.22;
    updateVideoTime(renderedTime);

    if (renderedTime !== targetTime) animationFrame = window.requestAnimationFrame(render);
  };

  const requestRender = () => {
    if (!animationFrame) animationFrame = window.requestAnimationFrame(render);
  };

  const updateFromScroll = () => {
    if (motionPreference.matches || video.readyState < 1) return;
    const rect = section.getBoundingClientRect();
    const range = Math.max(1, section.offsetHeight - window.innerHeight);
    const progress = clamp(-rect.top / range);
    section.style.setProperty("--hero-progress", progress.toFixed(4));
    section.dataset.heroProgress = progress.toFixed(4);
    targetTime = progress * finalTime();
    requestRender();
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
    window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    video.pause();

    if (motionPreference.matches) {
      removeScrollListeners();
      section.dataset.heroMotion = "reduced";
      section.style.setProperty("--hero-progress", "1");
      section.dataset.heroProgress = "1.0000";
      targetTime = finalTime();
      renderedTime = targetTime;
      updateVideoTime(targetTime);
      return;
    }

    section.dataset.heroMotion = "scroll";
    addScrollListeners();
    renderedTime = video.currentTime;
    updateFromScroll();
  };

  video.pause();
  if (video.readyState >= 1) applyMotionPreference();
  else video.addEventListener("loadedmetadata", applyMotionPreference, { once: true });
  motionPreference.addEventListener("change", applyMotionPreference);

  return () => {
    window.cancelAnimationFrame(animationFrame);
    removeScrollListeners();
    motionPreference.removeEventListener("change", applyMotionPreference);
  };
}
