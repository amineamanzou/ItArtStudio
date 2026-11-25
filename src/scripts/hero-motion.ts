export function initHeroField(): void {
  const hero = document.querySelector<HTMLElement>("[data-hero]");
  if (!hero || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(([entry]) => {
    hero.dataset.heroField = entry.isIntersecting ? "running" : "paused";
  });

  observer.observe(hero);
}
