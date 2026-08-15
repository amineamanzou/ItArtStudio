# Révélations latérales et lumière d'ambiance

## Portée approuvée

Cette passe renforce la chorégraphie de la page d'accueil sans modifier le hero
ni la règle de séparation centrale. Tout contenu appartenant à la moitié ART
entre depuis la gauche ; tout contenu appartenant à la moitié IT entre depuis
la droite lorsqu'il rejoint la zone visible. Le contenu reste immédiatement
visible lorsque `prefers-reduced-motion` est actif ou que JavaScript manque.

## Références

Le titre visible « Références » et son texte d'introduction disparaissent. Un
titre uniquement accessible conserve la structure sémantique. Les listes ne
contiennent plus Axxès ni Ylio. Chaque logo combine la translation de sa moitié
avec un masque vertical, une légère mise au point et un stagger court.

## Méthode

Les deux fragments du titre entrent depuis leur moitié. Les étapes occupent
trois rangées explicites : Cadrer à gauche, Produire en dessous à droite, puis
Transmettre encore en dessous à gauche. Elles ne peuvent donc jamais se faire
face sur une même rangée.

## Contact et ambiance

La méthode et le contact reçoivent des halos diffus bornés : corail sur la
moitié ART, cyan sur la moitié IT. Ils sont produits par des pseudo-éléments
floutés derrière le contenu, sans ligne supplémentaire et sans affaiblir le
fond sombre. Les deux blocs contact entrent depuis leur côté respectif.

## Vérification

La QA navigateur doit confirmer l'état initial décalé, la révélation après
scroll, la position de Produire sous Cadrer, la suppression des deux logos et
des textes de référence, l'absence de bordure horizontale traversante et le
fallback mouvement réduit.
