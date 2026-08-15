# Services, références, méthode et contact — design

## Intention

La page conserve sa couture verticale centrale comme seul trait structurel traversant. Tous les
traits horizontaux qui rencontrent cette couture disparaissent afin que l'axe ART / IT reste
visuellement ininterrompu du haut au bas de la page.

## Structure de page

Après la hero, la page enchaîne directement quatre séquences :

1. les prestations ART à gauche et IT à droite ;
2. les références sous forme de logos ;
3. la méthode alternée autour de l'axe ;
4. le double contact ART / IT.

La section de présentation des deux pratiques et l'introduction « Chaque mission se termine… »
sont supprimées car leur contenu répète la hero. La navigation « Expertises / Approche / Contact »
disparaît du header ; la marque et le contact direct restent présents.

## Prestations

Les titres « Pratique ART » et « Pratique IT », ainsi que leurs sous-titres taxonomiques, sont
supprimés. Un titre accessible masqué conserve une structure correcte pour les lecteurs d'écran.

Les prestations ART entrent depuis le bord gauche. Les prestations IT entrent depuis le bord
droit. Le mouvement est déclenché une seule fois lors de l'entrée dans le viewport, avec un léger
décalage entre les éléments. Sans JavaScript ou avec `prefers-reduced-motion`, tout le contenu est
immédiatement visible.

## Références

Les références sont représentées par leurs marques et non par une liste typographique. ART
présente HWE — Hard Work Easy Everything, Léo Urban et Aminespired. IT conserve bioMérieux,
Axxès, GCA Groupe Charles André, KeyIA, Enedis, Ylio et Odigo.

Les ressources sont servies localement. L'animation des références est distincte des prestations :
chaque marque est révélée par un masque vertical accompagné d'une courte mise au point et d'une
variation d'échelle. Elle ne produit aucun déplacement latéral depuis les bords.

## Méthode

Le titre devient une composition en deux fragments : « Un déroulé lisible » à gauche et « quel que
soit le projet » à droite. Les trois étapes alternent ensuite autour de l'axe : Cadrer à gauche,
Produire à droite, Transmettre à gauche. Chaque étape conserve sa description et son numéro, sans
ligne horizontale traversante.

## Contact

Le contact devient deux appels explicites :

- ART, à gauche : « Besoin de notre art ? » et `carine@itart.studio` ;
- IT, à droite : « Besoin de notre tech ? » et `amine@itart.studio`.

Chaque adresse utilise un lien `mailto:` et la couleur de sa pratique. Le footer reste légalement
complet et ne crée pas de trait horizontal à travers l'axe.

## Responsive et mouvement

La direction desktop / tablette conserve les deux moitiés. Sous le seuil mobile existant, le
contenu reste séquentiel et lisible ; sa direction artistique finale reste hors périmètre. Les
animations n'affectent ni l'ordre du DOM ni l'accessibilité et respectent la préférence de mouvement
réduit.

## Contrôles

- aucun trait horizontal ne croise l'axe central sur la page d'accueil ;
- aucune des deux sections redondantes ne subsiste ;
- les listes de prestations conservent les six offres ;
- les dix références disposent d'une représentation visuelle et d'un nom accessible ;
- les trois étapes alternent gauche / droite / gauche ;
- les deux adresses de contact sont présentes et fonctionnelles ;
- le build statique, les contrôles de source et les captures desktop / tablette / mobile passent
  sans débordement ni erreur navigateur.
