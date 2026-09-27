<!-- The mystery-Chaser bust: shown wherever a Chaser portrait would be but
     there's no real art to show (no character picked yet, or art still
     pending — see chaserPortraits.ts). Paints in currentColor so each
     caller tints it with a plain `color` rule. -->
<template>
    <svg class="chaser-silhouette" viewBox="0 0 120 170" aria-hidden="true">
        <circle cx="60" cy="50" r="35" />
        <path d="M60 95 C 25 95, 8 120, 8 170 L 112 170 C 112 120, 95 95, 60 95 z" />
    </svg>
</template>
