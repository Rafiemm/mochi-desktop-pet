window.MOCHI_CONFIG = {
  welcome: "Hi! I live on your screen now.",
  phrases: [
    "Purr-fect timing!",
    "Just keeping an eye on things...",
    "Need a paw? Just ask!",
    "Take a break, stretch a little!",
    "Don't forget to drink some water.",
    "I'm paws-itively happy you're here.",
    "You're doing great!",
    "Meow-velous work today.",
  ],
  phraseEvery: 120,
  roamEvery: 60,
  size: Number(new URLSearchParams(location.search).get("size")) || 150,
  right: 24,
  bottom: 0,
  outfit: new URLSearchParams(location.search).get("outfit") || "default",
};
