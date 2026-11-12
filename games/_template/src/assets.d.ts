// Permet d'importer des images et des sons depuis le dossier du jeu :
//   import sprite from './assets/sprite.png';   // sprite contient l'adresse du fichier
// La console s'occupe de les publier avec le jeu.
declare module '*.png' {
  const url: string;
  export default url;
}
declare module '*.jpg' {
  const url: string;
  export default url;
}
declare module '*.webp' {
  const url: string;
  export default url;
}
declare module '*.svg' {
  const url: string;
  export default url;
}
declare module '*.mp3' {
  const url: string;
  export default url;
}
declare module '*.ogg' {
  const url: string;
  export default url;
}
declare module '*.wav' {
  const url: string;
  export default url;
}
