const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value));

export function initHeroScroll(): () => void {
  const section = document.querySelector<HTMLElement>("[data-hero-scroll]");
  const signature = section?.querySelector<HTMLElement>("[data-hero-signature]");
  const groups = section
    ? Array.from(section.querySelectorAll<HTMLElement>("[data-hero-video-group]"))
    : [];

  if (!section || !signature || groups.length === 0) return () => undefined;

  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobileViewport = window.matchMedia("(max-width: 760px)");
  const splitViewport = window.matchMedia("(min-width: 761px) and (max-width: 1100px)");
  const allVideos = groups.flatMap((group) =>
    Array.from(group.querySelectorAll<HTMLVideoElement>("[data-hero-video]"))
  );
  let animationFrame = 0;
  let renderedTime = 0;
  let targetTime = 0;
  let scrollListening = false;

  const activeGroupName = () => mobileViewport.matches
    ? "mobile"
    : splitViewport.matches
      ? "split"
      : "wide";

  const activeVideos = () => {
    const group = groups.find((candidate) => candidate.dataset.heroVideoGroup === activeGroupName());
    return group
      ? Array.from(group.querySelectorAll<HTMLVideoElement>("[data-hero-video]"))
      : [];
  };

  const finalTime = () => {
    const duration = activeVideos()
      .map((video) => video.duration)
      .find((value) => Number.isFinite(value) && value > 0);
    return Math.max(0, (duration ?? 0) - 1 / 24);
  };

  const updateVideoTime = (time: number) => {
    if (!Number.isFinite(time)) return;
    activeVideos().forEach((video) => {
      if (video.readyState < 1) return;
      if (Math.abs(video.currentTime - time) > 1 / 240) video.currentTime = time;
    });
  };

  const updateSignature = (progress: number) => {
    const pinProgress = motionPreference.matches
      ? 1
      : clamp((progress - 0.8) / 0.2);
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
    const rect = section.getBoundingClientRect();
    const range = Math.max(1, section.offsetHeight - window.innerHeight);
    const progress = clamp(-rect.top / range);
    section.style.setProperty("--hero-progress", progress.toFixed(4));
    section.dataset.heroProgress = progress.toFixed(4);
    updateSignature(progress);

    if (motionPreference.matches || finalTime() <= 0) return;
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
    allVideos.forEach((video) => video.pause());

    if (motionPreference.matches) {
      removeScrollListeners();
      section.dataset.heroMotion = "reduced";
      section.style.setProperty("--hero-progress", "1");
      section.dataset.heroProgress = "1.0000";
      targetTime = finalTime();
      renderedTime = targetTime;
      updateVideoTime(targetTime);
      updateSignature(1);
      return;
    }

    section.dataset.heroMotion = "scroll";
    addScrollListeners();
    renderedTime = activeVideos()[0]?.currentTime ?? 0;
    updateFromScroll();
  };

  const handleMetadata = () => applyMotionPreference();
  const handleViewportGroupChange = () => applyMotionPreference();
  allVideos.forEach((video) => {
    video.pause();
    if (video.readyState < 1) video.addEventListener("loadedmetadata", handleMetadata, { once: true });
  });

  if (activeVideos().some((video) => video.readyState >= 1)) applyMotionPreference();
  motionPreference.addEventListener("change", applyMotionPreference);
  mobileViewport.addEventListener("change", handleViewportGroupChange);
  splitViewport.addEventListener("change", handleViewportGroupChange);

  return () => {
    window.cancelAnimationFrame(animationFrame);
    removeScrollListeners();
    motionPreference.removeEventListener("change", applyMotionPreference);
    mobileViewport.removeEventListener("change", handleViewportGroupChange);
    splitViewport.removeEventListener("change", handleViewportGroupChange);
    allVideos.forEach((video) => video.removeEventListener("loadedmetadata", handleMetadata));
  };
}
