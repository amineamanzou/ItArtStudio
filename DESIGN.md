# Design

## Direction

Une vitrine éditoriale sombre, divisée en deux pratiques : IT à gauche, ART à
droite. Le mot STUDIO occupe la couture centrale et matérialise ce qui rassemble
les deux disciplines. Sur mobile, la séparation devient une séquence verticale
IT → STUDIO → ART.

## Système visuel

- fond graphite profond, sans gradients décoratifs ;
- cyan électrique réservé à IT ;
- corail cuivré réservé à ART ;
- ivoire chaud pour STUDIO, les grands titres et la section méthode ;
- IBM Plex Sans pour la structure et Instrument Serif pour les titres ;
- traits fins, grandes respirations, angles francs, aucune carte vitrée ;
- une image documentaire sombre par pratique, générée sans texte ni logo.

## Hero

Le desktop présente deux panneaux 50/50 sur une hauteur d'écran. Les visuels se
répondent : architecture technique et signaux cyan côté IT, atelier de matière
et outils cuivrés côté ART. Une couche sombre garantit la lisibilité du texte.

Les fichiers AVIF sont servis en priorité, puis WebP et JPEG. Ils portent des
dimensions explicites pour éviter les décalages de mise en page.

## Responsive et accessibilité

- navigation secondaire masquée sur petit écran, contact toujours visible ;
- sections et services ramenés sur une colonne sous `760px` ;
- largeur minimale validée à `320px` sans défilement horizontal ;
- focus clavier visible et liens identifiables sans dépendre de la couleur ;
- HTML sémantique, un seul `h1`, textes alternatifs descriptifs ;
- aucune fonctionnalité essentielle liée au mouvement ou au JavaScript.

## Règles de continuité

Ne pas ajouter de gradients marketing, métriques sans source, faux témoignages,
carrousels automatiques, formulaires non fonctionnels ni dépendance client lourde.
Une future vidéo doit conserver l'image actuelle comme poster et fallback.
