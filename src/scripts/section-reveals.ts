const revealSelector = "[data-reveal]";

export function initSectionReveals(): void {
  const revealItems = Array.from(document.querySelectorAll<HTMLElement>(revealSelector));

  if (revealItems.length === 0) return;

  document.documentElement.classList.add("has-reveal-motion");

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-revealed"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    },
    {
      rootMargin: "0px 0px -10%",
      threshold: 0
    }
  );

  revealItems.forEach((item) => observer.observe(item));
}
